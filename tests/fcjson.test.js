import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { parseFcjson, cleanFileName } from '../src/lib/fcjson.js';
import { makeFcjson } from './fixtures.js';

test('counts stitches per color and skips unused palette entries', () => {
  const r = parseFcjson(makeFcjson(), 'My-chart_fcjson.json');
  const by = Object.fromEntries(r.colors.map((c) => [c.code, c.stitches]));
  assert.deepEqual(by, { 310: 5, '01': 3, B5200: 1 });
  assert.equal(r.totalStitches, 9);
  assert.equal(r.strands, 2);
  assert.equal(r.suggestedName, 'My-chart');
  assert.equal(r.title, 'Test chart');
  assert.ok(r.warnings.some((w) => /no stitches/.test(w)));
});

test('keeps codes as strings (leading zeros, letters)', () => {
  const r = parseFcjson(makeFcjson());
  assert.ok(r.colors.find((c) => c.code === '01'));
  assert.ok(r.colors.find((c) => c.code === 'B5200'));
  assert.equal(r.colors[0].hex, '#20201F');
});

test('rejects non-chart files with a clear message', () => {
  assert.throws(() => parseFcjson('not json'), /not valid JSON/);
  assert.throws(() => parseFcjson('{"a":1}'), /No chart data/);
});

test('warns on newer format versions and other stitch types', () => {
  const r = parseFcjson(makeFcjson({ extra: { v: 999 } }));
  assert.ok(r.warnings.some((w) => /v999/.test(w)));
});

test('cleanFileName', () => {
  assert.equal(cleanFileName('Hanz-landa2_fcjson.json'), 'Hanz-landa2');
  assert.equal(cleanFileName('cat.fcjson'), 'cat');
});

test('real sample (if present locally)', { skip: !existsSync('/mnt/user-data/uploads/Hanz-landa2_fcjson.json') }, () => {
  const r = parseFcjson(readFileSync('/mnt/user-data/uploads/Hanz-landa2_fcjson.json', 'utf8'), 'Hanz-landa2_fcjson.json');
  const by = Object.fromEntries(r.colors.map((c) => [c.code, c.stitches]));
  assert.equal(r.colors.length, 9);
  assert.equal(by['310'], 4504);
  assert.equal(by['B5200'], 65);
  assert.equal(r.totalStitches, 19250 - 175);
  assert.equal(r.width, 175);
});
