// Parse pasted codes for the bulk-add review step.
//   "310, 666 x2, 797:3\nB5200 blanc" -> rows (known or unknown colors) + unreadable fragments
// Nothing here changes any data; the review screen decides what gets added.

const CODE = /^([BCDEScdes]?\d+|ecru|white|blanc)(?:[x×*:](\d+))?$/i;

export function normalizeUnknownCode(raw) {
  return /^[a-z]/i.test(raw) ? raw.toUpperCase() : raw.replace(/^0+(?=\d)/, (m) => m); // keep digits as typed
}

export function parseBulk(text, catalog) {
  const byKey = new Map();
  const junk = [];
  const src = String(text || '')
    .replace(/(\d|ecru|white|blanc)\s*[x×*:]\s*(\d+)/gi, '$1x$2'); // "666 x 2" -> "666x2"
  for (const token of src.split(/[\s,;]+/).filter(Boolean)) {
    const m = CODE.exec(token);
    if (!m) { junk.push(token); continue; }
    const qty = m[2] ? Math.max(1, parseInt(m[2], 10)) : 1;
    const color = catalog.resolveCode(m[1]);
    const key = color ? color.key : 'new:' + normalizeUnknownCode(m[1]).toLowerCase();
    const cur = byKey.get(key);
    if (cur) cur.qty += qty;
    else byKey.set(key, { id: key, qty, color: color || null, code: color ? color.code : normalizeUnknownCode(m[1]) });
  }
  return { rows: [...byKey.values()], junk: [...new Set(junk)] };
}

// Rows from colors picked in the catalog browser (all known, quantity 1).
export function rowsFromColors(colors) {
  return colors.map((c) => ({ id: c.key, qty: 1, color: c, code: c.code }));
}
