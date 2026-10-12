(() => {
  // src/provider.js
  var pending = /* @__PURE__ */ new Map();
  function createStockProvider({ gatewayUrl = "", apiKey = "" } = {}) {
    const config = { gateway: gatewayUrl.trim().replace(/\/+$/, ""), key: apiKey.trim() };
    const cacheDurations = { quote: 6e4, profile: 864e5 };
    function readCache(key, duration) {
      try {
        const entry = JSON.parse(window.localStorage.getItem(key));
        const age = Date.now() - entry?.time;
        return age >= 0 && age < duration ? entry.data : null;
      } catch {
        return null;
      }
    }
    function writeCache(key, data) {
      try {
        window.localStorage.setItem(key, JSON.stringify({ time: Date.now(), data }));
      } catch {
      }
    }
    function normalize(data, endpoint, gateway) {
      if (endpoint === "profile") {
        return { name: typeof data?.name === "string" ? data.name : "", logo: typeof data?.logo === "string" ? data.logo : "" };
      }
      const price = gateway ? data?.price : data?.c;
      const changePercent = gateway ? data?.changePercent : data?.dp;
      if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(changePercent)) {
        throw new Error("No quote available. Check the symbol and your provider access.");
      }
      return { price, changePercent };
    }
    function request(symbol, endpoint, config2) {
      const cacheKey = `inline-stocks:v1:${config2.gateway || "finnhub"}:${endpoint}:${symbol}`;
      const cached = readCache(cacheKey, cacheDurations[endpoint]);
      if (cached) {
        try {
          return Promise.resolve(normalize(cached, endpoint, true));
        } catch {
        }
      }
      if (pending.has(cacheKey)) return pending.get(cacheKey);
      const task = (async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1e4);
        try {
          let url;
          const options2 = { signal: controller.signal, credentials: "omit" };
          if (config2.gateway) {
            url = new URL(`${config2.gateway}/finnhub`);
            options2.method = "POST";
            options2.headers = { "Content-Type": "application/json" };
            options2.body = JSON.stringify({ symbol, ...endpoint === "profile" ? { endpoint } : {} });
          } else {
            url = new URL(`https://finnhub.io/api/v1/${endpoint === "profile" ? "stock/profile2" : "quote"}`);
            url.searchParams.set("symbol", symbol);
            url.searchParams.set("token", config2.key);
          }
          if (!["https:", "http:"].includes(url.protocol)) throw new Error("Check the stock gateway URL.");
          const response = await fetch(url, options2);
          if (!response.ok) throw new Error(`Stock provider returned ${response.status}. Check your setup or retry later.`);
          const data = normalize(await response.json(), endpoint, Boolean(config2.gateway));
          writeCache(cacheKey, data);
          return data;
        } finally {
          clearTimeout(timeout);
        }
      })();
      pending.set(cacheKey, task);
      return task.finally(() => pending.delete(cacheKey));
    }
    async function getStockData(symbol) {
      if (!config.gateway && !config.key) throw new Error("Configure apiKey or gatewayUrl.");
      const [quote, profile] = await Promise.all([
        request(symbol, "quote", config),
        request(symbol, "profile", config).catch(() => null)
      ]);
      return { ...quote, profile };
    }
    return { getStockData, configured: Boolean(config.gateway || config.key) };
  }

  // src/inline-stocks.js
  var SELECTORS = {
    content: "[data-post-content], .gh-content, .c-content, .post-content, .post-full-content",
    ignored: "a, code, pre, script, style, textarea, button, input, select, svg, h1, h2, h3, h4, h5, h6, [contenteditable], [data-inline-stock], [data-stock-inline], .kg-bookmark-card, .kg-embed-card, .kg-signup-card, .kg-header-card, .kg-product-card, .kg-file-card, .kg-audio-card, .kg-video-card"
  };
  var SYMBOL_PATTERN = /(?<![\w$])\$([A-Z]{1,5})(?![\w$]|[.:-][A-Za-z0-9])/g;
  function renderQuote(element, symbol, { price, changePercent, profile }) {
    if (!element.isConnected) return;
    element.textContent = "";
    if (profile?.logo && /^https:\/\//i.test(profile.logo)) {
      const logo = document.createElement("img");
      logo.className = "inline-stock__logo";
      logo.alt = "";
      logo.width = 20;
      logo.height = 20;
      logo.loading = "lazy";
      logo.decoding = "async";
      logo.addEventListener("error", () => {
        logo.style.visibility = "hidden";
      }, { once: true });
      logo.src = profile.logo;
      element.append(logo);
    } else {
      const space = document.createElement("span");
      space.className = "inline-stock__logo";
      space.setAttribute("aria-hidden", "true");
      element.append(space);
    }
    const label = document.createElement("span");
    label.className = "inline-stock__label";
    label.textContent = `${symbol} $${price.toFixed(2)}`;
    const change = document.createElement("span");
    change.className = `inline-stock__change inline-stock__change--${changePercent >= 0 ? "positive" : "negative"}`;
    change.textContent = `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%`;
    element.append(label, document.createTextNode(" "), change);
    element.title = `${symbol} $${price.toFixed(2)} ${change.textContent}`;
  }
  function replaceSymbols(node, provider, owned2) {
    const text = node.textContent;
    const matches = [...text.matchAll(SYMBOL_PATTERN)];
    if (!matches.length) return;
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    for (const match of matches) {
      const [original, symbol] = match;
      fragment.append(document.createTextNode(text.slice(lastIndex, match.index)));
      const element = document.createElement("span");
      element.setAttribute("data-inline-stock", "");
      element.className = "inline-stock";
      element.textContent = original;
      owned2.set(element, original);
      fragment.append(element);
      void provider.getStockData(symbol).then((data) => {
        if (owned2.has(element)) renderQuote(element, symbol, data);
      }).catch(() => {
      });
      lastIndex = match.index + original.length;
    }
    fragment.append(document.createTextNode(text.slice(lastIndex)));
    node.replaceWith(fragment);
  }
  var owned = /* @__PURE__ */ new Map();
  function init({ root = document, selector, gatewayUrl = "", apiKey = "" } = {}) {
    if (!document.body?.classList.contains("post-template")) return;
    const provider = createStockProvider({ gatewayUrl, apiKey });
    if (!provider.configured) return;
    const contentSelector = selector || SELECTORS.content;
    const contents = root.matches?.(contentSelector) ? [root] : [...root.querySelectorAll(contentSelector)];
    for (const content of contents) {
      const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => node.parentElement?.closest(SELECTORS.ignored) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
      });
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach((node) => replaceSymbols(node, provider, owned));
    }
  }
  function destroy() {
    for (const [element, original] of owned) {
      if (element.isConnected) element.replaceWith(document.createTextNode(original));
    }
    owned.clear();
  }

  // src/browser.js
  var script = document.currentScript;
  var options = {
    selector: script?.dataset.inlineStocksSelector,
    gatewayUrl: script?.dataset.inlineStocksGateway || window.aspireGatewayUrl || "",
    apiKey: script?.dataset.inlineStocksKey || window.finnhubApiKey || ""
  };
  window.InlineStocks = { version: "1.0.1", init: (overrides) => init({ ...options, ...overrides }), destroy };
  async function start() {
    if (!document.body?.classList.contains("post-template")) return;
    if (!options.gatewayUrl && !options.apiKey) return;
    if (script?.src && script.dataset.inlineStocksStyles !== "false") {
      const href = new URL("inline-stocks.css", script.src).href;
      let link = [...document.querySelectorAll('link[rel="stylesheet"]')].find((link2) => link2.href === href);
      if (!link?.sheet) {
        const ready = new Promise((resolve) => {
          if (!link) {
            link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = href;
          }
          link.addEventListener("load", () => resolve(true), { once: true });
          link.addEventListener("error", () => resolve(false), { once: true });
        });
        if (!link.isConnected) document.head.append(link);
        if (!await ready) return;
      }
    }
    window.InlineStocks.init();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
