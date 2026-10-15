import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeCatalog, parseCatalogInput } from '../src/lib/catalog.js';
import { parseBulk } from '../src/lib/bulk.js';

const dmc = JSON.parse(readFileSync(new URL('../src/data/dmc.json', import.meta.url), 'utf8'));
const cat = makeCatalog(dmc);

test('bundled catalog is well formed', () => {
  assert.ok(cat.size > 400);
  for (const c of cat.list) assert.match(c.hex, /^#[0-9A-F]{6}$/);
  assert.equal(cat.find('DMC', '310').name, 'Black');
});

test('search by number, name and family', () => {
  assert.equal(cat.search('310')[0].code, '310');
  assert.equal(cat.search('b52')[0].code, 'B5200');
  assert.ok(cat.search('beaver gray').every((c) => /beaver/i.test(c.name)));
  assert.ok(cat.search('lavender')[0].name.startsWith('Lavender'));
  assert.ok(cat.search('teal').length > 0);
  assert.equal(cat.search('1')[0].code, '01'); // "1" finds 01 first
  assert.deepEqual(cat.search(''), []);
});

test('resolveCode is forgiving', () => {
  assert.equal(cat.resolveCode('ecru').code, 'Ecru');
  assert.equal(cat.resolveCode('blanc').code, 'White');
  assert.equal(cat.resolveCode('b5200').code, 'B5200');
  assert.equal(cat.resolveCode('1').code, '01');
  assert.equal(cat.resolveCode('99999'), null);
});

test('custom colors extend and override the builtin list', () => {
  const c = makeCatalog(dmc, [
    { brand: 'DMC', code: '310', name: 'Black (fixed)', hex: '#111111' },
    { brand: 'Anchor', code: '403', name: 'Black', hex: '#000000' },
  ]);
  assert.equal(c.find('DMC', '310').name, 'Black (fixed)');
  assert.equal(c.find('Anchor', '403').brand, 'Anchor');
  assert.equal(c.size, cat.size + 1);
});

test('bulk parser handles quantities and unknowns', () => {
  const r = parseBulk('310, 666 x2, 797:3\nB5200 310 zzz 99999', cat);
  const by = Object.fromEntries(r.found.map((f) => [f.color.code, f.qty]));
  assert.deepEqual(by, { 310: 2, 666: 2, 797: 3, B5200: 1 });
  assert.ok(r.unknown.includes('99999'));
});

test('catalog import accepts JSON and CSV', () => {
  const j = parseCatalogInput('[{"code":"E5200","name":"Light Effects","hex":"#EEEEEE"},{"code":"","hex":"#fff"}]');
  assert.equal(j.colors.length, 1);
  assert.equal(j.errors.length, 1);
  const c = parseCatalogInput('brand,code,name,hex\nAnchor,403,"Black, jet",000000');
  assert.equal(c.colors[0].hex, '#000000');
  assert.equal(c.colors[0].name, 'Black, jet');
});
