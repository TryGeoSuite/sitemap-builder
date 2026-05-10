# Changelog

All notable changes to `@geosuite/sitemap-builder` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-05-10

### Added

- Per-page `<lastmod>` in the rendered sitemap, parsed from the
  origin's `Last-Modified` HTTP response header. Pages whose origin
  doesn't send the header simply skip the `<lastmod>` element. Format
  is `YYYY-MM-DD` — concise and within the sitemaps.org spec.
- `assets/logo.svg` — shared GeoSuite Open mark; rendered as the README
  hero. Monochrome on transparent, uses `currentColor`.
- `.github/workflows/publish.yml` — runs lint+tests, verifies that the
  pushed `v*` tag matches `package.json`'s `version`, then publishes
  to npm with provenance.
- `src/ai.js` — optional LLM helper (auto-detects `OPENAI_API_KEY` /
  `ANTHROPIC_API_KEY`, native `fetch`, no third-party SDK).
- `--ai` CLI flag — when combined with `--json`, the output is augmented
  with a `categories` map produced by the LLM. Categories are open
  vocabulary: the model picks short labels based on what the site
  publishes, instead of a closed taxonomy. No effect on XML output.

### Notes on privacy and cost

- AI mode is **opt-in**. Without `--ai`, the CLI behaves exactly as 0.1.0.
- We send only `{url, title, depth}` per crawled page — never page bodies.
- A typical 200-page run stays well under a cent on small models
  (`gpt-5-mini`, `claude-haiku-4-5`).

## [0.1.0] - 2026-05-10

### Added

- BFS crawler with same-origin scope, depth + page count + wall-clock
  budget caps, and a small concurrency pool.
- `renderSitemapXml(entries)` — minimal sitemaps.org-compliant output
  (`<loc>` + optional `<lastmod>`).
- CLI `geosuite-sitemap-builder` with `--max-pages`, `--max-depth`,
  `--concurrency`, `--timeout-ms`, `--budget-s`, `--output`, `--json`,
  `--user-agent` flags.
- Pure-function tests for sitemap rendering and crawler internals; no
  network or large fixtures.
