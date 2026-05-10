// Render a list of crawled pages as a sitemaps.org-compliant sitemap.xml
// document. We keep the output minimal on purpose: <loc> + optional
// <lastmod>, no <changefreq>/<priority> (the spec deprecates them and the
// major search engines ignore them anyway).

const ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

function xmlEscape(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ENTITIES[ch]);
}

/**
 * @param {Array<{ url: string, lastmod?: string }>} entries
 * @returns {string}
 */
export function renderSitemapXml(entries) {
  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
  for (const entry of entries) {
    if (!entry || typeof entry.url !== 'string' || !entry.url) continue;
    lines.push('  <url>');
    lines.push(`    <loc>${xmlEscape(entry.url)}</loc>`);
    if (entry.lastmod) {
      lines.push(`    <lastmod>${xmlEscape(entry.lastmod)}</lastmod>`);
    }
    lines.push('  </url>');
  }
  lines.push('</urlset>');
  return lines.join('\n') + '\n';
}

export const _internals = { xmlEscape };
