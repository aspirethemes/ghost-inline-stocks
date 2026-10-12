const pending = new Map();
export function createStockProvider({gatewayUrl = "", apiKey = ""} = {}) {
  const config = {gateway: gatewayUrl.trim().replace(/\/+$/, ""), key: apiKey.trim()};
  const cacheDurations = { quote: 60_000, profile: 86_400_000 };

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
      // Quotes still work when storage is unavailable.
    }
  }

  function normalize(data, endpoint, gateway) {
    if (endpoint === 'profile') {
      return { name: typeof data?.name === 'string' ? data.name : '', logo: typeof data?.logo === 'string' ? data.logo : '' };
    }

    const price = gateway ? data?.price : data?.c;
    const changePercent = gateway ? data?.changePercent : data?.dp;
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(changePercent)) {
      throw new Error('No quote available. Check the symbol and your provider access.');
    }
    return { price, changePercent };
  }

  function request(symbol, endpoint, config) {
    const cacheKey = `inline-stocks:v1:${config.gateway || 'finnhub'}:${endpoint}:${symbol}`;
    const cached = readCache(cacheKey, cacheDurations[endpoint]);
    if (cached) {
      try {
        return Promise.resolve(normalize(cached, endpoint, true));
      } catch {
        // Replace malformed stored quotes with a fresh response.
      }
    }
    if (pending.has(cacheKey)) return pending.get(cacheKey);

    const task = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        let url;
        const options = { signal: controller.signal, credentials: 'omit' };
        if (config.gateway) {
          url = new URL(`${config.gateway}/finnhub`);
          options.method = 'POST';
          options.headers = { 'Content-Type': 'application/json' };
          options.body = JSON.stringify({ symbol, ...(endpoint === 'profile' ? { endpoint } : {}) });
        } else {
          url = new URL(`https://finnhub.io/api/v1/${endpoint === 'profile' ? 'stock/profile2' : 'quote'}`);
          url.searchParams.set('symbol', symbol);
          url.searchParams.set('token', config.key);
        }
        if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Check the stock gateway URL.');
        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`Stock provider returned ${response.status}. Check your setup or retry later.`);
        const data = normalize(await response.json(), endpoint, Boolean(config.gateway));
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
    if (!config.gateway && !config.key) throw new Error('Configure apiKey or gatewayUrl.');
    const [quote, profile] = await Promise.all([
      request(symbol, 'quote', config),
      request(symbol, 'profile', config).catch(() => null)
    ]);
    return { ...quote, profile };
  }

  return { getStockData, configured: Boolean(config.gateway || config.key) };
}
