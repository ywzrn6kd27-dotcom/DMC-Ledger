import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { parseOxs, splitBrandCode } from '../src/lib/oxs.js';
import { parsePatternPages, itemsToRows } from '../src/lib/pdfpattern.js';

const OXS = `<?xml version='1.0' encoding='utf-8'?>
<chart><properties oxs="1.0" software="MacStitch" chartwidth="4" chartheight="3" charttitle="Tiny &amp; Test" stitchesperinch="16" />
<palette>
<palette_item index="0" number="Ecru" name="Ecru (background)" color="FFF7E7" strands="2" bsstrands="1" />
<palette_item index="1" number="310" name="Black" color="000000" strands="2" bsstrands="1" />
<palette_item index="2" number="DMC BLANC" name="White" color="FFFFFF" strands="3" bsstrands="1" />
<palette_item index="3" number="Anchor 403" name="Black" color="000000" strands="2" bsstrands="1" />
</palette>
<fullstitches><stitch x="0" y="0" palindex="1" /><stitch x="1" y="0" palindex="1" /><stitch x="2" y="0" palindex="2" /><stitch x="3" y="0" palindex="9" /></fullstitches>
<partstitches><partstitch x="0" y="1" palindex1="3" palindex2="1" direction="1" /></partstitches>
<backstitches><backstitch x1="0" y1="0" x2="2" y2="0" palindex="3" objecttype="backstitch" /></backstitches>
<ornaments_inc_knots_and_beads><object x1="1" y1="1" palindex="1" objecttype="knot" /></ornaments_inc_knots_and_beads>
<commentboxes /></chart>`;

test('OXS: palette, stitch counts, brand prefixes, size, fabric count and warnings', () => {
  const r = parseOxs(OXS, 'tiny_chart.oxs');
  const by = Object.fromEntries(r.colors.map((c) => [`${c.brand}:${c.code}`, c]));
  assert.equal(r.title, 'Tiny & Test');
  assert.equal(r.width, 4); assert.equal(r.height, 3);
  assert.equal(r.fabricCount, 16);
  assert.equal(by['DMC:310'].stitches, 3); // 2 full + a half from the part stitch
  assert.equal(by['DMC:BLANC'].stitches, 1);
  assert.equal(by['Anchor:403'].bsStitches, 1);
  assert.equal(by['Anchor:403'].stitches, 1); // half of a part stitch rounds up
  assert.equal(r.colors.find((c) => c.code === 'Ecru'), undefined);
  assert.ok(r.warnings.some((w) => /part stitches/.test(w)));
  assert.ok(r.warnings.some((w) => /Backstitch/.test(w)));
  assert.ok(r.warnings.some((w) => /1 knots/.test(w)));
  assert.ok(r.warnings.some((w) => /missing from the palette/.test(w)));
  assert.equal(r.suggestedName, 'tiny_chart'.replace(/_/g, ' '));
});

test('OXS: brand prefix splitting and bad input', () => {
  assert.deepEqual(splitBrandCode('DMC 310'), { brand: 'DMC', code: '310' });
  assert.deepEqual(splitBrandCode('dmc:B5200'), { brand: 'DMC', code: 'B5200' });
  assert.deepEqual(splitBrandCode('3865'), { brand: 'DMC', code: '3865' });
  assert.throws(() => parseOxs('hello'), /OXS/);
  assert.throws(() => parseOxs('<chart><properties/></chart>'), /no palette/);
});

test('real OXS sample (if present locally)', { skip: !existsSync('/mnt/user-data/uploads/bewear_munchlax_teddiursa_hat_56x37_DMC.oxs') }, () => {
  const r = parseOxs(readFileSync('/mnt/user-data/uploads/bewear_munchlax_teddiursa_hat_56x37_DMC.oxs', 'utf8'), 'x.oxs');
  assert.equal(r.width, 56); assert.equal(r.height, 37);
  assert.equal(r.totalStitches, 1504);
  assert.equal(r.colors.length, 6);
  assert.equal(r.colors.find((c) => c.code === '712').stitches, 498);
  assert.equal(r.fabricCount, 14);
});

// Rows as pdf.js groups them for a pattern key page (symbols on their own rows, codes and names below).
const KEY_PAGE = [
  'Key and consumption of threads for design "Tiny Owl"',
  'Colours: DMC', 'Full cross stitch', 'Use 2 strands of thread for full cross stitch',
  'Sym No. Colour Name Sym No. Colour Name',
  'Ä 2', '18 Yellow Plum 29 Eggplant',
  'Ý Š', '166 Moss green 336 Indigo blue',
  'k a', '520 Dark fern green B5200 Snow white',
  'Backstitch', '2 strands of thread DMC 730',
  'Consumption of threads for Aida №14 (with 50% thread stock)',
  'DMC Length(m) Skein Est. DMC Length(m) Skein Est.',
  '18 1.7 1 29 0.7 1', '166 1.5 2 336 3.9 1', '520 1.1 1 B5200 0.3 1',
];
const COVER = ['«Tiny Owl»', 'Stitches: 40 x 30', 'Palette: 6 colors DMC'];

test('PDF: key table, consumption, size and settings from page rows', () => {
  const r = parsePatternPages([COVER, KEY_PAGE], 'tiny.pdf');
  assert.deepEqual(r.colors.map((c) => c.code), ['18', '29', '166', '336', '520', 'B5200']);
  assert.equal(r.colors[2].name, 'Moss green');
  assert.equal(r.colors[2].need, 2);
  assert.equal(r.colors[2].meters, 1.5);
  assert.equal(r.title, 'Tiny Owl');
  assert.equal(r.width, 40); assert.equal(r.height, 30);
  assert.equal(r.fabricCount, 14);
  assert.equal(r.strands, 2);
  assert.ok(r.warnings.some((w) => /skein amounts/i.test(w)));
});

test('PDF: symbols and codes on the same row, and fallbacks', () => {
  const rows = ['Colour Name', 'No. Colour Name', 'Ä 18 Yellow Plum 2 29 Eggplant', 'k 520 Dark fern green a 581 Grashopper green'];
  const r = parsePatternPages([['Pattern', 'Sym No. Colour Name', ...rows.slice(2)]], 'x.pdf');
  assert.deepEqual(r.colors.map((c) => [c.code, c.name]), [['18', 'Yellow Plum'], ['29', 'Eggplant'], ['520', 'Dark fern green'], ['581', 'Grashopper green']]);
  assert.ok(r.colors.every((c) => c.need === 1));
  // no key table: falls back to "DMC 310" mentions, flagged as low confidence
  const f = parsePatternPages([['Use DMC 310 for outlines and DMC 3865 for the background, DMC 310 again']], 'y.pdf');
  assert.deepEqual(f.colors.map((c) => c.code), ['310', '3865']);
  assert.equal(f.lowConfidence, true);
  assert.throws(() => parsePatternPages([['Just a nice picture of a cat with no thread information at all in it']]), /could not find a thread key/);
  assert.throws(() => parsePatternPages([['']]), /no readable text/);
});

test('PDF: pdf.js text items are grouped into rows', () => {
  const it = (str, x, y, w = 10) => ({ str, transform: [1, 0, 0, 1, x, y], width: w });
  const rows = itemsToRows([it('18', 70, 600, 8), it('Yellow Plum', 100, 600, 50), it('29', 200, 600, 8), it('Eggplant', 230, 600, 40), it('Ä', 70, 603), it('', 5, 5)]);
  assert.deepEqual(rows, ['Ä', '18 Yellow Plum 29 Eggplant']);
});

test('real PDF sample (if present locally)', { skip: !existsSync('/mnt/user-data/uploads/OliveswithMediterraneanTile.pdf') || !existsSync('/home/claude/.npm-global/lib/node_modules/pdfjs-dist/legacy/build/pdf.mjs') }, async () => {
  const { extractPdfPages } = await import('../src/lib/pdfpattern.js');
  const lib = await import('/home/claude/.npm-global/lib/node_modules/pdfjs-dist/legacy/build/pdf.mjs');
  const pages = await extractPdfPages(lib, readFileSync('/mnt/user-data/uploads/OliveswithMediterraneanTile.pdf'));
  const r = parsePatternPages(pages, 'OliveswithMediterraneanTile.pdf');
  assert.equal(r.colors.length, 16);
  assert.equal(r.title, 'Olives with Mediterranean Tile');
  assert.equal(r.colors.find((c) => c.code === '336').name, 'Indigo blue');
  assert.equal(r.colors.find((c) => c.code === '3865').need, 1);
  assert.equal(r.width, 93);
  assert.equal(r.totalStitches, 4210);
  assert.equal(r.fabricCount, 14);
});
