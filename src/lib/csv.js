import { totalOf, assignedByKey } from './ops.js';
import { fmtSkeins } from './utils.js';

export function toCsv(rows) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return rows.map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
}

export function inventoryCsv(state, catalog) {
  const assigned = assignedByKey(state);
  const rows = [['Brand', 'Code', 'Name', 'Hex', 'Whole skeins', 'Partial skeins', 'Total skeins', 'Reserved', 'Available', 'Minimum', 'Status', 'Notes']];
  const items = Object.values(state.inventory).sort((a, b) => a.brand.localeCompare(b.brand) || a.code.localeCompare(b.code, undefined, { numeric: true }));
  for (const it of items) {
    const c = catalog.find(it.brand, it.code);
    const total = totalOf(it);
    const res = assigned.get(`${it.brand}:${it.code}`) || 0;
    const status = it.usedUp && total === 0 ? 'Used up' : total === 0 ? 'Empty' : it.partials.length ? 'Has partial' : 'In stock';
    rows.push([it.brand, it.code, c?.name || '', c?.hex || '', it.whole, it.partials.map(fmtSkeins).join(' + '), fmtSkeins(total), fmtSkeins(res), fmtSkeins(total - res), it.minStock || '', status, it.notes || '']);
  }
  return toCsv(rows);
}

export function shoppingCsv(state) {
  const rows = [['List', 'Brand', 'Code', 'Name', 'Quantity', 'Purchased', 'Note']];
  for (const l of state.shopping.lists)
    for (const i of l.items) rows.push([l.name, i.brand, i.code, i.name, i.qty, i.checked ? 'yes' : 'no', i.note || '']);
  return toCsv(rows);
}
