export const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);

export const colorKey = (brand, code) => `${brand}:${code}`;

export function hexToRgb(hex) {
  let h = String(hex || '').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  if (Number.isNaN(n) || h.length !== 6) return [128, 128, 128];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]) {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

export const FAMILIES = [
  'Red', 'Pink', 'Orange', 'Yellow', 'Brown', 'Green', 'Teal', 'Blue', 'Purple', 'Gray', 'White', 'Black',
];

// Rough browsing families derived from the hex value. Good enough to filter by,
// not meant to match DMC's own color families.
export function colorFamily(hex) {
  const [h, s, l] = rgbToHsl(...hexToRgb(hex));
  if (l < 0.1) return 'Black';
  if (s < 0.12) return l > 0.9 ? 'White' : 'Gray';
  if (l > 0.94) return 'White';
  if (h < 15 || h >= 345) return l > 0.72 ? 'Pink' : 'Red';
  if (h < 45) {
    if (l < 0.5 || s < 0.45) return 'Brown';
    return l > 0.78 ? 'Pink' : 'Orange';
  }
  if (h < 70) return s < 0.4 && l < 0.7 ? 'Brown' : 'Yellow';
  if (h < 165) return 'Green';
  if (h < 200) return 'Teal';
  if (h < 255) return 'Blue';
  if (h < 300) return 'Purple';
  if (h < 330) return l > 0.6 ? 'Pink' : 'Purple';
  return l > 0.5 ? 'Pink' : 'Red';
}

export function lightness(hex) {
  return rgbToHsl(...hexToRgb(hex))[2];
}

const GLYPH = { 0.25: '¼', 0.5: '½', 0.75: '¾' };
export const PARTIAL_OPTIONS = [0.25, 0.5, 0.75];

// 1.5 -> "1½", 0.25 -> "¼", 0 -> "0"
export function fmtSkeins(n) {
  if (!Number.isFinite(n) || n <= 0) return '0';
  const whole = Math.floor(n + 1e-9);
  const frac = Math.round((n - whole) * 100) / 100;
  if (frac === 0) return String(whole);
  const g = GLYPH[frac];
  if (!g) return n.toFixed(2).replace(/\.?0+$/, '');
  return whole > 0 ? `${whole}${g}` : g;
}

export function plural(n, one, many = one + 's') {
  return `${n} ${n === 1 ? one : many}`;
}

export function naturalCodeCompare(a, b) {
  const an = /^\d+$/.test(a), bn = /^\d+$/.test(b);
  if (an && bn) return parseInt(a, 10) - parseInt(b, 10) || a.localeCompare(b);
  if (an) return -1;
  if (bn) return 1;
  return a.localeCompare(b, undefined, { numeric: true });
}

export function download(filename, text, mime = 'text/plain') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
