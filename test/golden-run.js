// Runs one golden case through the package code. Shared by the golden test and
// scripts/update-golden.mjs, so both read the cases the same way.

import { crawlSite, _internals } from '../src/crawler.js';
import { renderSitemapXml } from '../src/sitemap.js';
import { parseRobots, isPathAllowed } from '../src/robots.js';

const { extractInternalLinks, normalizeStartUrl, parseLastModified } = _internals;

export const SECTIONS = ['start_url', 'links', 'last_modified', 'render', 'robots', 'crawl'];

// A fetch that answers from the case's `site` map: a missing URL is a 404, an
// entry with `location` redirects (followed, like fetch does), anything else
// is served with its status, content type, Last-Modified and body.
export function fakeFetch(site) {
  return async (url) => {
    let current = url;
    for (let hop = 0; hop < 10; hop++) {
      const page = site[current];
      if (page && page.location) {
        current = new URL(page.location, current).href;
        continue;
      }
      const headers = new Headers({ 'content-type': page?.content_type ?? 'text/html; charset=utf-8' });
      if (page?.last_modified) headers.set('last-modified', page.last_modified);
      const status = page ? page.status ?? 200 : 404;
      const body = page?.body ?? '';
      return { url: current, status, ok: status >= 200 && status < 300, headers, text: async () => body };
    }
    throw new Error('too many redirects');
  };
}

export async function computeGolden(section, c) {
  if (section === 'start_url') return normalizeStartUrl(c.input)?.href ?? null;
  if (section === 'links') return extractInternalLinks(c.html, c.current_url, c.origin);
  if (section === 'last_modified') return parseLastModified(c.header);
  if (section === 'render') return renderSitemapXml(c.pages);
  if (section === 'robots') {
    const groups = parseRobots(c.robots_txt);
    return Object.fromEntries(c.paths.map((p) => [p, isPathAllowed(groups, p, c.agent)]));
  }
  if (section === 'crawl') {
    const { origin, pages, hitCap } = await crawlSite(c.start_url, {
      maxPages: c.max_pages,
      maxDepth: c.max_depth,
      respectRobots: c.respect_robots,
      concurrency: 1,
      fetch: fakeFetch(c.site),
    });
    return {
      origin,
      pages: pages.map((p) => ({
        url: p.url,
        depth: p.depth,
        status: p.status,
        title: p.title,
        last_modified: p.lastModified ?? null,
      })),
      hit_page_cap: hitCap,
      xml: renderSitemapXml(pages.map((p) => ({ url: p.url, lastmod: p.lastModified || undefined }))),
    };
  }
  throw new Error(`unknown golden section ${section}`);
}
