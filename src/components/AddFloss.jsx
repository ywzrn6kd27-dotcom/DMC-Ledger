import { useState } from 'react';
import { useApp } from '../lib/context.js';
import * as ops from '../lib/ops.js';
import { parseBulk, rowsFromColors } from '../lib/bulk.js';
import { fmtSkeins, uid } from '../lib/utils.js';
import ColorPicker from './ColorPicker.jsx';
import BulkReview from './BulkReview.jsx';
import { ColorCell, PartialEditor, Stepper } from './ui.jsx';

export default function AddFloss() {
  const { state, update, catalog, toast } = useApp();
  const [color, setColor] = useState(null);
  const [mode, setMode] = useState('add');
  const [whole, setWhole] = useState(1);
  const [partials, setPartials] = useState([]);
  const [projectName, setProjectName] = useState('');
  const [assignQty, setAssignQty] = useState(1);
  const [minStock, setMinStock] = useState(null);
  const [recent, setRecent] = useState([]);
  const [bulk, setBulk] = useState('');
  const [review, setReview] = useState(null);

  const cur = color ? state.inventory[color.key] : null;
  const assigned = color ? ops.assignedByKey(state).get(color.key) || 0 : 0;
  const activeProjects = state.projects.filter(ops.isActive);
  const matched = activeProjects.find((p) => p.name.trim().toLowerCase() === projectName.trim().toLowerCase());

  const select = (c) => {
    setColor(c);
    setMode('add');
    setWhole(1);
    setPartials([]);
    setProjectName('');
    setAssignQty(1);
    setMinStock(null);
  };

  const hasStock = whole > 0 || partials.length > 0;
  const projected = color ? (mode === 'set' ? whole + partials.reduce((a, b) => a + b, 0) : ops.totalOf(cur) + whole + partials.reduce((a, b) => a + b, 0)) : 0;
  const overAssign = projectName.trim() && assignQty > projected - assigned + (matched ? matched.colors.find((c) => c.key === color?.key)?.assigned || 0 : 0);

  const save = () => {
    if (!color) return;
    if (!hasStock && mode === 'add') return toast('Enter at least one skein or a partial.', 'bad');
    update((s) => {
      let next = ops.addStock(s, color, { whole, partials, mode, minStock: minStock ?? undefined });
      const name = projectName.trim();
      if (name && assignQty > 0) {
        let proj = next.projects.find((p) => ops.isActive(p) && p.name.trim().toLowerCase() === name.toLowerCase());
        if (!proj) {
          proj = ops.makeProject({ id: uid(), name, fabricCount: next.settings.defaultFabricCount, waste: next.settings.defaultWaste });
          next = ops.addProject(next, proj);
        }
        const existing = proj.colors.find((c) => c.key === color.key);
        next = ops.upsertProjectColor(next, proj.id, color, { assigned: (existing?.assigned || 0) + assignQty });
      }
      return next;
    });
    const bits = [whole > 0 && `${whole} skein${whole === 1 ? '' : 's'}`, partials.length > 0 && `${partials.map(fmtSkeins).join(' + ')} partial`].filter(Boolean).join(' + ');
    toast(`${mode === 'set' ? 'Set' : 'Added'} ${color.code} ${color.name}: ${bits || 'no stock'}`);
    setRecent((r) => [{ color, bits, id: uid() }, ...r].slice(0, 6));
    setColor(null);
  };

  const openReview = () => {
    const parsed = parseBulk(bulk, catalog);
    if (!parsed.rows.length && !parsed.junk.length) return toast('Paste some codes first.', 'bad');
    setReview(parsed);
  };

  const reviewed = (rows) => {
    setRecent((r) => [...rows.map((x) => ({ color: x.color || { brand: 'DMC', code: x.code, name: '', hex: '#9AA0A6' }, bits: `${x.qty} skein${x.qty === 1 ? '' : 's'}`, id: uid() })), ...r].slice(0, 6));
    setBulk('');
  };

  return (
    <div className="stack">
      <div className="page-head"><div><h1>Add floss</h1><p className="muted">Search for a color, then record what you have.</p></div></div>

      <div className="panel stack">
        <ColorPicker onSelect={select} onMany={(list) => setReview({ rows: rowsFromColors(list), junk: [] })} autoFocus hint={(c) => { const t = ops.totalOf(state.inventory[c.key]); return t > 0 ? `have ${fmtSkeins(t)}` : ''; }} />

        {!color && <p className="muted small">Tip: type “310” for Black, “lav” for the lavenders, or tap Browse to scroll the whole catalog. Codes not in the catalog can be added too.</p>}

        {color && (
          <div className="stack">
            <div className="row spread">
              <ColorCell color={color} sub={color.family} />
              <span className="pill">{cur ? `Have ${fmtSkeins(ops.totalOf(cur))}${assigned ? ` · ${fmtSkeins(assigned)} reserved` : ''}` : 'Not in supply yet'}</span>
            </div>
            <div style={{ height: 14, borderRadius: 7, background: color.hex, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.16)' }} />

            {cur && (
              <div className="row tight" role="radiogroup" aria-label="How to apply">
                <button type="button" className="chip" aria-pressed={mode === 'add'} onClick={() => setMode('add')}>Add to what I have</button>
                <button type="button" className="chip" aria-pressed={mode === 'set'} onClick={() => setMode('set')}>Replace my count</button>
              </div>
            )}

            <div className="field-grid">
              <div className="field"><label>Whole skeins {mode === 'set' ? '(total)' : 'to add'}</label><Stepper label="Whole skeins" value={whole} onChange={setWhole} /></div>
              <div className="field"><label>Keep at least (optional)</label><Stepper label="Minimum on hand" value={minStock ?? cur?.minStock ?? 0} onChange={setMinStock} /></div>
            </div>

            <div className="field"><label>Partial skeins</label><PartialEditor partials={partials} onChange={setPartials} /></div>

            <div className="field-grid">
              <div className="field">
                <label htmlFor="proj">Assign to a project (optional)</label>
                <input id="proj" className="input" list="project-names" placeholder="Project name" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
                <datalist id="project-names">{activeProjects.map((p) => <option key={p.id} value={p.name} />)}</datalist>
                {projectName.trim() && !matched && <span className="muted small">A new project “{projectName.trim()}” will be created.</span>}
              </div>
              <div className="field"><label>Skeins to reserve</label><Stepper label="Skeins to reserve" value={assignQty} step={0.25} onChange={setAssignQty} /></div>
            </div>
            {overAssign && <div className="banner">That is more than you will have available. It will show up as a conflict.</div>}

            <div className="row">
              <button className="btn primary" onClick={save}>{mode === 'set' ? 'Save count' : 'Add to supply'}</button>
              <button className="btn ghost" onClick={() => setColor(null)}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      <details className="panel fold" style={{ padding: 0 }}>
        <summary>Bulk add by pasting codes</summary>
        <div className="stack" style={{ padding: '0 14px 14px' }}>
          <p className="muted small">Separate with commas, spaces or new lines. Add a quantity with x or a colon: “310, 666 x2, 797:3”. You review everything before it is added, including codes that are not in the catalog.</p>
          <textarea className="input" value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder="310, 666 x2, 797:3, B5200" aria-label="Codes to add" />
          <div><button className="btn primary" disabled={!bulk.trim()} onClick={openReview}>Review</button></div>
        </div>
      </details>

      {recent.length > 0 && (
        <div className="panel flush">
          <div className="section-head" style={{ padding: '14px 14px 0' }}><h3>Just added</h3></div>
          <div className="list">
            {recent.map((r) => <div className="item" key={r.id}><div className="grow"><ColorCell color={r.color} /></div><span className="muted small">{r.bits}</span></div>)}
          </div>
        </div>
      )}
      {review && <BulkReview initial={review} onClose={() => setReview(null)} onDone={reviewed} />}
    </div>
  );
}
