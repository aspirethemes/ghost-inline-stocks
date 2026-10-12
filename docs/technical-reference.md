# Developer Reference

The implementation is based on inline stocks in the Siwa and Taba Ghost themes.

Customer setup is in the [README](../README.md). Use this reference for custom themes, provider integration, styling, security policies, or development.

## Custom Ghost Themes

The script runs only on Ghost post pages. Home, tag, author and page templates remain unchanged. It uses Ghost's `post-template` body class to identify posts and recognizes common article content wrappers.

If your Ghost theme uses a different article wrapper, set `data-inline-stocks-selector=".article-body"` on the script. Replace `.article-body` with your theme's content selector. This setting does not enable the script on other page types.

## Advanced Provider Configuration

Script attributes `data-inline-stocks-key` and `data-inline-stocks-gateway` are alternatives to the global setup values. The library requires your own [Finnhub](https://finnhub.io/) access. Quotes use its [quote API](https://finnhub.io/docs/api/quote); optional logos use the [company profile API](https://finnhub.io/docs/api/company-profile2). Supported symbols, data availability, rate limits, delays and redistribution rights depend on your provider plan. Verify these before publishing market data.

A compatible gateway accepts JSON at `POST <base URL>/finnhub`:

| Request | Response |
| --- | --- |
| `{ "symbol": "AAPL" }` | `{ "price": 150, "changePercent": 1.2 }` |
| `{ "symbol": "AAPL", "endpoint": "profile" }` | `{ "name": "Apple", "logo": "https://…" }` |

Allow the publication origin and JSON preflight requests. If both a gateway and direct key are configured, only the gateway is used, including after failure.

## Behavior

- Supports uppercase one-to-five-letter US symbols. Exchange suffixes and dotted symbols are left alone.
- Skips headings, links, code, forms, editable content and Ghost embed/editor cards.
- Shows USD prices and signed percentage changes, with optional HTTPS logos.
- Reserves a fixed-size quote box at initialization, keeping the original symbol readable while loading and after failed quotes. Prices and optional logos do not change that box’s dimensions. Long prices truncate visually; the full quote is available in the tooltip.
- The browser bundle waits for its stylesheet before initialization. Failed styles leave the original post untouched. Initial insertion can still reflow a post if the script initializes after the page has painted; this does not promise zero layout shift from a late installation. Missing profiles do not block prices.
- Caches quotes for one minute and profiles for one day. Repeated symbols share requests. Blocked local storage does not prevent loading.
- Requests time out after ten seconds. Prices update on initialization; there is no background polling.
- Reads only content already present on the page. It does not bypass membership access.
- Sends symbol requests to your selected provider. It uses no analytics or cookies; local storage holds cached public quote/profile data.

## API

The browser script exposes `window.InlineStocks`:

```js
InlineStocks.init({root: document.querySelector('.new-article')});
InlineStocks.destroy(); // Restore the original symbols, including pending quotes.
```

`init()` accepts `root`, `selector`, `apiKey` and `gatewayUrl`. Repeated calls do not duplicate chips. Call it after adding dynamic content; there is no automatic DOM observer. On missing configuration it does nothing. Invalid CSS selectors throw a standard browser error.

For an ES module integration, import `init` and `destroy` from `dist/inline-stocks.module.js` and load `dist/inline-stocks.css` yourself.

## Appearance and Content Security Policy

Chips use their own class names and default colors. Override these CSS variables on the article:

```css
.article-body {
  --inline-stock-background: #f3f4f6;
  --inline-stock-color: #111827;
  --inline-stock-border: #d1d5db;
  --inline-stock-positive: #166534;
  --inline-stock-negative: #b91c1c;
}
```

A Content Security Policy (CSP) is a site policy that controls which scripts, styles, requests, and images can load.

Set `data-inline-stocks-styles="false"` to load the CSS yourself. With a Content Security Policy, allow your asset origin in `script-src` and `style-src`, your provider in `connect-src`, and provider logo origins in `img-src` (or block logos). No inline style injection is required.

## Develop

```sh
npm ci
npm test
npm run build
```

`examples/index.html` is a deterministic preview with mocked quote responses; it does not need a key. Serve the project directory over HTTP to view it. The preview's mocks are never included in built files.

Built files include plain and minified browser scripts, an ES module and CSS. The installation snippet loads the current `main` branch. This project is distributed through GitHub and jsDelivr; it is not published to npm.

MIT © Aspire Themes

## Setup Updates

The Cloudflare setup snippet sets `window.aspireGatewayUrl`. Keep the address supplied by the setup rather than using an example address. After switching from direct setup, remove the direct-key snippet. The library uses Cloudflare when both settings are present, including after a gateway failure.

Run the setup again with the same Cloudflare account to connect another website or update the Finnhub key. Previously connected sites remain connected and share the key entered. The setup does not move website hosting or DNS to Cloudflare.

## Distribution

For self-hosting, copy the built files in `dist/` to a public directory. The browser script loads `inline-stocks.css` from its own directory unless automatic styles are disabled.
