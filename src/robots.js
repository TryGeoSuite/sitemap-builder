// Minimal robots.txt checker for sitemap-builder.
// Fetches /robots.txt from the crawl origin and returns an isAllowed(path)
// predicate that applies longest-match semantics for User-Agent: *.
// Zero runtime dependencies; fails permissively on any error.

import http from 'node:http';
import https from 'node:https';

/**
 * Fetch /robots.txt from `origin` and build a path-checker for the wildcard
 * User-Agent group. Returns `() => true` (allow all) on any fetch or parse
 * error so callers never need to handle failures.
 *
 * @param {string} origin  e.g. "https://example.com"
 * @param {{ timeoutMs?: number, userAgent?: string }} [opts]
 * @returns {Promise<(path: string) => boolean>}
 */
export async function loadRobotsChecker(origin, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const ua = opts.userAgent ?? 'geosuite-sitemap-builder';
  const body = await fetchText(`${origin}/robots.txt`, timeoutMs, ua);
  if (!body) return () => true;
  const disallowed = parseWildcardDisallowed(body);
  if (!disallowed.length) return () => true;
  return (path) => !matchesAny(path, disallowed);
}

// ---- parser ------------------------------------------------------------------

function parseWildcardDisallowed(raw) {
  const out = [];
  let inWildcard = false;
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.split('#')[0].trim();
    if (!line || !line.includes(':')) continue;
    const colon = line.indexOf(':');
    const key = line.slice(0, colon).trim().toLowerCase();
    const val = line.slice(colon + 1).trim();
    if (key === 'user-agent') {
      inWildcard = val === '*';
    } else if (key === 'disallow' && inWildcard && val) {
      out.push(val);
    }
  }
  return out;
}

// Longest-matching pattern wins; returns true if the path is blocked.
function matchesAny(path, patterns) {
  let winner = null;
  for (const p of patterns) {
    if (pathMatches(p, path) && (!winner || p.length > winner.length)) winner = p;
  }
  return winner !== null;
}

// robots.txt wildcard matching: * = any chars, $ = must end here.
function pathMatches(pattern, path) {
  if (!pattern) return false;
  const endAnchor = pattern.endsWith('$');
  const body = endAnchor ? pattern.slice(0, -1) : pattern;
  const re = new RegExp(
    '^' +
      body
        .split('*')
        .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
        .join('.*') +
      (endAnchor ? '$' : ''),
  );
  try {
    return re.test(decodeURIComponent(path));
  } catch {
    return re.test(path);
  }
}

// ---- fetcher -----------------------------------------------------------------

function fetchText(url, timeoutMs, userAgent) {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      resolve(null);
      return;
    }
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        method: 'GET',
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        headers: {
          'User-Agent': userAgent,
          Accept: 'text/plain, */*',
          'Accept-Encoding': 'identity',
        },
      },
      (res) => {
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          resolve(null);
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        res.on('error', () => resolve(null));
      },
    );
    req.setTimeout(timeoutMs, () => req.destroy());
    req.on('error', () => resolve(null));
    req.end();
  });
}
