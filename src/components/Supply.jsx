import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../lib/context.js';
import * as ops from '../lib/ops.js';
import { FAMILIES, THREAD_TYPES, displayName, fmtSkeins, naturalCodeCompare, uid, PARTIAL_OPTIONS } from '../lib/utils.js';
import ColorDetails from './ColorDetails.jsx';
import { ColorCell, Confirm, Empty, Modal, PartialEditor, Stepper, Swatch } from './ui.jsx';

const FILTERS = [
  ['all', 'All'], ['instock', 'In stock'], ['partial', 'Has partial'], ['reserved', 'Reserved'],
  ['low', 'Low'], ['used', 'Used up'], ['conflict', 'Conflict'],
];

export default function Supply({ initialQuery = '' }) {
  const { state, catalog, go } = useApp();
  const [q, setQ] = useState(initialQuery);
  const [filter, setFilter] = useState('all');
  const [family, setFamily] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sort, setSort] = useState('code');
  const [editing, setEditing] = useState(null);
  useEffect(() => setQ(initialQuery), [initialQuery]);

  const assigned = useMemo(() => ops.assignedByKey(state), [state]);
  const conflictKeys = useMemo(() => new Set(ops.conflicts(state).map((c) => c.key)), [state]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = Object.entries(state.inventory).map(([key, it]) => {
      const c = catalog.find(it.brand, it.code) || { brand: it.brand, code: it.code, name: '(not in catalog)', hex: '#808080', family: 'Gray', key };
      const total = ops.totalOf(it);
      const res = assigned.get(key) || 0;
      return { key, it, c, total, res, avail: total - res };
    });
    if (needle) {
      const tokens = needle.split(/\s+/);
      list = list.filter(({ c }) => tokens.every((t) => c.code.toLowerCase().startsWith(t) || c.code.toLowerCase() === t || c.name.toLowerCase().includes(t) || c.family.toLowerCase().startsWith(t)));
    }
    if (family) list = list.filter((r) => r.c.family === family);
    if (typeFilter) list = list.filter((r) => (r.c.type || 'solid') === typeFilter);
    list = list.filter((r) => {
      switch (filter) {
        case 'instock': return r.total > 0;
        case 'partial': return r.it.partials.length > 0;
        case 'reserved': return r.res > 0;
        case 'low': return r.it.minStock > 0 && r.total < r.it.minStock;
        case 'used': return r.total === 0;
        case 'conflict': return conflictKeys.has(r.key) || r.avail < 0;
        default: return true;
      }
    });
    const cmp = {
      code: (a, b) => naturalCodeCompare(a.c.code, b.c.code),
      name: (a, b) => a.c.name.localeCompare(b.c.name),
      most: (a, b) => b.total - a.total || naturalCodeCompare(a.c.code, b.c.code),
      color: (a, b) => FAMILIES.indexOf(a.c.family) - FAMILIES.indexOf(b.c.family) || naturalCodeCompare(a.c.code, b.c.code),
    }[sort];
    return list.sort(cmp);
  }, [state.inventory, catalog, q, filter, family, typeFilter, sort, assigned, conflictKeys]);

  const total = Object.keys(state.inventory).length;

  return (
    <div className="stack">
      <div className="page-head">
        <div><h1>Supply</h1><p className="muted">{total} color{total === 1 ? '' : 's'} tracked. Tap one to edit, assign or mark it used.</p></div>
        <button className="btn primary" onClick={() => go('add')}>Add floss</button>
      </div>

      {total === 0 ? (
        <div className="panel"><Empty title="Nothing in supply yet" action={<button className="btn primary" onClick={() => go('add')}>Add your first skein</button>}>Search for a DMC number and record how many skeins you have.</Empty></div>
      ) : (
        <>
          <div className="toolbar">
            <input className="input" type="search" placeholder="Filter by number, name or color" aria-label="Filter supply" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="input" style={{ maxWidth: 150 }} aria-label="Color family" value={family} onChange={(e) => setFamily(e.target.value)}>
              <option value="">All colors</option>{FAMILIES.map((f) => <option key={f}>{f}</option>)}
            </select>
            <select className="input" style={{ maxWidth: 150 }} aria-label="Thread type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All types</option>{THREAD_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <select className="input" style={{ maxWidth: 160 }} aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="code">Sort: number</option><option value="name">Sort: name</option><option value="most">Sort: most skeins</option><option value="color">Sort: color family</option>
            </select>
          </div>
          <div className="chips">{FILTERS.map(([k, l]) => <button key={k} className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}</div>

          <div className="panel flush">
            {rows.length === 0 ? <Empty title="No matches">Try a different filter or search.</Empty> : (
              <div className="list">
                {rows.map(({ key, it, c, total: t, res, avail }) => (
                  <button key={key} className="item click" onClick={() => setEditing(key)}>
                    <div className="grow"><ColorCell color={c} sub={it.notes || undefined} /></div>
                    <div className="row tight" style={{ justifyContent: 'flex-end' }}>
                      {t === 0 && <span className="pill">{it.usedUp ? 'Used up' : 'Empty'}</span>}
                      {it.partials.length > 0 && <span className="pill accent">Partial {it.partials.map(fmtSkeins).join(' + ')}</span>}
                      {it.minStock > 0 && t < it.minStock && <span className="pill warn">Low</span>}
                      {avail < 0 && <span className="pill warn">Conflict</span>}
                      {res > 0 && avail >= 0 && <span className="pill">{fmtSkeins(res)} reserved</span>}
                    </div>
                    <div className="qty"><b>{fmtSkeins(t)}</b><div className="muted small">{res > 0 ? `${fmtSkeins(Math.max(0, avail))} free` : 'skeins'}</div></div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      {editing && state.inventory[editing] && <StockEditor itemKey={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function StockEditor({ itemKey, onClose }) {
  const { state, update, catalog, toast } = useApp();
  const it = state.inventory[itemKey];
  const c = catalog.find(it.brand, it.code) || { brand: it.brand, code: it.code, name: '', hex: '#808080', key: itemKey };
  const total = ops.totalOf(it);
  const [partialPick, setPartialPick] = useState(false);
  const [editColor, setEditColor] = useState(false);
  const [confirmUsed, setConfirmUsed] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [projId, setProjId] = useState('');
  const [newName, setNewName] = useState('');
  const [qty, setQty] = useState(1);

  const uses = state.projects
    .map((p) => ({ p, pc: p.colors.find((x) => x.key === itemKey) }))
    .filter((u) => u.pc && (u.pc.assigned > 0 || u.pc.used > 0));
  const assignedTotal = ops.assignedByKey(state).get(itemKey) || 0;
  const activeProjects = state.projects.filter(ops.isActive);

  const patch = (p) => update((s) => ops.setItemFields(s, itemKey, p));

  const assign = () => {
    let id = projId;
    if (id === '__new') {
      if (!newName.trim()) return toast('Name the new project first.', 'bad');
      id = uid();
      update((s) => ops.addProject(s, ops.makeProject({ id, name: newName.trim(), fabricCount: s.settings.defaultFabricCount, waste: s.settings.defaultWaste })));
    }
    if (!id) return toast('Pick a project.', 'bad');
    update((s) => {
      const cur = s.projects.find((p) => p.id === id)?.colors.find((x) => x.key === itemKey);
      return ops.setAssigned(s, id, c, (cur?.assigned || 0) + qty);
    });
    toast(`Reserved ${fmtSkeins(qty)} × ${c.code}`);
    setProjId(''); setNewName('');
  };

  return (
    <Modal
      onClose={onClose}
      head={<div className="colorcell"><Swatch hex={c.hex} colors={c.colors} size={36} /><div><h2>{c.code}{displayName(c) && <span className="muted" style={{ fontWeight: 500 }}> {displayName(c)}</span>}</h2><span className="muted small">{fmtSkeins(total)} skeins · {fmtSkeins(Math.max(0, total - assignedTotal))} free{c.type && c.type !== 'solid' ? ` · ${c.type}` : ''}</span></div></div>}
      footer={<><button className="btn danger left" onClick={() => setConfirmRemove(true)}>Remove from supply</button><button className="btn primary" onClick={onClose}>Done</button></>}
    >
      <div className="field-grid">
        <div className="field"><label>Whole skeins</label><Stepper label="Whole skeins" value={it.whole} onChange={(v) => patch({ whole: v })} /></div>
        <div className="field"><label>Keep at least</label><Stepper label="Minimum on hand" value={it.minStock} onChange={(v) => patch({ minStock: v })} /></div>
      </div>
      <div className="field"><label>Partial skeins</label><PartialEditor partials={it.partials} onChange={(p) => patch({ partials: p })} /></div>

      <div className="field">
        <label>Quick status</label>
        <div className="row tight">
          <button className="btn small" onClick={() => setPartialPick((v) => !v)} disabled={total === 0}>Mark a skein as partial</button>
          <button className="btn small danger" onClick={() => setConfirmUsed(true)} disabled={total === 0}>Mark used up</button>
          {it.usedUp && <span className="pill">Used up</span>}
          {c.custom && <button className="btn small" onClick={() => setEditColor(true)}>{c.pending ? 'Add color details' : 'Edit color details'}</button>}
        </div>
        {partialPick && (
          <div className="row tight" style={{ marginTop: 6 }}>
            <span className="muted small">How much is left?</span>
            {PARTIAL_OPTIONS.map((p) => <button key={p} className="chip" onClick={() => { update((s) => ops.markPartial(s, itemKey, p)); setPartialPick(false); toast(`${c.code}: ${fmtSkeins(p)} skein left`); }}>{fmtSkeins(p)}</button>)}
          </div>
        )}
      </div>

      <div className="field"><label htmlFor="notes">Notes</label><input id="notes" className="input" value={it.notes} onChange={(e) => patch({ notes: e.target.value })} placeholder="e.g. bought in 2024, dye lot 8" /></div>
      <hr className="divider" />

      <div className="stack tight">
        <h3>Projects</h3>
        {uses.length === 0 && <p className="muted small">Not reserved for any project.</p>}
        {uses.map(({ p, pc }) => (
          <div className="row spread" key={p.id}>
            <div><b>{p.name}</b> <span className="pill">{p.status === 'completed' ? 'Completed' : p.status === 'inprogress' ? 'In progress' : 'Planned'}</span>{pc.used > 0 && <span className="muted small"> · used {fmtSkeins(pc.used)}</span>}</div>
            {ops.isActive(p) && pc.assigned > 0 && (
              <div className="row tight">
                <Stepper small label={`Reserved for ${p.name}`} value={pc.assigned} step={0.25} onChange={(v) => update((s) => ops.setAssigned(s, p.id, c, v))} />
                <button className="btn small" onClick={() => { update((s) => ops.markAssignmentUsed(s, p.id, itemKey)); toast(`Marked ${c.code} used in ${p.name}`); }}>Mark used</button>
              </div>
            )}
          </div>
        ))}
        <div className="field-grid" style={{ alignItems: 'end' }}>
          <div className="field">
            <label htmlFor="ap">Assign to project</label>
            <select id="ap" className="input" value={projId} onChange={(e) => setProjId(e.target.value)}>
              <option value="">Choose…</option>
              {activeProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              <option value="__new">New project…</option>
            </select>
          </div>
          {projId === '__new' && <div className="field"><label htmlFor="np">New project name</label><input id="np" className="input" value={newName} onChange={(e) => setNewName(e.target.value)} /></div>}
          <div className="row"><Stepper label="Skeins to reserve" value={qty} step={0.25} onChange={setQty} /><button className="btn" onClick={assign}>Assign</button></div>
        </div>
      </div>

      {editColor && <ColorDetails edit initial={c} onClose={() => setEditColor(false)} />}
      {confirmUsed && <Confirm title="Mark as used up?" body={`This sets ${c.code} to zero skeins. You can add stock again any time.`} confirmLabel="Mark used up" danger onConfirm={() => { update((s) => ops.markUsedUp(s, itemKey)); toast(`${c.code} marked used up`); }} onClose={() => setConfirmUsed(false)} />}
      {confirmRemove && <Confirm title="Remove from supply?" body={`${c.code} ${c.name} will be removed from your supply list. Project requirements stay.`} confirmLabel="Remove" danger onConfirm={() => { update((s) => ops.removeItem(s, itemKey)); onClose(); }} onClose={() => setConfirmRemove(false)} />}
    </Modal>
  );
}
