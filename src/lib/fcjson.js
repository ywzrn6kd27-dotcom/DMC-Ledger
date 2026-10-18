import { colorKey, rgbToHex } from './utils.js';

// Parser for FlossCross (.fcjson) charts.
//
// Layout (checked against a real v133 export):
//   model.images[].flossIndexes[]  -> { sys, id, name, rgb:[r,g,b], ... }
//   model.images[].crossIndexes[]  -> { tp, fi }  (fi = index into flossIndexes)
//   model.images[].layers[].cross  -> flat grid of crossIndexes indexes, -1 = empty
//   model.images[].layers[].backstitch -> [] in the sample, so its schema is unverified
//   model.images[].defaults        -> { crossStrands, bsStrands }
//   info.title                     -> chart title
export const TESTED_FORMAT_VERSION = 133;

function normBrand(sys) {
  const s = String(sys || 'DMC').trim();
  return s.toUpperCase() === 'DMC' ? 'DMC' : s;
}

export function cleanFileName(fileName = '') {
  return fileName
    .replace(/\.(fcjson|json|oxs|xml|pdf)$/i, '')
    .replace(/[_-]?fcjson$/i, '')
    .replace(/[_]+/g, ' ')
    .trim();
}

export function parseFcjson(text, fileName = '') {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON, so it cannot be a FlossCross chart.');
  }
  if (!data || typeof data !== 'object' || !data.model || !Array.isArray(data.model.images) || !data.model.images.length) {
    throw new Error('No chart data found. Export the chart from FlossCross as .fcjson and try again.');
  }

  const warnings = [];
  if (data.software && data.software !== 'FlossCross')
    warnings.push(`This file says it was made by "${data.software}", not FlossCross. Importing anyway.`);
  if (typeof data.v === 'number' && data.v > TESTED_FORMAT_VERSION)
    warnings.push(`This file uses format v${data.v}; the importer was built against v${TESTED_FORMAT_VERSION}. Check the stitch counts look right.`);

  const colors = new Map();
  const otherTypes = new Set();
  let unattributedBackstitch = 0;
  let width = 0, height = 0, crossStrands = null, bsStrands = null;

  for (const img of data.model.images) {
    const flossList = Array.isArray(img.flossIndexes) ? img.flossIndexes : [];
    const crossList = Array.isArray(img.crossIndexes) ? img.crossIndexes : [];
    width = Math.max(width, img.width | 0);
    height = Math.max(height, img.height | 0);
    if (crossStrands == null && Number.isInteger(img.defaults?.crossStrands)) crossStrands = img.defaults.crossStrands;
    if (bsStrands == null && Number.isInteger(img.defaults?.bsStrands)) bsStrands = img.defaults.bsStrands;

    const keys = flossList.map((f) => {
      const code = String(f?.id ?? '').trim();
      if (!code) return null;
      const brand = normBrand(f.sys);
      const key = colorKey(brand, code);
      if (!colors.has(key)) {
        const rgb = Array.isArray(f.rgb) && f.rgb.length === 3 ? f.rgb : [128, 128, 128];
        colors.set(key, { key, brand, code, name: String(f.name || ''), hex: rgbToHex(rgb), stitches: 0, bsStitches: 0 });
      }
      return key;
    });

    for (const layer of img.layers || []) {
      const grid = Array.isArray(layer.cross) ? layer.cross : [];
      for (let i = 0; i < grid.length; i++) {
        const v = grid[i];
        if (!(v >= 0)) continue;
        const ci = crossList[v];
        const key = keys[ci ? ci.fi : v];
        if (!key) continue;
        if (ci && ci.tp && ci.tp !== 'cr') otherTypes.add(ci.tp);
        colors.get(key).stitches++;
      }
      for (const b of Array.isArray(layer.backstitch) ? layer.backstitch : []) {
        const fi = b?.fi ?? b?.flossIndex ?? b?.f;
        const key = Number.isInteger(fi) ? keys[fi] : null;
        if (key) colors.get(key).bsStitches++;
        else unattributedBackstitch++;
      }
    }
  }

  if (otherTypes.size)
    warnings.push(`Found stitch types other than full cross (${[...otherTypes].join(', ')}). They were counted as full stitches, so estimates may run high.`);
  if (unattributedBackstitch)
    warnings.push(`${unattributedBackstitch} backstitch entries could not be matched to a color and were skipped.`);

  const all = [...colors.values()];
  const used = all.filter((c) => c.stitches > 0 || c.bsStitches > 0);
  if (used.length < all.length)
    warnings.push(`${all.length - used.length} palette color(s) have no stitches and were left out.`);
  if (!used.length) throw new Error('The chart has no stitches, so there is nothing to import.');
  used.sort((a, b) => b.stitches + b.bsStitches - (a.stitches + a.bsStitches));

  const nonDmc = [...new Set(used.filter((c) => c.brand !== 'DMC').map((c) => c.brand))];
  if (nonDmc.length) warnings.push(`Includes non-DMC floss (${nonDmc.join(', ')}). They are tracked separately from DMC.`);

  return {
    title: String(data.info?.title || '').trim(),
    suggestedName: cleanFileName(fileName),
    width,
    height,
    strands: crossStrands ?? 2,
    bsStrands: bsStrands ?? 1,
    formatVersion: data.v ?? null,
    colors: used,
    totalStitches: used.reduce((a, c) => a + c.stitches, 0),
    warnings,
  };
}
