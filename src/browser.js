import {init, destroy} from './inline-stocks.js';
const script = document.currentScript;
const options = {
  selector: script?.dataset.inlineStocksSelector,
  gatewayUrl: script?.dataset.inlineStocksGateway || window.aspireGatewayUrl || '',
  apiKey: script?.dataset.inlineStocksKey || window.finnhubApiKey || ''
};
window.InlineStocks = {version: '1.0.1', init: overrides => init({...options, ...overrides}), destroy};
async function start() {
  if (!document.body?.classList.contains('post-template')) return;
  if (!options.gatewayUrl && !options.apiKey) return;
  if (script?.src && script.dataset.inlineStocksStyles !== 'false') {
    const href = new URL('inline-stocks.css', script.src).href;
    let link = [...document.querySelectorAll('link[rel="stylesheet"]')].find(link => link.href === href);
    if (!link?.sheet) {
      const ready = new Promise(resolve => {
        if (!link) {
          link = document.createElement('link');
          link.rel = 'stylesheet'; link.href = href;
        }
        link.addEventListener('load', () => resolve(true), {once: true});
        link.addEventListener('error', () => resolve(false), {once: true});
      });
      if (!link.isConnected) document.head.append(link);
      if (!await ready) return; // Leave the post untouched if styles cannot load.
    }
  }
  window.InlineStocks.init();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
else start();
