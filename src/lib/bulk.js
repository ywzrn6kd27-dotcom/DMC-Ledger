// "310, 666 x2, 797:3 B5200" -> [{ color, qty }]
const TOKEN = /([A-Za-z]?\d+|ecru|white|blanc)(?:\s*[x×*:]\s*(\d+))?/gi;

export function parseBulk(text, catalog) {
  const found = new Map();
  const unknown = [];
  const src = String(text || '');
  let m;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(src))) {
    const color = catalog.resolveCode(m[1]);
    const qty = m[2] ? Math.max(1, parseInt(m[2], 10)) : 1;
    if (!color) {
      unknown.push(m[1]);
      continue;
    }
    const cur = found.get(color.key);
    if (cur) cur.qty += qty;
    else found.set(color.key, { color, qty });
  }
  return { found: [...found.values()], unknown: [...new Set(unknown)] };
}
