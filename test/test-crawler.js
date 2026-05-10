// Pure-function tests for the crawler internals (no network).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { _internals } from '../src/crawler.js';

const { extractInternalLinks, normalizeUrl, isAssetPath, extractTitle } = _internals;

test('normalizeUrl rejects non-http(s) protocols', () => {
  assert.equal(normalizeUrl('ftp://example.com/'), null);
  assert.equal(normalizeUrl('javascript:alert(1)'), null);
  assert.equal(normalizeUrl('not a url'), null);
});

test('normalizeUrl strips fragment and lowercases the host', () => {
  const u = normalizeUrl('https://Example.COM/foo#bar');
  assert.equal(u.hash, '');
  assert.equal(u.hostname, 'example.com');
});

test('isAssetPath flags common static asset extensions', () => {
  assert.equal(isAssetPath('/img/logo.png'), true);
  assert.equal(isAssetPath('/style.css'), true);
  assert.equal(isAssetPath('/docs/guide.pdf'), true);
  assert.equal(isAssetPath('/blog/post'), false);
  assert.equal(isAssetPath('/path-with.dot/in-segment'), false);
});

test('extractInternalLinks picks up same-origin <a href> only', () => {
  const html = `
    <a href="/about">about</a>
    <a href="https://example.com/contact">contact</a>
    <a href="https://other.com/page">other</a>
    <a href="mailto:hi@example.com">mail</a>
    <a href="tel:+39000">phone</a>
    <a href="#anchor">anchor</a>
    <a href="/img/hero.png">asset</a>
  `;
  const found = extractInternalLinks(html, 'https://example.com/', 'https://example.com');
  assert.deepEqual(new Set(found), new Set([
    'https://example.com/about',
    'https://example.com/contact',
  ]));
});

test('extractInternalLinks resolves relative urls against currentUrl', () => {
  const html = `<a href="../sibling">sibling</a>`;
  const found = extractInternalLinks(html, 'https://example.com/blog/post', 'https://example.com');
  assert.deepEqual(found, ['https://example.com/sibling']);
});

test('extractTitle returns null when no <title>', () => {
  assert.equal(extractTitle('<html><body>nope</body></html>'), null);
});

test('extractTitle collapses whitespace', () => {
  assert.equal(
    extractTitle('<title>Hello\n   world</title>'),
    'Hello world',
  );
});
