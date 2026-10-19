// Golden cases shared with the GeoSuite platform. The same JSON file lives in
// the platform repo (geo: backend/tests/fixtures/golden-sitemap.json) and its
// Python Sitemap Builder must give the same answers: if this test fails, the
// package changed behavior and the platform no longer matches.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SECTIONS, computeGolden } from './golden-run.js';

const golden = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'golden-sitemap.json'), 'utf8'),
);

for (const section of SECTIONS) {
  for (const c of golden[section]) {
    test(`golden ${section}: ${c.name}`, async () => {
      assert.deepEqual(await computeGolden(section, c), c.expected);
    });
  }
}
