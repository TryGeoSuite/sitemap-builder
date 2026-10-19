#!/usr/bin/env node
// Recompute the `expected` blocks of test/fixtures/golden-sitemap.json from
// the current code. Run it only after an intentional behavior change, read the
// diff, then copy the file to the platform repo
// (geo: backend/tests/fixtures/golden-sitemap.json) and make its Python
// service give the same answers.
//
//   node scripts/update-golden.mjs

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SECTIONS, computeGolden } from '../test/golden-run.js';

const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'test', 'fixtures', 'golden-sitemap.json');
const golden = JSON.parse(await readFile(file, 'utf8'));
for (const section of SECTIONS) {
  for (const c of golden[section]) c.expected = await computeGolden(section, c);
}
await writeFile(file, JSON.stringify(golden, null, 2) + '\n');
process.stdout.write(`updated ${file}\n`);
