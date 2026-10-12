import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {init, destroy} from '../src/inline-stocks.js';
import {createStockProvider} from '../src/provider.js';
function page(html) {
  const dom = new JSDOM(`<body class="post-template">${html}</body>`, {url: 'https://publication.test'});
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  globalThis.NodeFilter = dom.window.NodeFilter;
  return dom;
}
const ok = data => ({ok: true, json: async () => data});
const settle = () => new Promise(resolve => setImmediate(resolve));
test('parsing, exclusions, concurrent deduplication, repeat init and restoration', async () => {
  page(`<article data-post-content><p>$AAPL and $AAPL; $MSFT.</p>
    <h2>$AAPL</h2><a>$AAPL</a><code>$AAPL</code><div contenteditable>$AAPL</div>
    <p>$aapl $TOOLONG $BRK.B $AAPL:US $$AAPL</p></article>`);
  const calls = [];
  globalThis.fetch = async (url, options) => {calls.push({url: new URL(url), options});
    return ok(new URL(url).pathname.endsWith('quote') ? {c: 150, dp: -1.25} : {name: 'Example', logo: ''});};
  const original = document.querySelector('article').textContent;
  init({apiKey: 'test-key'}); init({apiKey: 'test-key'}); await settle();
  assert.equal(document.querySelectorAll('.inline-stock').length, 3);
  assert.equal(calls.length, 4);
  assert.equal(document.querySelector('h2').textContent, '$AAPL');
  assert.match(document.querySelector('.inline-stock').textContent, /AAPL \$150.00 -1.25%/);
  assert.ok(calls.every(c => c.options.credentials === 'omit'));
  assert.ok(!JSON.stringify(Object.values(window.localStorage)).includes('test-key'));
  destroy(); assert.equal(document.querySelector('article').textContent, original);
});
test('Ghost posts require setup; other page types cannot opt in', () => {
  page('<p data-post-content>$AAPL</p>'); init();
  assert.equal(document.querySelectorAll('[data-inline-stock]').length, 0);
  for (const template of ['', 'home-template', 'tag-template', 'author-template', 'page-template']) {
    page('<p data-post-content>$AAPL</p>'); document.body.className = template;
    init({apiKey: 'key', selector: '[data-post-content]'});
    assert.equal(document.querySelectorAll('[data-inline-stock]').length, 0);
  }
});
test('gateway takes priority; failure never falls back to direct key', async () => {
  page('<p data-post-content>$IBM</p>'); const urls = [];
  globalThis.fetch = async (url, options) => {urls.push(String(url));
    assert.ok(!options.body.includes('secret')); return {ok: false, status: 429};};
  init({gatewayUrl: 'https://gateway.test', apiKey: 'secret'}); await settle();
  assert.deepEqual(urls, ['https://gateway.test/finnhub', 'https://gateway.test/finnhub']);
  assert.equal(document.querySelector('p').textContent, '$IBM'); destroy();
});
test('optional profile failure and blocked storage do not prevent quote', async () => {
  page('<p data-post-content>$AMD</p>');
  Object.defineProperty(window, 'localStorage', {get() {throw Error('blocked');}});
  globalThis.fetch = async url => new URL(url).pathname.endsWith('quote') ? ok({c: 90, dp: 0}) : {ok: false, status: 403};
  init({apiKey: 'key'}); await settle();
  assert.equal(document.querySelector('.inline-stock').textContent, 'AMD $90.00 +0.00%'); destroy();
});
test('destroy prevents outstanding requests from rendering', async () => {
  page('<p data-post-content>$NVDA</p>'); const resolvers = [];
  globalThis.fetch = url => new Promise(resolve => resolvers.push(() => resolve(ok(new URL(url).pathname.endsWith('quote') ? {c: 100, dp: 2} : {}))));
  init({apiKey: 'key'}); destroy(); resolvers.forEach(resolve => resolve()); await settle();
  assert.equal(document.querySelector('p').textContent, '$NVDA');
  assert.equal(document.querySelectorAll('.inline-stock').length, 0);
});
test('quote cache expiry, invalid quotes, explicit selector and Ghost detection', async () => {
  page('<body class="post-template"><div class="gh-content">$TSLA</div></body>'); let calls = 0;
  globalThis.fetch = async url => {calls++; return ok(new URL(url).pathname.endsWith('quote') ? {c: 200, dp: 2} : {});};
  init({apiKey: 'key'}); await settle(); assert.equal(calls, 2); destroy();
  init({selector: '.gh-content', apiKey: 'key'}); await settle(); assert.equal(calls, 2); destroy();
  const key = 'inline-stocks:v1:finnhub:quote:TSLA';
  const cached = JSON.parse(window.localStorage.getItem(key)); cached.time -= 61000;
  window.localStorage.setItem(key, JSON.stringify(cached));
  await createStockProvider({apiKey: 'key'}).getStockData('TSLA'); assert.equal(calls, 3);
  globalThis.fetch = async () => ok({c: 0, dp: null});
  await assert.rejects(createStockProvider({apiKey: 'key'}).getStockData('INVALID'));
});

test('browser bundle boots with the Ghost Site Header snippets for both setup options', async () => {
  const code = await readFile(new URL('../dist/inline-stocks.min.js', import.meta.url), 'utf8');
  for (const gateway of [false, true]) {
    const calls = [];
    const dom = new JSDOM(`<body class="post-template"><article class="gh-content">$AAPL</article>
      <script>${gateway ? "window.aspireGatewayUrl = 'https://gateway.test';" : "window.finnhubApiKey = 'test-key';"}</script>
      <script>${code}</script></body>`, {url: 'https://publication.test', runScripts: 'dangerously',
      beforeParse(window) {window.fetch = async (url, options) => {
        calls.push({url: new URL(url), options});
        const profile = gateway ? JSON.parse(options.body).endpoint === 'profile' : new URL(url).pathname.endsWith('profile2');
        return ok(profile ? {} : gateway ? {price: 150, changePercent: 2} : {c: 150, dp: 2});
      };}
    });
    await new Promise(resolve => dom.window.addEventListener('load', resolve, {once: true}));
    await settle();
    assert.equal(dom.window.document.querySelector('.inline-stock').textContent, 'AAPL $150.00 +2.00%');
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url.origin, gateway ? 'https://gateway.test' : 'https://finnhub.io');
    dom.window.close();
  }
});


test('browser waits for styles before quote requests and leaves text intact on style failure', async () => {
  const code = await readFile(new URL('../dist/inline-stocks.min.js', import.meta.url), 'utf8');
  for (const event of ['load', 'error']) {
    let requests = 0;
    const dom = new JSDOM('<body class="post-template"><article class="gh-content">$AAPL</article></body>', {
      url: 'https://publication.test', runScripts: 'outside-only'
    });
    const {window} = dom;
    const script = window.document.createElement('script');
    script.src = 'https://assets.test/inline-stocks.min.js';
    Object.defineProperty(window.document, 'currentScript', {value: script});
    window.finnhubApiKey = 'test-key';
    window.fetch = async url => { requests++; return ok(new URL(url).pathname.endsWith('quote') ? {c: 150, dp: 2} : {}); };
    window.eval(code);
    await settle();
    assert.equal(requests, 0);
    assert.equal(window.document.querySelector('article').textContent, '$AAPL');
    const stylesheet = window.document.querySelector('link[rel="stylesheet"]');
    assert.ok(stylesheet);
    stylesheet.dispatchEvent(new window.Event(event));
    await settle();
    assert.equal(requests, event === 'load' ? 2 : 0);
    assert.equal(window.document.querySelector('article').textContent, event === 'load' ? 'AAPL $150.00 +2.00%' : '$AAPL');
    dom.window.close();
  }
});
