import { colorKey } from './utils.js';
import { cleanFileName } from './fcjson.js';

// Reader for Open Cross Stitch (.oxs) charts, the XML format exported by MacStitch, FlossCross and others.
//
// Checked against a real file with: <properties chartwidth chartheight charttitle stitchesperinch ...>,
// <palette><palette_item index number name color strands bsstrands .../>, and
// <fullstitches><stitch x y palindex/>. The sample had no part stitches, backstitches or knots, so those
// sections are read from the OXS layout as I understand it and are flagged as unverified when present.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });

const TAG = /<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
const ATTR = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

function* tags(text) {
  TAG.lastIndex = 0;
  let m;
  while ((m = TAG.exec(text))) {
    const attrs = {};
    if (m[3]) {
      ATTR.lastIndex = 0;
      let a;
      while ((a = ATTR.exec(m[3]))) attrs[a[1].toLowerCase()] = decode(a[2] ?? a[3] ?? '');
    }
    yield { name: m[2].toLowerCase(), attrs, closing: m[1] === '/', selfClosing: m[4] === '/' };
  }
}

const BRANDS = ['Anchor', 'Madeira', 'Gamma', 'Sullivans', 'Weeks', 'Cosmo', 'Olympus', 'Coats', 'Kreinik', 'Mill Hill', 'Pearsall'];

export function splitBrandCode(number) {
  const raw = String(number ?? '').trim();
  const dmc = /^dmc\s*[:#-]?\s*(.+)$/i.exec(raw);
  if (dmc) return { brand: 'DMC', code: dmc[1].trim() };
  for (const b of BRANDS) {
    const m = new RegExp('^' + b + '\\s*[:#-]?\\s*(.+)$', 'i').exec(raw);
    if (m) return { brand: b, code: m[1].trim() };
  }
  return { brand: 'DMC', code: raw };
}

const hexOf = (c) => {
  const h = String(c || '').replace('#', '').trim();
  return /^[0-9a-f]{6}$/i.test(h) ? '#' + h.toUpperCase() : '#808080';
};

export function parseOxs(text, fileName = '') {
  const src = String(text || '').replace(/^\uFEFF/, '');
  if (!/<chart[\s>]/i.test(src)) {
    throw new Error('This does not look like an OXS chart (no <chart> element found).');
  }

  const warnings = [];
  let props = {};
  const palette = new Map(); // index -> item
  let order = 0;
  let section = '';
  let badRefs = 0, knots = 0, blends = 0;
  let sawPart = false, sawBack = false;

  const bump = (idx, field, by = 1) => {
    const item = palette.get(String(idx));
    if (!item) { badRefs++; return; }
    item[field] += by;
  };

  for (const t of tags(src)) {
    if (t.closing) { if (t.name === section) section = ''; continue; }
    switch (t.name) {
      case 'properties': props = t.attrs; break;
      case 'palette': case 'fullstitches': case 'partstitches': case 'backstitches': case 'ornaments_inc_knots_and_beads':
        if (!t.selfClosing) section = t.name;
        break;
      case 'palette_item': {
        const index = t.attrs.index ?? String(order);
        order++;
        const blend = t.attrs.blendcolor && t.attrs.blendcolor.toLowerCase() !== 'nil' && t.attrs.blendcolor !== '';
        if (blend || /\+/.test(t.attrs.number || '')) blends++;
        palette.set(String(index), {
          index: String(index), number: t.attrs.number || '', name: t.attrs.name || '', hex: hexOf(t.attrs.color),
          strands: parseInt(t.attrs.strands, 10) || 0, bsstrands: parseInt(t.attrs.bsstrands, 10) || 0,
          full: 0, part: 0, back: 0,
        });
        break;
      }
      case 'stitch':
        if (t.attrs.palindex != null) bump(t.attrs.palindex, 'full');
        break;
      case 'partstitch': {
        sawPart = true;
        for (const k of ['palindex', 'palindex1', 'palindex2']) if (t.attrs[k] != null && t.attrs[k] !== '') bump(t.attrs[k], 'part', 0.5);
        break;
      }
      case 'backstitch':
        sawBack = true;
        if (t.attrs.palindex != null) bump(t.attrs.palindex, 'back'); else badRefs++;
        break;
      default:
        if (section === 'ornaments_inc_knots_and_beads' && t.attrs.palindex != null) knots++;
        else if (section === 'backstitches' && t.attrs.palindex != null) { sawBack = true; bump(t.attrs.palindex, 'back'); }
        else if (section === 'partstitches' && t.attrs.palindex != null) { sawPart = true; bump(t.attrs.palindex, 'part', 0.5); }
    }
  }

  if (!palette.size) throw new Error('The chart has no palette, so there are no colors to import.');

  const merged = new Map();
  let unused = 0;
  for (const item of palette.values()) {
    const stitches = item.full + Math.round(item.part);
    if (stitches === 0 && item.back === 0) { unused++; continue; }
    const { brand, code } = splitBrandCode(item.number);
    if (!code) continue;
    const key = colorKey(brand, code);
    const cur = merged.get(key);
    if (cur) {
      cur.stitches += stitches; cur.bsStitches += item.back; cur._w += stitches;
      continue;
    }
    merged.set(key, {
      key, brand, code, name: item.name, hex: item.hex, stitches, bsStitches: item.back,
      _strands: item.strands, _bs: item.bsstrands, _w: stitches,
    });
  }
  const colors = [...merged.values()];
  if (!colors.length) throw new Error('The chart has no stitches, so there is nothing to import.');
  colors.sort((a, b) => b.stitches + b.bsStitches - (a.stitches + a.bsStitches));

  // Strands: the value most stitches use (OXS stores them per color).
  const tally = (field) => {
    const t = new Map();
    for (const c of colors) if (c[field] > 0) t.set(c[field], (t.get(c[field]) || 0) + Math.max(1, c._w));
    return [...t.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  };
  const strands = tally('_strands') || 2;
  const bsStrands = tally('_bs') || 1;
  for (const c of colors) { delete c._strands; delete c._bs; delete c._w; }

  if (unused) warnings.push(`${unused} palette color(s) have no stitches and were left out.`);
  if (sawPart) warnings.push('This chart has part stitches. They are counted as half stitches; the OXS part-stitch layout was not in my sample, so check the totals.');
  if (sawBack) warnings.push('Backstitch is counted per segment. The OXS backstitch layout was not in my sample, so check the totals.');
  if (knots) warnings.push(`${knots} knots or beads are not included in the thread counts.`);
  if (blends) warnings.push('This chart uses blended threads. Blends are listed as single codes and will need details.');
  if (badRefs) warnings.push(`${badRefs} stitches pointed at colors missing from the palette and were skipped.`);
  warnings.push('OXS files do not say which brand a code belongs to. Codes are treated as DMC unless they start with another brand name.');
  const nonDmc = [...new Set(colors.filter((c) => c.brand !== 'DMC').map((c) => c.brand))];
  if (nonDmc.length) warnings.push(`Includes non-DMC floss (${nonDmc.join(', ')}). It is tracked separately from DMC.`);

  const spi = parseInt(props.stitchesperinch, 10);
  const width = parseInt(props.chartwidth, 10) || 0;
  const height = parseInt(props.chartheight, 10) || 0;
  return {
    source: 'oxs',
    title: String(props.charttitle || '').trim(),
    suggestedName: cleanFileName(fileName),
    width,
    height,
    strands,
    bsStrands,
    fabricCount: Number.isInteger(spi) && spi >= 8 && spi <= 40 ? spi : null,
    software: props.software || '',
    colors,
    totalStitches: colors.reduce((a, c) => a + c.stitches, 0),
    warnings,
  };
}
