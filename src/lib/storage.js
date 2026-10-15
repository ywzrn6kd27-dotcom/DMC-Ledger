import { emptyState, normalizeState } from './ops.js';

export const STORAGE_KEY = 'floss-ledger:v1';
const CORRUPT_KEY = 'floss-ledger:corrupt-backup';

export function loadState() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { state: emptyState(), recovered: false };
    return { state: normalizeState(JSON.parse(raw)), recovered: false };
  } catch {
    // Keep the unreadable data around instead of silently overwriting it.
    try { if (raw) localStorage.setItem(CORRUPT_KEY, raw); } catch { /* ignore */ }
    return { state: emptyState(), recovered: true };
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearState() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export function makeBackup(state) {
  return JSON.stringify({ app: 'floss-ledger', schema: 1, exportedAt: new Date().toISOString(), state }, null, 2);
}

export function readBackup(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('That file is not valid JSON.'); }
  const raw = data?.app === 'floss-ledger' ? data.state : data;
  if (!raw || typeof raw !== 'object' || !('inventory' in raw || 'projects' in raw))
    throw new Error('This does not look like a Floss Ledger backup.');
  return normalizeState(raw);
}
