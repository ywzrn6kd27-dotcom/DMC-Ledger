import { parseFcjson } from './fcjson.js';
import { parseOxs } from './oxs.js';
import { parsePdfFile } from './pdfpattern.js';

export const IMPORT_ACCEPT = '.fcjson,.oxs,.pdf,.json,.xml,application/pdf,application/json';

// Reads a pattern file of any supported type and returns the parsed chart.
export async function readPatternFile(file) {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return parsePdfFile(file);
  const text = await file.text();
  const head = text.slice(0, 400).trimStart().replace(/^\uFEFF/, '');
  if (name.endsWith('.oxs') || name.endsWith('.xml') || head.startsWith('<')) return parseOxs(text, file.name);
  return { ...parseFcjson(text, file.name), source: 'fcjson' };
}
