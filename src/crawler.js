// Internal-only BFS crawler. Starts at `origin`, follows same-host <a href>
// links up to a depth and page cap, returns the de-duplicated set of
// reachable URLs.
//
// Politeness:
//   - same-origin only (never wanders off the host)
//   - User-Agent identifies the tool
//   - small concurrency cap (caller decides)
//   - per-page timeout via AbortController
//   - hard time budget (caller-enforced via Date-based deadline)
//   - skips obvious non-html / asset extensions
//
// `respectRobots` is opt-in: by default the tool runs against the site
// owner's own domain so honoring robots.txt would silently strip the very
// pages they want to publish. Public-facing crawls should flip it on.

import http from 'node:http';
import https from 'node:https';
import { loadRobotsChecker } from './robots.js';

const DEFAULT_USER_AGENT =
  'geosuite-sitemap-builder/0.3.0 (+https://trygeosuite.it)';

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_PAGES = 200;
const DEFAULT_MAX_DEPTH = 3;
const DEFAULT_CONCURRENCY = 6;

const ASSET_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp',
  '.css', '.js', '.mjs', '.map',
  '.pdf', '.zip', '.tar', '.gz', '.7z', '.rar',
  '.mp3', '.mp4', '.mov', '.avi', '.webm', '.wav',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.xml', '.json', '.txt',
]);

const HREF_RE = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi;

/**
 * @typedef {Object} CrawledPage
 * @property {string} url        Final URL (after dropping hash).
 * @property {number} depth      BFS depth (0 = start URL).
 * @property {number} status     HTTP status code that returned this page.
 * @property {string|null} title HTML <title> if discovered.
 * @property {string|null} [lastModified] YYYY-MM-DD parsed from the
 *   response's Last-Modified header (when the origin sends one).
 */

/**
 * @typedef {Object} CrawlOptions
 * @property {number} [maxPages]
 * @property {number} [maxDepth]
 * @property {number} [concurrency]
 * @property {number} [perPageTimeoutMs]
 * @property {number} [deadlineMs]   Wall-clock time (Date.now() + budget).
 * @property {string} [userAgent]
 * @property {boolean} [respectRobots]  When true, fetch /robots.txt and skip
 *   paths disallowed for User-Agent *.
 */

/**
 * Crawl an origin starting at `startUrl` and return discovered pages.
 *
 * @param {string} startUrl
 * @param {CrawlOptions} [opts]
 * @returns {Promise<{ pages: CrawledPage[], hitCap: boolean, hitDeadline: boolean }>}
 */
export async function crawlSite(startUrl, opts = {}) {
  const start = normalizeUrl(startUrl);
  if (!start) throw new Error(`Invalid start URL: ${startUrl}`);

  const origin = `${start.protocol}//${start.host}`;
  const maxPages = clamp(opts.maxPages ?? DEFAULT_MAX_PAGES, 1, 1000);
  const maxDepth = clamp(opts.maxDepth ?? DEFAULT_MAX_DEPTH, 0, 6);
  const concurrency = clamp(opts.concurrency ?? DEFAULT_CONCURRENCY, 1, 16);
  const timeoutMs = opts.perPageTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const deadline = opts.deadlineMs ?? Number.POSITIVE_INFINITY;
  const userAgent = opts.userAgent ?? DEFAULT_USER_AGENT;

  const isAllowed = opts.respectRobots
    ? await loadRobotsChecker(origin, { timeoutMs, userAgent })
    : () => true;

  /** @type {Map<string, CrawledPage>} */
  const visited = new Map();
  /** @type {{ url: string, depth: number }[]} */
  const startPath = start.pathname || '/';
  const queue = isAllowed(startPath) ? [{ url: start.href, depth: 0 }] : [];
  let hitCap = false;
  let hitDeadline = false;

  // Workers pull jobs from the shared `queue`. Stops when queue is empty
  // and no worker is in-flight, or when caps/deadline trip.
  let inFlight = 0;
  const workers = [];

  for (let i = 0; i < concurrency; i++) {
    workers.push((async () => {
      while (true) {
        if (visited.size >= maxPages) { hitCap = true; return; }
        if (Date.now() >= deadline) { hitDeadline = true; return; }
        const job = queue.shift();
        if (!job) {
          if (inFlight === 0) return;
          await sleep(20);
          continue;
        }
        if (visited.has(job.url)) continue;
        if (visited.size >= maxPages) { hitCap = true; return; }

        inFlight++;
        try {
          const result = await fetchHtml(job.url, { timeoutMs, userAgent });
          if (!result) continue;
          visited.set(job.url, {
            url: job.url,
            depth: job.depth,
            status: result.status,
            title: result.title,
            lastModified: result.lastModified ?? null,
          });
          if (job.depth >= maxDepth) continue;
          for (const link of extractInternalLinks(result.body, job.url, origin)) {
            if (visited.has(link)) continue;
            const linkPath = new URL(link).pathname;
            if (!isAllowed(linkPath)) continue;
            queue.push({ url: link, depth: job.depth + 1 });
          }
        } catch {
          // Per-page errors are swallowed — the crawler is best-effort.
        } finally {
          inFlight--;
        }
      }
    })());
  }

  await Promise.all(workers);

  // Stable sort: depth asc, then path lexicographic. Mirrors the typical
  // "homepage first, then sections" ordering search engines prefer.
  const pages = [...visited.values()].sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth;
    return a.url.localeCompare(b.url);
  });

  return { pages, hitCap, hitDeadline };
}

// --- helpers ---------------------------------------------------------------

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || min));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Strip the fragment, lowercase the host, drop trailing single slashes that
 * would otherwise dedupe weirdly. Keeps everything else intact.
 *
 * @returns {URL | null}
 */
export function normalizeUrl(input) {
  try {
    const u = new URL(input);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    u.hash = '';
    u.hostname = u.hostname.toLowerCase();
    // Drop a default-port suffix.
    if ((u.protocol === 'http:' && u.port === '80') || (u.protocol === 'https:' && u.port === '443')) {
      u.port = '';
    }
    return u;
  } catch {
    return null;
  }
}

function isAssetPath(pathname) {
  const lastDot = pathname.lastIndexOf('.');
  if (lastDot < 0) return false;
  const ext = pathname.slice(lastDot).toLowerCase();
  return ASSET_EXT.has(ext);
}

function extractInternalLinks(html, currentUrl, origin) {
  const found = new Set();
  for (const match of html.matchAll(HREF_RE)) {
    const raw = match[1];
    if (!raw || raw.startsWith('#')) continue;
    if (raw.startsWith('mailto:') || raw.startsWith('tel:') || raw.startsWith('javascript:')) continue;
    const resolved = (() => {
      try { return new URL(raw, currentUrl); } catch { return null; }
    })();
    if (!resolved) continue;
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') continue;
    if (`${resolved.protocol}//${resolved.host}` !== origin) continue;
    if (isAssetPath(resolved.pathname)) continue;
    resolved.hash = '';
    found.add(resolved.href);
  }
  return [...found];
}

/**
 * @returns {Promise<{ status: number, body: string, title: string | null } | null>}
 */
function fetchHtml(url, { timeoutMs, userAgent }) {
  const parsed = (() => { try { return new URL(url); } catch { return null; } })();
  if (!parsed) return Promise.resolve(null);
  const lib = parsed.protocol === 'https:' ? https : http;
  return new Promise((resolve) => {
    const req = lib.request(
      {
        method: 'GET',
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: `${parsed.pathname || '/'}${parsed.search || ''}`,
        headers: {
          'User-Agent': userAgent,
          Accept: 'text/html, */*',
          'Accept-Encoding': 'identity',
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const ctype = String(res.headers['content-type'] || '').toLowerCase();
        const lastModified = parseLastModified(res.headers['last-modified']);
        if (status < 200 || status >= 300 || !ctype.includes('html')) {
          res.resume();
          resolve({ status, body: '', title: null, lastModified });
          return;
        }
        let buffered = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          buffered += chunk;
          // Cap the buffer at ~512 KB — sitemap building doesn't need more.
          if (buffered.length > 512 * 1024) {
            res.destroy();
          }
        });
        res.on('end', () => {
          resolve({
            status,
            body: buffered,
            title: extractTitle(buffered),
            lastModified,
          });
        });
      },
    );
    req.setTimeout(timeoutMs, () => req.destroy());
    req.on('error', () => resolve(null));
    req.end();
  });
}

function extractTitle(body) {
  const match = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;
  return match[1].replace(/\s+/g, ' ').trim() || null;
}

/**
 * Parse a `Last-Modified` HTTP header into the ISO-8601 date string
 * sitemaps.org expects in `<lastmod>`. Sites serve this header in RFC
 * 1123 format (e.g. `Wed, 21 Oct 2026 07:28:00 GMT`); we accept anything
 * `Date` can parse and emit `YYYY-MM-DD`. Returns null on failure.
 *
 * @param {string | string[] | undefined} raw
 * @returns {string | null}
 */
function parseLastModified(raw) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || typeof value !== 'string') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  // Use the date part only — sitemaps.org accepts both YYYY-MM-DD and
  // full ISO timestamps; the date form is concise and avoids advertising
  // false precision.
  return parsed.toISOString().slice(0, 10);
}

export const _internals = {
  extractInternalLinks,
  normalizeUrl,
  isAssetPath,
  extractTitle,
  parseLastModified,
};
