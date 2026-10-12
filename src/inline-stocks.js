import { createStockProvider } from "./provider.js";
const SELECTORS = {
  content: '[data-post-content], .gh-content, .c-content, .post-content, .post-full-content',
  ignored: 'a, code, pre, script, style, textarea, button, input, select, svg, h1, h2, h3, h4, h5, h6, [contenteditable], [data-inline-stock], [data-stock-inline], .kg-bookmark-card, .kg-embed-card, .kg-signup-card, .kg-header-card, .kg-product-card, .kg-file-card, .kg-audio-card, .kg-video-card'
};
// Uppercase US symbols; avoid partial matches in longer or exchange-qualified symbols.
const SYMBOL_PATTERN = /(?<![\w$])\$([A-Z]{1,5})(?![\w$]|[.:-][A-Za-z0-9])/g;

function renderQuote(element, symbol, { price, changePercent, profile }) {
  if (!element.isConnected) return;
  element.textContent = '';

  if (profile?.logo && /^https:\/\//i.test(profile.logo)) {
    const logo = document.createElement('img');
    logo.className = 'inline-stock__logo';
    logo.alt = '';
    logo.width = 20;
    logo.height = 20;
    logo.loading = 'lazy';
    logo.decoding = 'async';
    logo.addEventListener('error', () => { logo.style.visibility = 'hidden'; }, { once: true });
    logo.src = profile.logo;
    element.append(logo);
  } else {
    const space = document.createElement('span');
    space.className = 'inline-stock__logo';
    space.setAttribute('aria-hidden', 'true');
    element.append(space);
  }

  const label = document.createElement('span');
  label.className = 'inline-stock__label';
  label.textContent = `${symbol} $${price.toFixed(2)}`;
  const change = document.createElement('span');
  change.className = `inline-stock__change inline-stock__change--${changePercent >= 0 ? 'positive' : 'negative'}`;
  change.textContent = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
  element.append(label, document.createTextNode(' '), change);
  element.title = `${symbol} $${price.toFixed(2)} ${change.textContent}`;
}

function replaceSymbols(node, provider, owned) {
  const text = node.textContent;
  const matches = [...text.matchAll(SYMBOL_PATTERN)];
  if (!matches.length) return;

  const fragment = document.createDocumentFragment();
  let lastIndex = 0;
  for (const match of matches) {
    const [original, symbol] = match;
    fragment.append(document.createTextNode(text.slice(lastIndex, match.index)));
    const element = document.createElement('span');
    element.setAttribute('data-inline-stock', '');
    element.className = 'inline-stock';
    element.textContent = original;
    owned.set(element, original);
    fragment.append(element);
    // Reserve the final quote's space while keeping the original symbol readable.
    void provider.getStockData(symbol).then(data => { if (owned.has(element)) renderQuote(element, symbol, data); }).catch(() => {});
    lastIndex = match.index + original.length;
  }
  fragment.append(document.createTextNode(text.slice(lastIndex)));
  node.replaceWith(fragment);
}


const owned = new Map();
/** Enhance visible article text; call again after adding dynamic content. */
export function init({root = document, selector, gatewayUrl = '', apiKey = ''} = {}) {
  if (!document.body?.classList.contains('post-template')) return;
  const provider = createStockProvider({gatewayUrl, apiKey});
  if (!provider.configured) return;
  const contentSelector = selector || SELECTORS.content;
  const contents = root.matches?.(contentSelector) ? [root] : [...root.querySelectorAll(contentSelector)];
  for (const content of contents) {
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, {
      acceptNode: node => node.parentElement?.closest(SELECTORS.ignored) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => replaceSymbols(node, provider, owned));
  }
}
export function destroy() {
  for (const [element, original] of owned) {
    if (element.isConnected) element.replaceWith(document.createTextNode(original));
  }
  owned.clear();
}
