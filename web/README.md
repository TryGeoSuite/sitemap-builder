# Sitemap Builder — hosted tool

A [Cloudflare Worker](https://developers.cloudflare.com/workers/) that puts
[`sitemap-builder`](../) on the web: paste a URL, it crawls the site and returns
a sitemaps.org-compliant `sitemap.xml` to copy or download.

- `GET /` — the page (`page.js`), bilingual **en/it** (auto-detected from `Accept-Language`; `/en` · `/it` force a locale)
- `GET /og.png` · `GET /favicon.png` (also `/favicon.ico`, `/favicon.svg`, `/apple-touch-icon.png`) — Open Graph share image (1200×630) + GeoSuite's favicon
- `GET /logos/{chatgpt,gemini,perplexity}.svg` — engine logos for the call to action
- `GET /api/crawl?url=https://example.com`: `{ site, count, capped, hitDeadline, xml }`

> **Same crawler as the CLI and the platform.** The Worker runs the package's
> `crawlSite()` (`src/crawler.js`, platform `fetch`) and `renderSitemapXml()`
> with the GeoSuite platform's settings: depth 3, 6 parallel fetches, 6 s per
> page, 25 s budget. The one difference is the page cap, 40, to stay under the
> Workers subrequest limit: the platform's Sitemap Builder with "Max pages" 40
> returns the same file. **For a bigger crawl, use the CLI:**
> `npx @geosuite/sitemap-builder <url>`.

## Run locally

```bash
cd web
npx wrangler dev
# open http://localhost:8787
```

## Deploy

```bash
cd web
npx wrangler deploy
```

⚠️ Deploy to your **personal / GeoSuite** Cloudflare account, not the work one
(`wrangler whoami` to check). Publishes to
`https://sitemap-builder.<your-subdomain>.workers.dev`.

## Auto-deploy (CI)

[`.github/workflows/deploy-web.yml`](../.github/workflows/deploy-web.yml)
redeploys on every push to `main` touching `web/` or `src/`. Add two
repo secrets (Settings → Secrets and variables → Actions):

- `CLOUDFLARE_API_TOKEN` — token scoped **Edit Cloudflare Workers** from the
  account that owns the Worker.
- `CLOUDFLARE_ACCOUNT_ID` — that account's id.

## Notes

- Zero deps, no `nodejs_compat`: the crawler and the robots checker use the
  platform `fetch` only.
- This directory is **not** part of the npm package, so it never ships to
  registry consumers.
