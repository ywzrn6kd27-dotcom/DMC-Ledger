import { useState } from 'react';
import { useApp } from '../lib/context.js';
import * as ops from '../lib/ops.js';
import { parseBulk } from '../lib/bulk.js';
import { fmtSkeins, plural } from '../lib/utils.js';
import { placeholderColor } from './ColorDetails.jsx';
import { ColorCell, ColorsField, Icon, Modal, Stepper, TypeSelect } from './ui.jsx';

const blankUnknown = (r) => ({ ...r, name: '', type: 'solid', colors: ['#808080'], skip: false });

// Review step for bulk add: nothing is saved until you confirm here.
export default function BulkReview({ initial, onClose, onDone }) {
  const { update, catalog, toast } = useApp();
  const [rows, setRows] = useState(() => initial.rows.map((r) => (r.color ? r : blankUnknown(r))));
  const [junk, setJunk] = useState(initial.junk);

  const known = rows.filter((r) => r.color);
  const unknown = rows.filter((r) => !r.color);
  const blocked = unknown.some((r) => !r.skip && !r.name.trim());
  const patch = (id, p) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const drop = (id) => setRows((rs) => rs.filter((r) => r.id !== id));

  const recheck = () => {
    const { rows: found, junk: left } = parseBulk(junk.join(' '), catalog);
    setRows((rs) => {
      const next = [...rs];
      for (const f of found) {
        const hit = next.find((r) => r.id === f.id);
        if (hit) hit.qty += f.qty;
        else next.push(f.color ? f : blankUnknown(f));
      }
      return next;
    });
    setJunk(left);
  };

  const sameAsPrevious = (idx) => {
    const prev = unknown[idx - 1];
    if (prev) patch(unknown[idx].id, { type: prev.type, colors: prev.colors });
  };

  const confirm = () => {
    update((s) => {
      let next = s;
      for (const r of unknown) {
        const c = r.skip ? placeholderColor(r.code) : { brand: 'DMC', code: r.code, name: r.name.trim(), hex: r.colors[0], type: r.type, colors: r.type === 'variegated' ? r.colors : [] };
        next = ops.saveCustomColor(next, c);
        next = ops.addStock(next, { brand: c.brand, code: c.code }, { whole: r.qty });
      }
      for (const r of known) next = ops.addStock(next, r.color, { whole: r.qty });
      return next;
    });
    const skeins = rows.reduce((a, r) => a + r.qty, 0);
    toast(`Added ${plural(rows.length, 'color')} (${plural(skeins, 'skein')})${unknown.length ? `, ${unknown.length} new to your catalog` : ''}`);
    onDone?.(rows);
    onClose();
  };

  return (
    <Modal
      title="Review before adding"
      onClose={onClose}
      footer={
        <>
          <span className="muted small left">{rows.length ? `Adding ${plural(rows.length, 'color')}${unknown.length ? ` (${unknown.length} new to your catalog)` : ''}` : 'Nothing to add'}</span>
          <button className="btn" onClick={onClose}>Back</button>
          <button className="btn primary" disabled={!rows.length || blocked} onClick={confirm}>Add to supply</button>
        </>
      }
    >
      {known.length > 0 && (
        <section className="stack tight">
          <h3>Ready ({known.length})</h3>
          <div className="panel flush"><div className="list">
            {known.map((r) => (
              <div className="item" key={r.id}>
                <div className="grow"><ColorCell color={r.color} /></div>
                <Stepper small label={`Skeins of ${r.code}`} value={r.qty} min={1} onChange={(v) => patch(r.id, { qty: v })} />
                <button className="icon-btn" aria-label={`Remove ${r.code}`} onClick={() => drop(r.id)}><Icon name="x" size={16} /></button>
              </div>
            ))}
          </div></div>
        </section>
      )}

      {unknown.length > 0 && (
        <section className="stack tight">
          <h3>Needs details ({unknown.length})</h3>
          <p className="muted small">These codes are not in the catalog. Describe them so they look right, or skip for now and they are added as gray placeholders you can fill in later.</p>
          {unknown.map((r, idx) => (
            <div className="panel stack tight" key={r.id}>
              <div className="row spread">
                <b>{r.code}</b>
                <div className="row tight">
                  <Stepper small label={`Skeins of ${r.code}`} value={r.qty} min={1} onChange={(v) => patch(r.id, { qty: v })} />
                  <button className="icon-btn" aria-label={`Remove ${r.code}`} onClick={() => drop(r.id)}><Icon name="x" size={16} /></button>
                </div>
              </div>
              <label className="row tight" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={r.skip} onChange={(e) => patch(r.id, { skip: e.target.checked })} /> <span>Skip details for now</span>
              </label>
              {!r.skip && (
                <>
                  <div className="field-grid">
                    <div className="field"><label htmlFor={`n-${r.id}`}>Name</label><input id={`n-${r.id}`} className="input" value={r.name} onChange={(e) => patch(r.id, { name: e.target.value })} placeholder="Required unless skipped" /></div>
                    <div className="field"><label htmlFor={`t-${r.id}`}>Thread type</label><TypeSelect id={`t-${r.id}`} value={r.type} onChange={(t) => patch(r.id, { type: t })} /></div>
                  </div>
                  <div className="field"><label>{r.type === 'variegated' ? 'Colors in the skein (2 to 5)' : 'Color'}</label><ColorsField type={r.type} colors={r.colors} onChange={(c) => patch(r.id, { colors: c })} /></div>
                  {idx > 0 && <div><button className="btn small" onClick={() => sameAsPrevious(idx)}>Same type and colors as above</button></div>}
                </>
              )}
            </div>
          ))}
        </section>
      )}

      {junk.length > 0 && (
        <section className="stack tight">
          <h3>Not understood ({junk.length})</h3>
          <p className="muted small">These did not look like thread codes. Fix them and tap Recheck, or discard.</p>
          {junk.map((j, i) => (
            <div className="row" key={i}>
              <input className="input grow" aria-label="Text to fix" value={j} onChange={(e) => setJunk((js) => js.map((x, k) => (k === i ? e.target.value : x)))} />
              <button className="btn small" onClick={() => setJunk((js) => js.filter((_, k) => k !== i))}>Discard</button>
            </div>
          ))}
          <div><button className="btn" onClick={recheck}>Recheck</button></div>
        </section>
      )}

      {!rows.length && !junk.length && <p className="muted">Nothing left to add.</p>}
      {blocked && <p className="banner">Give each new color a name, or tick “Skip details for now”.</p>}
    </Modal>
  );
}
