// @geosuite/sitemap-builder
// Public API: crawlSite() and renderSitemapXml().
//
// Pipeline:
//   crawlSite(startUrl, opts) → { pages, hitCap, hitDeadline }
//   renderSitemapXml(entries) → string

export { crawlSite, normalizeUrl, _internals as crawlerInternals } from './crawler.js';
export { renderSitemapXml, _internals as sitemapInternals } from './sitemap.js';
