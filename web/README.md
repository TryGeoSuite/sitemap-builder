# Sitemap Builder — hosted tool

A [Cloudflare Worker](https://developers.cloudflare.com/workers/) that puts
[`sitemap-builder`](../) on the web: paste a URL, it crawls the site and returns
a sitemaps.org-compliant `sitemap.xml` to copy or download.

- `GET /` — the page (`page.js`), bilingual **en/it** (auto-detected from `Accept-Language`; `/en` · `/it` force a locale)
- `GET /og.png` · `GET /favicon.svg` — Open Graph share image (1200×630) + favicon
- `GET /api/crawl?url=https://example.com` — `{ site, count, capped, xml }`

> ⚠️ **Capped edge version.** The crawl is a small BFS (≤40 pages, depth ≤2)
> with the platform `fetch`, to stay under the Workers subrequest/time limits.
> The package's full crawler (`src/crawler.js`) uses `node:http` and isn't
> Worker-compatible, so the crawl is reimplemented here and only the pure
> `renderSitemapXml()` is reused. **For a complete crawl, use the CLI:**
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
redeploys on every push to `main` touching `web/` or `src/sitemap.js`. Add two
repo secrets (Settings → Secrets and variables → Actions):

- `CLOUDFLARE_API_TOKEN` — token scoped **Edit Cloudflare Workers** from the
  account that owns the Worker.
- `CLOUDFLARE_ACCOUNT_ID` — that account's id.

## Notes

- Zero deps, no `nodejs_compat`. The crawl uses the platform `fetch`; only
  `renderSitemapXml()` is imported from the package.
- This directory is **not** part of the npm package, so it never ships to
  registry consumers.
