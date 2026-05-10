// Pure-function tests for src/sitemap.js — no network, no fixtures.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderSitemapXml, _internals } from '../src/sitemap.js';

test('renders an empty urlset when no entries are passed', () => {
  const xml = renderSitemapXml([]);
  assert.match(xml, /<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(xml, /<\/urlset>/);
});

test('renders <loc> for every entry and includes <lastmod> when present', () => {
  const xml = renderSitemapXml([
    { url: 'https://example.com/' },
    { url: 'https://example.com/blog', lastmod: '2026-01-01' },
  ]);
  assert.ok(xml.includes('<loc>https://example.com/</loc>'));
  assert.ok(xml.includes('<loc>https://example.com/blog</loc>'));
  assert.ok(xml.includes('<lastmod>2026-01-01</lastmod>'));
});

test('drops malformed entries silently', () => {
  const xml = renderSitemapXml([
    null,
    { url: '' },
    { url: 'https://example.com/ok' },
    { foo: 'bar' },
  ]);
  const matches = xml.match(/<loc>/g) || [];
  assert.equal(matches.length, 1);
});

test('escapes XML-significant characters in URLs', () => {
  const xml = renderSitemapXml([
    { url: 'https://example.com/?q=a&b<c' },
  ]);
  assert.ok(xml.includes('&amp;'));
  assert.ok(xml.includes('&lt;'));
  assert.ok(!xml.includes('&b<c'));
});

test('xmlEscape covers the five XML entities', () => {
  assert.equal(_internals.xmlEscape('a&b<c>d"e\'f'), 'a&amp;b&lt;c&gt;d&quot;e&apos;f');
});
