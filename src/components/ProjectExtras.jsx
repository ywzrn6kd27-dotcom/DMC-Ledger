import { useState } from 'react';
import { useApp } from '../lib/context.js';
import * as ops from '../lib/ops.js';
import { fabricSize, fmtInches } from '../lib/fabric.js';
import { FABRIC_COUNTS } from '../lib/skeins.js';
import { Icon, Stepper } from './ui.jsx';

// Pattern size, suggested fabric sizes and the project's linked shopping items.
export function FabricSuggestion({ project }) {
  const { update, toast } = useApp();
  const w = project.size?.w || 0;
  const h = project.size?.h || 0;
  const counts = FABRIC_COUNTS.includes(project.fabricCount) ? FABRIC_COUNTS : [...FABRIC_COUNTS, project.fabricCount];
  const setSize = (patch) => update((s) => ops.updateProject(s, project.id, { size: { w, h, ...patch } }));

  const addFabric = (count, sz) => {
    update((s) => ops.addSupply(s, {
      name: `${count}-count fabric, ${sz.w} × ${sz.h} in`,
      category: 'Fabric',
      note: `Pattern ${w}×${h} stitches, ${project.margin} in margin`,
      projectId: project.id,
    }));
    toast(`Added ${count}-count fabric to Other supplies`);
  };

  return (
    <div className="panel stack">
      <div><h2>Fabric size</h2><p className="muted small">A suggestion from the pattern size, fabric count and a margin on every side, rounded up to the next inch.</p></div>
      <div className="field-grid">
        <div className="field"><label>Stitches wide</label><Stepper label="Stitches wide" value={w} max={3000} onChange={(v) => setSize({ w: v })} /></div>
        <div className="field"><label>Stitches high</label><Stepper label="Stitches high" value={h} max={3000} onChange={(v) => setSize({ h: v })} /></div>
        <div className="field"><label>Margin per side (in)</label><Stepper label="Margin per side in inches" value={project.margin} step={0.5} max={12} onChange={(v) => update((s) => ops.updateProject(s, project.id, { margin: v }))} /></div>
      </div>
      {!(w > 0 && h > 0) ? (
        <p className="muted small">Enter the pattern size to see suggestions. Imported charts fill it in automatically.</p>
      ) : (
        <div className="list" style={{ border: '1px solid var(--line)', borderRadius: 10 }}>
          {counts.map((c) => {
            const sz = fabricSize(w, h, c, project.margin);
            return (
              <div className="item" key={c}>
                <div className="grow"><b>{c} count: {sz.w} × {sz.h} in</b><div className="muted small">Stitched area {fmtInches(sz.stitchW)} × {fmtInches(sz.stitchH)} in</div></div>
                <button className="btn small" onClick={() => addFabric(c, sz)}>Add to shopping</button>
              </div>
            );
          })}
        </div>
      )}
      <p className="muted small">Stitching evenweave or linen over two threads? Use a custom fabric count of half the thread count (for example 14 for 28-count).</p>
    </div>
  );
}

export function ProjectSupplies({ project }) {
  const { state, update } = useApp();
  const [name, setName] = useState('');
  const items = (state.supplies || []).filter((i) => i.projectId === project.id);
  const add = () => {
    if (!name.trim()) return;
    update((s) => ops.addSupply(s, { name, projectId: project.id }));
    setName('');
  };
  return (
    <div className="panel stack tight">
      <h2>Other supplies</h2>
      {items.length === 0 && <p className="muted small">Fabric, needles and anything else linked to this project shows up here and on the Shopping tab.</p>}
      {items.map((i) => (
        <div className="row" key={i.id} style={{ opacity: i.checked ? 0.6 : 1 }}>
          <input type="checkbox" style={{ width: 20, height: 20 }} checked={i.checked} aria-label={`Got ${i.name}`} onChange={() => update((s) => ops.updateSupply(s, i.id, { checked: !i.checked }))} />
          <div className="grow" style={{ textDecoration: i.checked ? 'line-through' : 'none' }}>
            <b>{i.name}</b>{i.qty > 1 ? ` × ${i.qty}` : ''}
            <div className="muted small">{i.category}{i.note ? ` · ${i.note}` : ''}</div>
          </div>
          <button className="icon-btn" aria-label={`Remove ${i.name}`} onClick={() => update((s) => ops.removeSupply(s, i.id))}><Icon name="x" size={16} /></button>
        </div>
      ))}
      <div className="row">
        <input className="input grow" placeholder="Add an item (for example size 26 needles)" aria-label="New supply item" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="btn" onClick={add} disabled={!name.trim()}>Add</button>
      </div>
    </div>
  );
}
