# Ghost Inline Stocks

Add a stock's price and percentage change beside symbols such as `$AAPL` in your Ghost posts. The script is free.

The [Siwa](https://aspirethemes.com/themes/siwa) and [Taba](https://aspirethemes.com/themes/taba) Ghost themes already include inline stocks. If you use either theme, follow its stock setup instructions instead.

## Get a Finnhub Key

Finnhub supplies the quotes. Its API key is a code that lets the script request them.

1. Create or log in to your [Finnhub account](https://finnhub.io/register).
2. Copy your API key from the [dashboard](https://finnhub.io/dashboard).
3. Check Finnhub's [plans and limits](https://finnhub.io/pricing) for the stocks you want to show and permission to publish their quotes.

## Choose a Setup

### Direct Setup

This is the quickest option. Anyone who views your site's code can see your Finnhub key.

In Ghost, open **Settings → Advanced → Code Injection**. Paste this into **Site Header**, replace `YOUR_FINNHUB_KEY` with your key, and select **Save**:

```html
<script>
  window.finnhubApiKey = 'YOUR_FINNHUB_KEY';
</script>
```

### Cloudflare Setup (Recommended)

This keeps your key private in your [Cloudflare account](https://dash.cloudflare.com/sign-up). Your website stays where it is hosted now.

1. Open the [stock ticker setup](https://aspirethemes.com/stock-ticker/) and connect Cloudflare.
2. Enter your website address and Finnhub API key.
3. Copy the provided snippet into Ghost's **Settings → Advanced → Code Injection → Site Header**.
4. Select **Save**.

If you switch from direct setup, remove the direct-key snippet from Site Header.

## Add the Script

After either setup option, paste this into **Site Footer** and select **Save**:

```html
<script
  src="https://cdn.jsdelivr.net/gh/aspirethemes/ghost-inline-stocks@main/dist/inline-stocks.min.js"
  defer
></script>
```

## Check a Post

Write this in a normal paragraph, then preview the post:

```text
Following $AAPL and $MSFT this week.
```

Each symbol should show a price in US dollars and a percentage change. Use uppercase US stock symbols with up to five letters. Quotes load when the post opens; they do not update continuously. The script works on Ghost post pages, not other page types or newsletter emails.

If a symbol stays unchanged, check your saved snippets, symbol, and Finnhub key. After a provider limit, wait a minute and reload. For Cloudflare setup, enter the same website address readers visit.

[Contact Aspire Themes](https://aspirethemes.com/contact) if you need help. Include the post's address and symbol, but keep your API key private.

To remove the feature, delete the script from Site Footer and save. Your original post text stays intact.

For custom themes, styling, or development, see the [developer reference](docs/technical-reference.md).

MIT © Aspire Themes. See [LICENSE](LICENSE).
