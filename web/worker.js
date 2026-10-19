// "Sitemap Builder" — hosted free tool (Cloudflare Worker).
//
// It runs the package's own crawler (src/crawler.js, platform `fetch`) and
// renderSitemapXml(), with the GeoSuite platform's crawl settings (depth 3,
// 6 parallel fetches, 6 s per page, 25 s budget) and one difference: at most
// 40 pages, to stay under the Workers subrequest limit. For the same site the
// page gives the same sitemap.xml as the platform's Sitemap Builder run with
// "Max pages" 40. For a bigger crawl, use the CLI:
// `npx @geosuite/sitemap-builder <url>`.
//
// Routes:
//   GET /                   → the page, locale from Accept-Language (it → Italian)
//   GET /en  /it            → the page in that locale
//   GET /api/crawl?url=...   → { site, count, capped, hitDeadline, xml, error }
//   GET /og.png              → Open Graph share image
//   GET /favicon.png  /favicon.ico  /favicon.svg  /apple-touch-icon.png
//                            → GeoSuite's favicon (PNG; /favicon.svg is the old
//                              path, kept so cached links still get an icon)
//   GET /logos/{chatgpt,gemini,perplexity}.svg → engine logos for the CTA

import { crawlSite } from '../src/crawler.js';
import { renderSitemapXml } from '../src/sitemap.js';
import { renderPage } from './page.js';
import OG_PNG from './og.png'; // bundled as ArrayBuffer via the wrangler "Data" rule
// GeoSuite's official favicon (96px) and touch icon (180px): never redraw or recolor.
import FAVICON_PNG from './favicon.png';
import TOUCH_ICON_PNG from './apple-touch-icon.png';
// The AI engines' logos in the closing call to action, copied from
// TryGeoSuite/geo-toolkit/logos (bundled as text via the wrangler "Text" rule).
import LOGO_CHATGPT from './logos/chatgpt.svg';
import LOGO_GEMINI from './logos/gemini.svg';
import LOGO_PERPLEXITY from './logos/perplexity.svg';

const ENGINE_LOGOS = { chatgpt: LOGO_CHATGPT, gemini: LOGO_GEMINI, perplexity: LOGO_PERPLEXITY };
const ICON_PATHS = { '/favicon.png': FAVICON_PNG, '/favicon.ico': FAVICON_PNG, '/favicon.svg': FAVICON_PNG, '/apple-touch-icon.png': TOUCH_ICON_PNG };

// '/it' → 'it', '/en' → 'en', '/' → first Accept-Language tag (it → 'it', else 'en').
function pickLang(request, path) {
  if (path === '/it') return 'it';
  if (path === '/en') return 'en';
  const first = (request.headers.get('accept-language') || '').split(',')[0].trim().toLowerCase();
  return first.startsWith('it') ? 'it' : 'en';
}

// The platform's defaults (sitemap_builder_service.py), except the page cap.
const MAX_PAGES = 40;
const MAX_DEPTH = 3;
const CONCURRENCY = 6;
const TIMEOUT_MS = 6000;
const BUDGET_MS = 25_000;
const UA = 'sitemap-builder-web/1.0 (+https://github.com/TryGeoSuite/sitemap-builder)';

async function crawl(input) {
  let result;
  try {
    result = await crawlSite(input, {
      maxPages: MAX_PAGES,
      maxDepth: MAX_DEPTH,
      concurrency: CONCURRENCY,
      perPageTimeoutMs: TIMEOUT_MS,
      deadlineMs: Date.now() + BUDGET_MS,
      userAgent: UA,
    });
  } catch {
    return { error: 'Please enter a valid URL.' };
  }
  const { origin, pages, hitCap, hitDeadline } = result;
  const xml = renderSitemapXml(pages.map((p) => ({ url: p.url, lastmod: p.lastModified || undefined })));
  return { site: origin, count: pages.length, capped: hitCap || hitDeadline, hitDeadline, xml, error: null };
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
    if (Object.hasOwn(ICON_PATHS, path)) {
      return new Response(ICON_PATHS[path], {
        headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' },
      });
    }
    const logo = path.match(/^\/logos\/(chatgpt|gemini|perplexity)\.svg$/);
    if (logo) {
      return new Response(ENGINE_LOGOS[logo[1]], {
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
