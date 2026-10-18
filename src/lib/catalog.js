import { colorKey, colorFamily, naturalCodeCompare, hexToRgb } from './utils.js';

// Other names used for the same DMC color (FlossCross exports white as BLANC).
const SPECIAL = { blanc: 'White', white: 'White', ecru: 'Ecru', snow: 'B5200', 'snow white': 'B5200', b5200: 'B5200' };
const ALIAS_TEXT = { White: 'blanc', B5200: 'snow' };

const HEX = /^#[0-9a-f]{6}$/i;

export function decorate(c) {
  const brand = c.brand || 'DMC';
  const code = String(c.code).trim();
  const hex = HEX.test(c.hex || '') ? c.hex.toUpperCase() : '#808080';
  const colors = Array.isArray(c.colors) ? c.colors.filter((h) => HEX.test(h)).map((h) => h.toUpperCase()).slice(0, 5) : [];
  const type = ['solid', 'variegated', 'metallic', 'other'].includes(c.type) ? c.type : 'solid';
  const multi = type === 'variegated' && colors.length > 1;
  return {
    brand,
    code,
    name: c.name || '',
    hex: multi ? colors[0] : hex,
    colors: multi ? colors : [],
    type,
    key: colorKey(brand, code),
    family: multi ? 'Multi' : colorFamily(hex),
    codeNum: /^\d+$/.test(code) ? code.replace(/^0+/, '') || '0' : null,
    custom: !!c.custom,
    pending: !!c.pending,
    alias: brand === 'DMC' ? ALIAS_TEXT[code] || '' : '',
  };
}

// The code a built-in catalog would use for this input (case and alias aware), or null.
export function canonicalCode(catalog, brand, code) {
  if (brand !== 'DMC') return null;
  const raw = String(code || '').trim();
  const alias = SPECIAL[raw.toLowerCase()];
  if (alias) return alias;
  const hit = catalog.list.find((c) => c.brand === brand && c.code.toLowerCase() === raw.toLowerCase());
  return hit ? hit.code : null;
}

// builtin: [{code,name,hex}] (DMC). custom: [{brand,code,name,hex}] which are
// added to, or override, the built-in list.
export function makeCatalog(builtin, custom = []) {
  const byKey = new Map();
  for (const c of builtin) {
    const d = decorate({ ...c, brand: 'DMC' });
    byKey.set(d.key, d);
  }
  for (const c of custom) {
    const d = decorate({ ...c, custom: true });
    byKey.set(d.key, d);
  }
  const list = [...byKey.values()].sort(
    (a, b) => a.brand.localeCompare(b.brand) || naturalCodeCompare(a.code, b.code),
  );

  function scoreToken(c, t, tNum) {
    const code = c.code.toLowerCase();
    if (code === t || (tNum !== null && c.codeNum !== null && c.codeNum === tNum)) return 100;
    if (code.startsWith(t) || (tNum !== null && c.codeNum !== null && c.codeNum.startsWith(tNum)))
      return 80 - code.length * 0.1;
    const name = (c.name + ' ' + c.alias).toLowerCase();
    if (name.startsWith(t) || name.split(/[\s-]+/).some((w) => w.startsWith(t))) return 55;
    if (t.length >= 2 && code.includes(t)) return 45;
    if (t.length >= 3 && name.includes(t)) return 35;
    if (t.length >= 3 && c.family.toLowerCase().startsWith(t)) return 20;
    if (t.length >= 3 && c.type.startsWith(t)) return 20;
    if (t.length >= 3 && c.brand.toLowerCase().startsWith(t)) return 10;
    return 0;
  }

  function search(query, limit = 12) {
    const tokens = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return [];
    const scored = [];
    for (const c of list) {
      let min = Infinity;
      for (const t of tokens) {
        const tNum = /^\d+$/.test(t) ? t.replace(/^0+/, '') : null;
        const s = scoreToken(c, t, tNum === '' ? null : tNum);
        if (s === 0) { min = 0; break; }
        if (s < min) min = s;
      }
      if (min > 0) scored.push([min, c]);
    }
    scored.sort((a, b) => b[0] - a[0] || naturalCodeCompare(a[1].code, b[1].code));
    return scored.slice(0, limit).map((x) => x[1]);
  }

  function find(brand, code) {
    return byKey.get(colorKey(brand, code)) || null;
  }

  // Resolve loosely typed input ("310", "b5200", "1", "ecru") to a catalog color.
  function resolveCode(input, brand = 'DMC') {
    const raw = String(input || '').trim();
    if (!raw) return null;
    const direct = find(brand, raw);
    if (direct) return direct;
    const lower = raw.toLowerCase();
    if (brand === 'DMC' && SPECIAL[lower]) return find(brand, SPECIAL[lower]);
    const ci = list.find((c) => c.brand === brand && c.code.toLowerCase() === lower);
    if (ci) return ci;
    if (/^\d+$/.test(raw)) {
      const stripped = raw.replace(/^0+/, '');
      return list.find((c) => c.brand === brand && c.codeNum !== null && c.codeNum === stripped) || null;
    }
    return null;
  }

  return { list, byKey, search, find, resolveCode, size: list.length };
}

// Parse a user-supplied catalog: JSON array / {colors:[...]} or CSV with a header
// row containing code, name, hex (and optionally brand).
export function parseCatalogInput(text) {
  const colors = [];
  const errors = [];
  const push = (o, where) => {
    const code = String(o.code ?? o.id ?? '').trim();
    let hex = String(o.hex ?? '').trim();
    if (hex && !hex.startsWith('#')) hex = '#' + hex;
    if (!code) return errors.push(`${where}: missing code`);
    if (!hex && Array.isArray(o.colors) && o.colors[0]) hex = o.colors[0];
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return errors.push(`${where}: "${code}" has no valid hex color`);
    let multi = o.colors;
    if (typeof multi === 'string') multi = multi.split(/[|;\s]+/).filter(Boolean).map((h) => (h.startsWith('#') ? h : '#' + h));
    const type = String(o.type || '').toLowerCase();
    colors.push({
      brand: String(o.brand || o.sys || 'DMC').trim() || 'DMC', code, name: String(o.name || '').trim(), hex: hex.toUpperCase(),
      ...(['solid', 'variegated', 'metallic', 'other'].includes(type) ? { type } : {}),
      ...(Array.isArray(multi) && multi.length > 1 ? { colors: multi } : {}),
    });
  };
  const trimmed = String(text || '').trim();
  if (!trimmed) return { colors, errors: ['The file is empty.'] };
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    let data;
    try { data = JSON.parse(trimmed); } catch { return { colors, errors: ['Could not read that JSON file.'] }; }
    const arr = Array.isArray(data) ? data : data.colors || data.floss || [];
    if (!Array.isArray(arr)) return { colors, errors: ['Expected a list of colors.'] };
    arr.forEach((o, i) => push(o || {}, `Item ${i + 1}`));
  } else {
    const rows = parseCsv(trimmed);
    const head = rows.shift()?.map((h) => h.trim().toLowerCase()) || [];
    const idx = (n) => head.indexOf(n);
    if (idx('code') < 0 || idx('hex') < 0) return { colors, errors: ['CSV needs a header row with at least "code" and "hex" columns.'] };
    rows.forEach((r, i) =>
      push({ code: r[idx('code')], name: r[idx('name')], hex: r[idx('hex')], brand: idx('brand') >= 0 ? r[idx('brand')] : '', type: idx('type') >= 0 ? r[idx('type')] : '', colors: idx('colors') >= 0 ? r[idx('colors')] : '' }, `Row ${i + 2}`),
    );
  }
  return { colors, errors };
}

export function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

export { hexToRgb };
