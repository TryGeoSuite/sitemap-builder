// Internal-only BFS crawler. Starts at `origin`, follows same-host <a href>
// links up to a depth and page cap, returns the de-duplicated set of
// reachable URLs.
//
// Politeness:
//   - same-origin only (never wanders off the host)
//   - User-Agent identifies the tool
//   - small concurrency cap (caller decides)
//   - per-page timeout via AbortSignal
//   - hard time budget (caller-enforced via Date-based deadline)
//   - skips obvious non-html / asset extensions
//
// `respectRobots` is opt-in: by default the tool runs against the site
// owner's own domain so honoring robots.txt would silently strip the very
// pages they want to publish. Public-facing crawls should flip it on.
//
// It uses the platform `fetch`, so the same code runs in the CLI (Node 20+)
// and in the hosted Worker (web/worker.js). The GeoSuite platform crawls with
// the same rules in Python (backend/services/tools/sitemap_builder_service.py);
// both run the cases in test/fixtures/golden-sitemap.json:
//   - redirects are followed and the page is listed at its final URL; when the
//     start URL redirects to another host (example.com -> www.example.com) the
//     crawl continues on that host;
//   - only 2xx HTML pages go in the sitemap (a 404 or a PDF does not);
//   - links are read from <a href> only, `&amp;` decoded, normalized (lowercase
//     host, no default port, no fragment, percent-encoded) and followed in
//     sorted order;
//   - pages are listed by depth, then by URL (code-point order).

import { loadRobotsChecker } from './robots.js';

const DEFAULT_USER_AGENT =
  'geosuite-sitemap-builder/0.3.0 (+https://trygeosuite.it)';

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_PAGES = 200;
const DEFAULT_MAX_DEPTH = 3;
const DEFAULT_CONCURRENCY = 6;
// Only the first 512 KB of a page are read for links and title.
const MAX_BODY_CHARS = 512 * 1024;

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
 * @property {string} url        Final URL (after redirects, without the hash).
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
 * @property {typeof fetch} [fetch]  Fetch implementation (tests pass a fake).
 */

/**
 * Crawl an origin starting at `startUrl` and return discovered pages.
 * A bare domain (`example.com`) is crawled over https.
 *
 * @param {string} startUrl
 * @param {CrawlOptions} [opts]
 * @returns {Promise<{ origin: string, pages: CrawledPage[], hitCap: boolean, hitDeadline: boolean }>}
 */
export async function crawlSite(startUrl, opts = {}) {
  const start = normalizeStartUrl(startUrl);
  if (!start) throw new Error(`Invalid start URL: ${startUrl}`);

  let origin = start.origin;
  const maxPages = clamp(opts.maxPages ?? DEFAULT_MAX_PAGES, 1, 1000);
  const maxDepth = clamp(opts.maxDepth ?? DEFAULT_MAX_DEPTH, 0, 6);
  const concurrency = clamp(opts.concurrency ?? DEFAULT_CONCURRENCY, 1, 16);
  const timeoutMs = opts.perPageTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const deadline = opts.deadlineMs ?? Number.POSITIVE_INFINITY;
  const userAgent = opts.userAgent ?? DEFAULT_USER_AGENT;
  const doFetch = opts.fetch ?? fetch;

  const isAllowed = opts.respectRobots
    ? await loadRobotsChecker(origin, { timeoutMs, userAgent, fetch: doFetch })
    : () => true;

  /** @type {Map<string, CrawledPage>} final URL -> page */
  const pages = new Map();
  /** URLs already fetched or queued for fetching (requested and final). */
  const seen = new Set();
  /** @type {{ url: string, depth: number }[]} */
  const queue = isAllowed(new URL(start.href).pathname) ? [{ url: start.href, depth: 0 }] : [];
  let hitCap = false;
  let hitDeadline = false;

  // Workers pull jobs from the shared `queue`. Stops when queue is empty
  // and no worker is in-flight, or when caps/deadline trip.
  let inFlight = 0;
  const workers = [];

  for (let i = 0; i < concurrency; i++) {
    workers.push((async () => {
      while (true) {
        if (pages.size >= maxPages) { hitCap = true; return; }
        if (Date.now() >= deadline) { hitDeadline = true; return; }
        const job = queue.shift();
        if (!job) {
          if (inFlight === 0) return;
          await sleep(20);
          continue;
        }
        if (seen.has(job.url)) continue;
        seen.add(job.url);

        inFlight++;
        try {
          const result = await fetchHtml(job.url, { timeoutMs, userAgent, doFetch });
          if (!result) continue;
          const finalUrl = normalizeUrl(result.url)?.href ?? job.url;
          const finalOrigin = new URL(finalUrl).origin;
          if (finalOrigin !== origin) {
            // The start page may move the crawl to its canonical host
            // (example.com -> www.example.com); any other page that leaves
            // the site is dropped.
            if (job.depth !== 0 || pages.size) continue;
            origin = finalOrigin;
          }
          if (finalUrl !== job.url) {
            if (seen.has(finalUrl)) continue;
            seen.add(finalUrl);
          }
          if (!result.isHtml || pages.size >= maxPages) continue;
          pages.set(finalUrl, {
            url: finalUrl,
            depth: job.depth,
            status: result.status,
            title: extractTitle(result.body),
            lastModified: result.lastModified,
          });
          if (job.depth >= maxDepth) continue;
          for (const link of extractInternalLinks(result.body, finalUrl, origin)) {
            if (seen.has(link)) continue;
            if (!isAllowed(new URL(link).pathname)) continue;
            queue.push({ url: link, depth: job.depth + 1 });
          }
        } catch {
          // Per-page errors are swallowed: the crawler is best-effort.
        } finally {
          inFlight--;
        }
      }
    })());
  }

  await Promise.all(workers);

  // Stable sort: depth asc, then URL by code point. Mirrors the typical
  // "homepage first, then sections" ordering search engines prefer.
  const sorted = [...pages.values()].sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth;
    return a.url < b.url ? -1 : a.url > b.url ? 1 : 0;
  });

  return { origin, pages: sorted, hitCap, hitDeadline };
}

// --- helpers ---------------------------------------------------------------

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || min));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Strip the fragment, lowercase the host, drop a default port. The WHATWG URL
 * parser also resolves dot segments and percent-encodes the path and query.
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

/**
 * The start URL as typed by a person: trimmed, `https://` added to a bare
 * domain, and a host that is `localhost` or has a dot. Same rule as the
 * platform's `_normalize_origin`.
 *
 * @returns {URL | null}
 */
export function normalizeStartUrl(input) {
  const cleaned = String(input ?? '').trim();
  if (!cleaned || /\s/.test(cleaned)) return null;
  const u = normalizeUrl(cleaned.includes('://') ? cleaned : `https://${cleaned}`);
  if (!u) return null;
  if (!u.host.includes('.') && u.hostname !== 'localhost') return null;
  return u;
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
    // An href inside HTML escapes its ampersands: /p?a=1&amp;b=2 is /p?a=1&b=2.
    const raw = match[1].trim().replace(/&amp;/g, '&');
    if (!raw || raw.startsWith('#')) continue;
    if (raw.startsWith('mailto:') || raw.startsWith('tel:') || raw.startsWith('javascript:')) continue;
    const resolved = (() => {
      try { return normalizeUrl(new URL(raw, currentUrl)); } catch { return null; }
    })();
    if (!resolved) continue;
    if (resolved.origin !== origin) continue;
    if (isAssetPath(resolved.pathname)) continue;
    found.add(resolved.href);
  }
  return [...found].sort();
}

/**
 * GET a page, following redirects. Returns null on a transport error.
 *
 * @returns {Promise<{ url: string, status: number, isHtml: boolean, body: string, lastModified: string | null } | null>}
 */
async function fetchHtml(url, { timeoutMs, userAgent, doFetch }) {
  let res;
  try {
    res = await doFetch(url, {
      headers: { 'user-agent': userAgent, accept: 'text/html, */*' },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return null;
  }
  const status = res.status;
  const ctype = String(res.headers.get('content-type') || '').toLowerCase();
  const lastModified = parseLastModified(res.headers.get('last-modified'));
  const isHtml = status >= 200 && status < 300 && ctype.includes('html');
  let body = '';
  if (isHtml) {
    try {
      body = (await res.text()).slice(0, MAX_BODY_CHARS);
    } catch {
      return null;
    }
  }
  return { url: res.url || url, status, isHtml, body, lastModified };
}

function extractTitle(body) {
  const match = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;
  return match[1].replace(/\s+/g, ' ').trim() || null;
}

// HTTP dates (RFC 1123, RFC 850, asctime) all start with a day name.
const HTTP_DATE_RE = /^[A-Za-z]{3}/;

/**
 * Parse a `Last-Modified` HTTP header into the ISO-8601 date string
 * sitemaps.org expects in `<lastmod>`. Sites serve this header in RFC
 * 1123 format (e.g. `Wed, 21 Oct 2026 07:28:00 GMT`); anything that is not
 * an HTTP date returns null. Emits the UTC `YYYY-MM-DD`.
 *
 * @param {string | string[] | null | undefined} raw
 * @returns {string | null}
 */
function parseLastModified(raw) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || typeof value !== 'string' || !HTTP_DATE_RE.test(value.trim())) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  // Use the date part only: sitemaps.org accepts both YYYY-MM-DD and
  // full ISO timestamps; the date form is concise and avoids advertising
  // false precision.
  return parsed.toISOString().slice(0, 10);
}

export const _internals = {
  extractInternalLinks,
  normalizeUrl,
  normalizeStartUrl,
  isAssetPath,
  extractTitle,
  parseLastModified,
};
