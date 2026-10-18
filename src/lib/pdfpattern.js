import { colorKey } from './utils.js';
import { cleanFileName } from './fcjson.js';

// Reads a cross-stitch pattern PDF: finds the thread key (code and name per color) and, when the
// designer lists it, the per-color thread consumption (length and skein estimate). Stitch counts per
// color are not read from the chart pages, so the skein estimates come from the PDF itself.
// Layouts vary a lot between designers, so the result always goes through a review screen.

const PDFJS_VERSION = '5.6.205';
const CDN = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/legacy/build/`;
let loading = null;

// pdf.js is loaded only when you import a PDF, from a CDN, so the app itself stays small.
export function loadPdfJs() {
  if (!loading) {
    loading = (async () => {
      const lib = await import(/* @vite-ignore */ CDN + 'pdf.min.mjs');
      let workerSrc = CDN + 'pdf.worker.min.mjs';
      try {
        const r = await fetch(workerSrc);
        if (r.ok) workerSrc = URL.createObjectURL(new Blob([await r.text()], { type: 'text/javascript' }));
      } catch { /* fall back to the direct URL */ }
      lib.GlobalWorkerOptions.workerSrc = workerSrc;
      return lib;
    })();
    loading.catch(() => { loading = null; });
  }
  return loading;
}

// Group text items into rows (by vertical position) and join each row's cells with spaces.
export function itemsToRows(items) {
  const cells = items
    .filter((i) => typeof i.str === 'string' && i.str.trim() !== '')
    .map((i) => ({ s: i.str.trim(), x: i.transform[4], y: i.transform[5], w: i.width || 0 }))
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const rows = [];
  for (const c of cells) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(row.y - c.y) <= 2.5) row.cells.push(c);
    else rows.push({ y: c.y, cells: [c] });
  }
  return rows.map((r) => {
    r.cells.sort((a, b) => a.x - b.x);
    let out = '';
    r.cells.forEach((c, i) => {
      const prev = r.cells[i - 1];
      out += i && c.x - (prev.x + prev.w) > 0.8 ? ' ' + c.s : (i ? '' : '') + c.s;
    });
    return out.replace(/\s+/g, ' ').trim();
  }).filter(Boolean);
}

export async function extractPdfPages(lib, data, maxPages = 80) {
  const doc = await lib.getDocument({ data: new Uint8Array(data), isEvalSupported: false, useSystemFonts: true }).promise;
  const pages = [];
  for (let p = 1; p <= Math.min(doc.numPages, maxPages); p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    pages.push(itemsToRows(tc.items));
  }
  return pages;
}

const CODE = String.raw`(?:\d{1,4}|B5200|Ecru|White|Blanc|[A-Z]\d{3,4})`;
const WORD = String.raw`[A-Za-z][A-Za-z'’\-]*`;
const NAME = `${WORD}(?:\\s+${WORD})*?`;
const PAIR = new RegExp(`(?:^|\\s)(${CODE})\\s+(${NAME})(?=\\s+(?:\\S\\s+)?${CODE}\\s+${WORD}|\\s*$)`, 'gi');
const TRIPLE = new RegExp(`(?:^|\\s)(${CODE})\\s+(\\d+(?:\\.\\d+)?)\\s+(\\d+)(?!\\d)`, 'gi');

const END_OF_KEY = /^(backstitch|consumption|half\b|three|french|specialty|blended|stitch(?:es)?\b|colou?rs?:)/i;

export function parsePatternPages(pages, fileName = '') {
  const allRows = pages.flat();
  const text = allRows.join('\n');
  if (text.replace(/\s/g, '').length < 40)
    throw new Error('This PDF has no readable text (it may be a scan or images only), so the colors cannot be read.');

  const warnings = [];
  let keyColors = [];
  let keyPage = -1;
  let consumption = new Map();
  let brand = 'DMC';

  // 1. The thread key: rows after a "Colour Name" header, up to the next section.
  pages.forEach((rows, pi) => {
    if (keyColors.length) return;
    const h = rows.findIndex((r) => /colou?r\s+name/i.test(r) && /\b(no\.?|code|dmc)\b/i.test(r));
    if (h < 0) return;
    const found = new Map();
    for (let i = h + 1; i < rows.length; i++) {
      if (END_OF_KEY.test(rows[i])) break;
      PAIR.lastIndex = 0;
      let m;
      while ((m = PAIR.exec(rows[i]))) {
        const code = normalizeCode(m[1]);
        if (!found.has(code)) found.set(code, m[2].trim());
      }
    }
    if (found.size) { keyColors = [...found.entries()].map(([code, name]) => ({ code, name })); keyPage = pi; }
  });

  // 2. Thread consumption: "code length skein-estimate" triples after a "Length" header on the same page.
  if (keyPage >= 0) {
    const rows = pages[keyPage];
    const h = rows.findIndex((r) => /length\s*\(?\s*m\s*\)?/i.test(r) && /skein/i.test(r));
    if (h >= 0) {
      for (let i = h + 1; i < rows.length; i++) {
        TRIPLE.lastIndex = 0;
        let m;
        while ((m = TRIPLE.exec(rows[i]))) consumption.set(normalizeCode(m[1]), { meters: parseFloat(m[2]), skeins: parseInt(m[3], 10) });
      }
    }
    const kp = pages[keyPage].join('\n');
    const b = /colou?rs?:\s*([A-Za-z][A-Za-z ]*?)\s*(?:\n|$)/i.exec(kp);
    if (b && b[1].trim() && !/^dmc$/i.test(b[1].trim()) && b[1].trim().length < 20) brand = b[1].trim();
  }

  // 3. Fallback: codes written as "DMC 310" anywhere in the text. Low confidence.
  let lowConfidence = false;
  if (!keyColors.length) {
    const seen = new Set();
    for (const m of text.matchAll(/\bDMC\s*#?\s*(\d{2,4}|B5200|Ecru)\b/gi)) seen.add(normalizeCode(m[1]));
    if (!seen.size) throw new Error('I could not find a thread key in this PDF. It may be an image-only pattern, or use a layout I do not recognize.');
    keyColors = [...seen].map((code) => ({ code, name: '' }));
    lowConfidence = true;
    warnings.push('No thread key table was found. These are DMC numbers mentioned in the PDF; check that the list is right and add anything missing.');
  }

  // Pattern details
  const size = /(?:^|\n)\s*Stitches:\s*(\d+)\s*[x×]\s*(\d+)/i.exec(text);
  const size2 = /(?:^|\n)\s*Size:\s*(\d+)\s*[x×]\s*(\d+)\s*(?:\n|$)/i.exec(text);
  let width = 0, height = 0;
  if (size) { width = +size[1]; height = +size[2]; }
  else if (size2) { width = +size2[1]; height = +size2[2]; }
  if (size && size2 && (size[1] !== size2[1] || size[2] !== size2[2]))
    warnings.push(`The PDF gives two pattern sizes (${size[1]}×${size[2]} and ${size2[1]}×${size2[2]}). Check which is right in the fabric size settings.`);
  const cross = /Cross Stitches:\s*(\d[\d,]*)/i.exec(text);
  const back = /Backstitches:\s*(\d+)/i.exec(text);
  const declared = /Palette:\s*(\d+)\s*colou?rs?/i.exec(text) || /Colou?rs:\s*(\d+)\b/i.exec(text);
  if (declared && !lowConfidence && +declared[1] !== keyColors.length)
    warnings.push(`The PDF says ${declared[1]} colors but ${keyColors.length} were read. Check the list.`);

  const aida = /Aida\s*(?:№|No\.?|#)?\s*(\d{2})\b/i.exec(text);
  const strandsM = /Use\s+(\d)\s+strands?\s+of\s+thread\s+for\s+full\s+cross/i.exec(text);
  const bsM = /Backstitch\s*\n?\s*(\d)\s+strands?\s+of\s+thread\s*(?:DMC\s*)?(\w+)?/i.exec(text);
  const stock = /\((?:with\s+)?(\d+)%\s*thread\s*stock\)/i.exec(text);

  let title = '';
  const t1 = /for design\s*["“«]\s*([^"”»\n]+?)\s*["”»]/i.exec(text);
  const t2 = /«\s*([^»]+?)\s*»/.exec(text);
  const t3 = /(?:^|\n)\s*Name:\s*(.+)/i.exec(text);
  title = (t1?.[1] || t2?.[1] || t3?.[1] || '').trim();

  const hasConsumption = consumption.size > 0;
  const colors = keyColors.map(({ code, name }) => {
    const use = consumption.get(code);
    return {
      key: colorKey(brand, code), brand, code, name, hex: '#9AA0A6', stitches: 0, bsStitches: 0,
      need: hasConsumption ? use?.skeins ?? 1 : 1,
      ...(use ? { meters: use.meters } : {}),
    };
  });

  if (hasConsumption) {
    const where = [aida ? `${aida[1]}-count` : '', stock ? `${stock[1]}% extra thread` : ''].filter(Boolean).join(', ');
    warnings.push(`Skein amounts come from the PDF's own estimates${where ? ` (${where})` : ''}. Stitch counts per color are not in a PDF, so these will not change if you change the fabric count.`);
  } else {
    warnings.push('This PDF has no thread consumption table, so each color is set to 1 skein. Adjust the amounts after importing.');
  }
  if (bsM) warnings.push(`Backstitch uses ${bsM[1]} strand(s)${bsM[2] ? ` of ${bsM[2]}` : ''}.`);

  return {
    source: 'pdf',
    title,
    suggestedName: title || cleanFileName(fileName.replace(/\.pdf$/i, '')),
    width,
    height,
    strands: strandsM ? +strandsM[1] : 2,
    bsStrands: bsM ? +bsM[1] : 1,
    fabricCount: aida ? +aida[1] : null,
    colors,
    totalStitches: cross ? parseInt(cross[1].replace(/,/g, ''), 10) : 0,
    backstitchCount: back ? +back[1] : 0,
    lowConfidence,
    warnings,
  };
}

function normalizeCode(c) {
  const s = String(c).trim();
  if (/^b5200$/i.test(s)) return 'B5200';
  if (/^ecru$/i.test(s)) return 'Ecru';
  if (/^(white|blanc)$/i.test(s)) return 'White';
  return /^[a-z]\d/i.test(s) ? s.toUpperCase() : s;
}

export async function parsePdfFile(file) {
  const lib = await loadPdfJs().catch(() => {
    throw new Error('The PDF reader could not be loaded. PDF import needs an internet connection the first time.');
  });
  const pages = await extractPdfPages(lib, await file.arrayBuffer());
  return parsePatternPages(pages, file.name);
}
