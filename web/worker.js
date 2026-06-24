// "Sitemap Builder" — hosted free tool (Cloudflare Worker).
//
// ⚠️ This is the CAPPED edge version: a small BFS crawl (≤40 pages, depth ≤2)
// using the platform `fetch`, to stay under the Workers subrequest/time limits.
// The package's full crawler (src/crawler.js) uses node:http and isn't
// Worker-compatible, so the crawl is reimplemented here with `fetch`; only the
// pure renderSitemapXml() is reused. For a complete crawl of a large site, use
// the CLI: `npx @geosuite/sitemap-builder <url>`.
//
// Routes:
//   GET /                   → the page, locale from Accept-Language (it → Italian)
//   GET /en  /it            → the page in that locale
//   GET /api/crawl?url=...   → { site, count, capped, xml, error }
//   GET /og.png  /favicon.svg → static assets

import { renderSitemapXml } from '../src/sitemap.js';
import { renderPage } from './page.js';
import OG_PNG from './og.png'; // bundled as ArrayBuffer via the wrangler "Data" rule

// A geo "location pin" mark in the GeoSuite accent — inline SVG, no binary.
const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0b0f17"/><path d="M32 13c-8.3 0-15 6.4-15 14.6C17 38 32 51 32 51s15-13 15-23.4C47 19.4 40.3 13 32 13z" fill="#5b8def"/><circle cx="32" cy="27.5" r="5.6" fill="#0b0f17"/></svg>`;

// '/it' → 'it', '/en' → 'en', '/' → first Accept-Language tag (it → 'it', else 'en').
function pickLang(request, path) {
  if (path === '/it') return 'it';
  if (path === '/en') return 'en';
  const first = (request.headers.get('accept-language') || '').split(',')[0].trim().toLowerCase();
  return first.startsWith('it') ? 'it' : 'en';
}

const MAX_PAGES = 40;
const MAX_DEPTH = 2;
const TIMEOUT_MS = 6000;
const UA = 'sitemap-builder-web/1.0 (+https://github.com/TryGeoSuite/sitemap-builder)';
const SKIP_EXT = /\.(?:png|jpe?g|gif|svg|webp|ico|css|js|mjs|json|xml|txt|pdf|zip|gz|mp4|webm|mp3|woff2?|ttf|eot)(?:$|\?)/i;

function extractLinks(html, base, origin) {
  const out = new Set();
  const re = /href\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = m[1].trim();
    if (!href || /^(mailto:|tel:|javascript:|#|data:)/i.test(href)) continue;
    let abs;
    try {
      abs = new URL(href, base);
    } catch {
      continue;
    }
    if (abs.protocol !== 'http:' && abs.protocol !== 'https:') continue;
    if (abs.origin !== origin) continue;
    if (SKIP_EXT.test(abs.pathname)) continue;
    abs.hash = '';
    out.add(abs.toString());
  }
  return out;
}

async function crawl(input) {
  let start;
  try {
    start = new URL(/^https?:\/\//i.test(input) ? input : 'https://' + input);
  } catch {
    return { error: 'Please enter a valid URL.' };
  }
  if (start.protocol !== 'http:' && start.protocol !== 'https:') {
    return { error: 'Please enter an http(s) URL.' };
  }
  const origin = start.origin;
  start.hash = '';

  const seen = new Set([start.toString()]);
  const queue = [{ url: start.toString(), depth: 0 }];
  const pages = [];

  while (queue.length && pages.length < MAX_PAGES) {
    const { url, depth } = queue.shift();
    let html = '';
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': UA, accept: 'text/html,*/*' },
        redirect: 'follow',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) continue;
      if (!(res.headers.get('content-type') || '').toLowerCase().includes('html')) continue;
      pages.push({ url });
      if (depth < MAX_DEPTH) html = await res.text();
    } catch {
      continue;
    }
    if (!html) continue;
    for (const link of extractLinks(html, url, origin)) {
      if (!seen.has(link) && seen.size < MAX_PAGES * 5) {
        seen.add(link);
        queue.push({ url: link, depth: depth + 1 });
      }
    }
  }

  const capped = queue.length > 0 || pages.length >= MAX_PAGES;
  const xml = renderSitemapXml(pages.map((p) => ({ url: p.url })));
  return { site: origin, count: pages.length, capped, xml, error: null };
}

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'cache-control': 'public, max-age=300',
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/api/crawl') {
      const target = url.searchParams.get('url');
      if (!target) {
        return new Response(JSON.stringify({ error: 'Missing ?url= parameter.' }), {
          status: 400,
          headers: JSON_HEADERS,
        });
      }
      return new Response(JSON.stringify(await crawl(target)), { headers: JSON_HEADERS });
    }

    if (path === '/og.png') {
      return new Response(OG_PNG, {
        headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' },
      });
    }
    if (path === '/favicon.svg') {
      return new Response(FAVICON, {
        headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'public, max-age=86400' },
      });
    }

    if (path === '/' || path === '/en' || path === '/it') {
      const lang = pickLang(request, path);
      const headers = {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=3600',
      };
      // '/' is content-negotiated, so it must not be cached language-agnostically.
      if (path === '/') headers.vary = 'Accept-Language';
      return new Response(renderPage(lang), { headers });
    }

    return new Response('Not found', { status: 404 });
  },
};
