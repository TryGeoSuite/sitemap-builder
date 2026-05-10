#!/usr/bin/env node
// CLI for @geosuite/sitemap-builder.
//
// Usage:
//   geosuite-sitemap-builder <url> [options]
//
// Options:
//   --max-pages N        Page cap (default 200, hard cap 1000)
//   --max-depth N        BFS depth cap (default 3, hard cap 6)
//   --concurrency N      Parallel fetches (default 6)
//   --timeout-ms N       Per-page timeout in ms (default 8000)
//   --budget-s N         Wall-clock budget in seconds (default 60)
//   --output PATH        Write XML to file instead of stdout
//   --json               Print the crawled page list as JSON instead of XML
//   --user-agent STRING  Override User-Agent (default geosuite-sitemap-builder/x.x.x)
//   --ai                 (0.2+) Classify pages by category in the JSON
//                        output using an LLM. Requires OPENAI_API_KEY or
//                        ANTHROPIC_API_KEY. No effect on XML output.
//   --respect-robots     (0.3+) Fetch /robots.txt and skip paths disallowed
//                        for User-Agent: *. Off by default because you
//                        typically crawl your own site.
//   --help               Show this message
//
// Exit codes: 0 on success, 1 on usage / network error.

import { writeFileSync } from 'node:fs';
import { crawlSite } from '../src/crawler.js';
import { renderSitemapXml } from '../src/sitemap.js';
import { chat, detectProvider } from '../src/ai.js';

const HELP = `geosuite-sitemap-builder <url> [options]

Crawl a website starting at <url> and emit a sitemaps.org-compliant
sitemap.xml of the discovered pages.

Options:
  --max-pages N        Page cap (default 200, max 1000)
  --max-depth N        BFS depth cap (default 3, max 6)
  --concurrency N      Parallel fetches (default 6, max 16)
  --timeout-ms N       Per-page timeout in ms (default 8000)
  --budget-s N         Wall-clock budget in seconds (default 60)
  --output PATH        Write XML to file instead of stdout
  --json               Print the crawled page list as JSON instead of XML
  --user-agent STRING  Override User-Agent
  --ai                 (0.2+) When combined with --json, group pages by
                       category using an LLM. Needs OPENAI_API_KEY or
                       ANTHROPIC_API_KEY. No effect on XML output.
  --respect-robots     (0.3+) Honour /robots.txt for User-Agent *.
                       Off by default (most users crawl their own site).
  --help               Show this message
`;

function parseArgs(argv) {
  const args = { url: null, opts: {}, output: null, json: false };
  let i = 0;
  while (i < argv.length) {
    const a = argv[i++];
    if (a === '--help' || a === '-h') return { help: true };
    if (a.startsWith('--')) {
      let key = a;
      let value;
      const eq = a.indexOf('=');
      const inline = eq > 0;
      if (inline) {
        key = a.slice(0, eq);
        value = a.slice(eq + 1);
      }
      if (key === '--json') { args.json = true; continue; }
      if (key === '--ai') { args.ai = true; continue; }
      if (key === '--respect-robots') { args.respectRobots = true; continue; }
      if (!inline) value = argv[i++];
      if (value === undefined) throw new Error(`Missing value for ${key}`);
      if (key === '--max-pages') args.opts.maxPages = Number(value);
      else if (key === '--max-depth') args.opts.maxDepth = Number(value);
      else if (key === '--concurrency') args.opts.concurrency = Number(value);
      else if (key === '--timeout-ms') args.opts.perPageTimeoutMs = Number(value);
      else if (key === '--budget-s') args.opts.deadlineMs = Date.now() + Number(value) * 1000;
      else if (key === '--output') args.output = value;
      else if (key === '--user-agent') args.opts.userAgent = value;
      else throw new Error(`Unknown option: ${key}`);

    } else if (!args.url) {
      args.url = a;
    } else {
      throw new Error(`Unexpected argument: ${a}`);
    }
  }
  return args;
}

async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`${err.message}\n\n${HELP}`);
    process.exit(1);
  }
  if (parsed.help || !parsed.url) {
    process.stdout.write(HELP);
    process.exit(parsed.help ? 0 : 1);
  }

  if (parsed.opts.deadlineMs === undefined) {
    parsed.opts.deadlineMs = Date.now() + 60_000;
  }
  if (parsed.respectRobots) parsed.opts.respectRobots = true;

  let result;
  try {
    result = await crawlSite(parsed.url, parsed.opts);
  } catch (err) {
    process.stderr.write(`crawl failed: ${err.message}\n`);
    process.exit(1);
  }

  if (parsed.json) {
    let payload = result;
    if (parsed.ai) {
      if (!detectProvider()) {
        process.stderr.write(
          '--ai requested but no LLM API key found. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.\n',
        );
      } else {
        try {
          payload = { ...result, categories: await aiClassifyPages(result.pages) };
        } catch (err) {
          process.stderr.write(`AI classification skipped: ${err.message}\n`);
        }
      }
    }
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }

  const xml = renderSitemapXml(
    result.pages.map((p) => ({
      url: p.url,
      lastmod: p.lastModified || undefined,
    })),
  );
  if (parsed.output) {
    writeFileSync(parsed.output, xml, 'utf8');
    const note = result.hitCap
      ? ' (page cap hit)'
      : result.hitDeadline
        ? ' (time budget hit)'
        : '';
    process.stderr.write(`wrote ${result.pages.length} url(s) to ${parsed.output}${note}\n`);
  } else {
    process.stdout.write(xml);
  }
}

/**
 * Send the page list (url + title + depth, no body) to the LLM and
 * receive a `{ category: [url, ...] }` mapping. Categories are open
 * vocabulary — the model picks the labels — so the output reflects what
 * the site actually publishes rather than a closed taxonomy.
 */
async function aiClassifyPages(pages) {
  if (!pages.length) return {};
  const compact = pages.map((p) => ({
    url: p.url,
    title: p.title || '',
    depth: p.depth,
  }));
  const out = await chat(
    [
      {
        role: 'system',
        content:
          'You receive a list of pages crawled from a single website. Group them by category, using short labels you choose yourself based on what the site publishes (e.g. "Blog", "Products", "Docs", "Marketing"). Return strictly a JSON object whose keys are category labels and values are arrays of the original URLs. No commentary.',
      },
      {
        role: 'user',
        content: JSON.stringify(compact, null, 2),
      },
    ],
    { maxTokens: 1500, temperature: 0.2 },
  );
  const cleaned = out.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    // fallthrough — give the operator a hint instead of breaking the run
  }
  return { _raw: cleaned };
}

main().catch((err) => {
  process.stderr.write(`fatal: ${err.message}\n`);
  process.exit(1);
});
