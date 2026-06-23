<p align="center"><img src="./assets/logo.svg" alt="GeoSuite Open" width="72"></p>

# sitemap-builder

> A small, zero-runtime-dependency Node CLI that crawls a website and emits a
> valid `sitemap.xml`. For sites that ship without one or whose CMS pipeline
> forgot to.
>
> Created and invented by **[Matteo Perino](https://github.com/matte97p)** ([LinkedIn](https://www.linkedin.com/in/matteo-perino-27642016b/)). Maintained by [GeoSuite(Matteo Perino)](https://trygeosuite.it).

[![CI](https://github.com/TryGeoSuite/sitemap-builder/actions/workflows/ci.yml/badge.svg)](https://github.com/TryGeoSuite/sitemap-builder/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@geosuite/sitemap-builder.svg)](https://www.npmjs.com/package/@geosuite/sitemap-builder)
[![npm downloads](https://img.shields.io/npm/dm/@geosuite/sitemap-builder.svg)](https://www.npmjs.com/package/@geosuite/sitemap-builder)
[![GitHub stars](https://img.shields.io/github/stars/TryGeoSuite/sitemap-builder?style=flat&logo=github)](https://github.com/TryGeoSuite/sitemap-builder/stargazers)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## What this is, and why it exists

A `sitemap.xml` is the foundational discovery surface for both classical
search and the new generation of LLM-mediated search (ChatGPT Search, Perplexity, Gemini, Le Chat, DuckAssist). Without one, crawlers fall back to following links from the homepage — which is unreliable for big sites and silently misses anything not internally linked from the front page.

Most CMS templates ship with a sitemap. Most custom sites don't. This tool
exists for the second case: point it at a URL, get back a sitemap that is
ready to publish at `<your-domain>/sitemap.xml`.

We deliberately did **not** build a "next-gen", LLM-powered, schema-aware
crawler. It crawls. It writes XML. The whole tool is ~250 lines of vanilla
Node with no third-party runtime dependencies.

---

## Install

```bash
npm install -g @geosuite/sitemap-builder
# or run without installing:
npx @geosuite/sitemap-builder https://example.com
```

Requires Node 20+.

---

## Use it

```bash
# print sitemap to stdout
geosuite-sitemap-builder https://example.com

# write to a file
geosuite-sitemap-builder https://example.com --output sitemap.xml

# bound the crawl
geosuite-sitemap-builder https://example.com \
  --max-pages 300 \
  --max-depth 3 \
  --concurrency 8 \
  --budget-s 90

# dump the page list as JSON instead of XML (handy for piping)
geosuite-sitemap-builder https://example.com --json
```

### Options

| Flag | Default | Notes |
|---|---|---|
| `--max-pages` | 200 | Hard cap 1000. Crawler stops once reached. |
| `--max-depth` | 3 | Hard cap 6. BFS depth from the start URL. |
| `--concurrency` | 6 | Parallel HTTP fetches. Hard cap 16. Respect the host. |
| `--timeout-ms` | 8000 | Per-page request timeout. |
| `--budget-s` | 60 | Wall-clock cap. Crawl stops when reached and reports `hitDeadline`. |
| `--output PATH` | — | Write XML to a file. Without this, XML goes to stdout. |
| `--json` | off | Print the page list as JSON instead of XML. |
| `--user-agent` | `geosuite-sitemap-builder/0.1.0` | Override the UA header. |

---

## What it actually does

1. Starts at the URL you pass.
2. BFS-crawls **same-origin** `<a href>` links only (never wanders off the host).
3. Drops obvious non-HTML extensions (`.png`, `.css`, `.pdf`, …) so the
   sitemap doesn't get polluted with assets.
4. Skips fragment-only links (`#section`), `mailto:`, `tel:`, and `javascript:`.
5. Stops at any of three caps (whichever fires first):
   - page count (`--max-pages`)
   - BFS depth (`--max-depth`)
   - wall-clock budget (`--budget-s`)
6. Renders the discovered URLs as a sitemaps.org-compliant `<urlset>`.

The output is intentionally minimal: `<loc>` plus an optional `<lastmod>`. We
skip `<changefreq>` and `<priority>` — the spec deprecates them and the major
search engines have ignored them for years.

---

## What it doesn't do (yet)

- **JavaScript rendering**. The crawler is HTTP + regex. Single-page apps
  whose links only appear after client-side hydration won't be discovered.
  Build-time pre-rendering or an SSR layer is the right fix.
- **Robots.txt awareness**. By default the tool runs against the site
  owner's own domain and honoring `robots.txt` would silently strip the
  pages they want to publish. (Adding an opt-in `--respect-robots` flag is
  on the roadmap.)
- **`<lastmod>` accuracy**. Today we don't fill `<lastmod>` from `Last-Modified`
  response headers. Coming in 0.2.
- **LLM-powered grouping or summaries**. The deterministic 0.1 ships without
  a network dependency on any model. An opt-in `--ai` mode is on the
  roadmap (provide `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` to enable).

---

## Programmatic API

```js
import { crawlSite, renderSitemapXml } from '@geosuite/sitemap-builder';

const { pages, hitCap, hitDeadline } = await crawlSite('https://example.com', {
  maxPages: 100,
  maxDepth: 2,
  concurrency: 6,
  perPageTimeoutMs: 8000,
  deadlineMs: Date.now() + 30_000,
});

const xml = renderSitemapXml(pages.map((p) => ({ url: p.url })));
```

Both functions are pure (modulo the obvious network I/O for `crawlSite`)
and have no third-party runtime dependencies.

---

## Test

```bash
npm test                  # node --test
npm run lint              # node --check on source files
```

Tests are pure-function: no network, no fixtures bigger than inline
strings.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Issues and PRs welcome — please
open an issue first for non-trivial changes so we can discuss scope.

---

## AI mode (opt-in, 0.2+)

When combined with `--json`, the CLI can ask an LLM to group the
discovered pages into open-vocabulary categories ("Blog", "Products",
"Docs", whatever the site actually publishes — no closed taxonomy):

```bash
export OPENAI_API_KEY=sk-…       # or ANTHROPIC_API_KEY=sk-ant-…
geosuite-sitemap-builder https://example.com --json --ai
```

The output JSON is the same shape as without `--ai`, plus a `categories`
field:

```json
{
  "pages": [...],
  "hitCap": false,
  "hitDeadline": false,
  "categories": {
    "Marketing": ["https://example.com/", "https://example.com/pricing"],
    "Blog":      ["https://example.com/blog/post-one", ...],
    "Docs":      ["https://example.com/docs/intro", ...]
  }
}
```

We send only `{url, title, depth}` per page — never the body. A typical
200-page run stays well under a cent on small models (`gpt-5-mini`,
`claude-haiku-4-5`). No effect on the XML output (`--ai` is ignored
unless `--json` is also passed).

Privacy: enabling `--ai` sends content to the corresponding API. Don't
turn it on against URLs you wouldn't paste into their UI.

---

## Related: GeoSuite open-source tools

`sitemap-builder` is part of a small family of zero-dependency CLIs we
maintain to make Generative Engine Optimization (GEO) measurable from
the terminal:

- [`@geosuite/ai-crawler-bots`](https://github.com/TryGeoSuite/ai-crawler-bots) — curated AI bot user-agent list with a CLI that tells you whether GPTBot, ClaudeBot, PerplexityBot and friends can read your site and where the block came from.
- [`@geosuite/schema-templates`](https://github.com/TryGeoSuite/schema-templates) — copy-paste-ready schema.org JSON-LD templates with a local validator.
- [`@geosuite/llms-txt-generator`](https://github.com/TryGeoSuite/llms-txt-generator) — turn a `sitemap.xml` into the `llms.txt` standard from [llmstxt.org](https://llmstxt.org/).

The same checks are also surfaced as a hosted product at
[trygeosuite.it](https://trygeosuite.it) for teams who want history,
alerts, and CTAs wired into their content pipeline.

---

## Creator

**Created and invented by [Matteo Perino](https://github.com/matte97p)** — [LinkedIn](https://www.linkedin.com/in/matteo-perino-27642016b/) · [matte97.p@gmail.com](mailto:matte97.p@gmail.com).

Ideated, designed and validated by Matteo Perino. Implementation written with AI assistance, maintained under GeoSuite.

---

## License

[MIT](LICENSE) © 2026 Matteo Perino and GeoSuite

## Related tools — the GeoSuite GEO toolkit

- [ai-crawler-bots](https://github.com/TryGeoSuite/ai-crawler-bots) — which AI crawlers can read your site (robots.txt audit + CI gate)
- [llms-txt-generator](https://github.com/TryGeoSuite/llms-txt-generator) — sitemap.xml → llms.txt (the llmstxt.org standard)
- [schema-templates](https://github.com/TryGeoSuite/schema-templates) — validated, copy-paste schema.org JSON-LD
- [sitemap-builder](https://github.com/TryGeoSuite/sitemap-builder) — crawl a site, emit a valid sitemap.xml

Also from the same author: [rlsgrid](https://github.com/matte97p/rlsgrid) · [pentest-framework](https://github.com/matte97p/pentest-framework) · [demowright](https://github.com/matte97p/demowright)

---

⭐ If `sitemap-builder` is useful, [give it a star](https://github.com/TryGeoSuite/sitemap-builder) — it helps other people find the toolkit.
