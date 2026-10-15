import { useRef, useState } from 'react';
import { useApp } from '../lib/context.js';
import * as ops from '../lib/ops.js';
import { parseFcjson } from '../lib/fcjson.js';
import { FABRIC_COUNTS } from '../lib/skeins.js';
import { fmtSkeins, plural, uid } from '../lib/utils.js';
import ColorPicker from './ColorPicker.jsx';
import { ColorCell, Confirm, Empty, Icon, Modal, Stepper } from './ui.jsx';

const STATUS = { planned: 'Planned', inprogress: 'In progress', completed: 'Completed' };

export default function Projects({ projectId }) {
  const { state } = useApp();
  const project = projectId && state.projects.find((p) => p.id === projectId);
  return project ? <ProjectDetail project={project} /> : <ProjectList />;
}

function useImporter() {
  const { toast } = useApp();
  const [pending, setPending] = useState(null);
  const read = async (file) => {
    if (!file) return;
    try {
      const parsed = parseFcjson(await file.text(), file.name);
      setPending(parsed);
    } catch (e) {
      toast(e.message, 'bad');
    }
  };
  return { pending, setPending, read };
}

function ProjectList() {
  const { state, update, go, toast } = useApp();
  const imp = useImporter();
  const fileRef = useRef(null);
  const [over, setOver] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  const create = () => {
    if (!name.trim()) return;
    const id = uid();
    update((s) => ops.addProject(s, ops.makeProject({ id, name: name.trim(), fabricCount: s.settings.defaultFabricCount, waste: s.settings.defaultWaste })));
    setName(''); setNaming(false); go('projects/' + id);
  };

  return (
    <div
      className="stack"
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); imp.read(e.dataTransfer.files?.[0]); }}
    >
      <div className="page-head">
        <div><h1>Projects</h1><p className="muted">Import a FlossCross chart to match it against your supply.</p></div>
        <div className="row">
          <input ref={fileRef} type="file" accept=".fcjson,.json,application/json" hidden onChange={(e) => { imp.read(e.target.files?.[0]); e.target.value = ''; }} />
          <button className="btn primary" onClick={() => fileRef.current.click()}>Import .fcjson</button>
          <button className="btn" onClick={() => setNaming(true)}>New project</button>
        </div>
      </div>

      {naming && (
        <div className="panel row">
          <input className="input grow" autoFocus placeholder="Project name" aria-label="Project name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
          <button className="btn primary" onClick={create}>Create</button>
          <button className="btn ghost" onClick={() => setNaming(false)}>Cancel</button>
        </div>
      )}

      {state.projects.length === 0 ? (
        <div className={'dropzone' + (over ? ' over' : '')}>
          <h3 style={{ color: 'inherit' }}>Drop a .fcjson file here</h3>
          <p style={{ margin: '6px 0 14px' }}>or choose one. FlossCross exports list every color and how many stitches use it.</p>
          <button className="btn" onClick={() => fileRef.current.click()}>Choose a file</button>
        </div>
      ) : (
        <div className="project-grid">
          {state.projects.map((p) => {
            const t = ops.projectTotals(state, p);
            const pct = t.needed ? Math.round((t.covered / t.needed) * 100) : 0;
            const done = p.status === 'completed';
            return (
              <button key={p.id} className="panel project-card" onClick={() => go('projects/' + p.id)}>
                <div className="row spread"><h3>{p.name}</h3><span className={'pill' + (done ? ' ok' : p.status === 'inprogress' ? ' accent' : '')}>{STATUS[p.status]}</span></div>
                <div className="muted small">{plural(t.colors, 'color')}{t.stitches ? ` · ${t.stitches.toLocaleString()} stitches` : ''}{p.source?.width ? ` · ${p.source.width}×${p.source.height}` : ''}</div>
                {!done && (<>
                  <div className="meter"><i style={{ width: pct + '%' }} /></div>
                  <div className="small muted">{t.covered} of {t.needed} colors covered{t.toBuy > 0 ? ` · ${plural(t.toBuy, 'skein')} to buy` : ''}</div>
                </>)}
              </button>
            );
          })}
        </div>
      )}
      {imp.pending && <ImportDialog parsed={imp.pending} onClose={() => imp.setPending(null)} />}
    </div>
  );
}

function ImportDialog({ parsed, onClose }) {
  const { state, update, catalog, go, toast } = useApp();
  const [name, setName] = useState(parsed.suggestedName || parsed.title || 'New project');
  const [fabric, setFabric] = useState(state.settings.defaultFabricCount);
  const [strands, setStrands] = useState(parsed.strands);
  const unknown = parsed.colors.filter((c) => !catalog.find(c.brand, c.code));

  const create = () => {
    const id = uid();
    update((s) => {
      let next = s;
      const custom = unknown.filter((c) => !s.customColors.some((x) => x.brand === c.brand && x.code === c.code));
      if (custom.length) next = { ...next, customColors: [...next.customColors, ...custom.map((c) => ({ brand: c.brand, code: c.code, name: c.name, hex: c.hex }))] };
      return ops.addProject(next, ops.makeProject({
        id, name: name.trim() || 'Imported chart', fabricCount: fabric, strands, bsStrands: parsed.bsStrands, waste: s.settings.defaultWaste,
        source: { title: parsed.title, width: parsed.width, height: parsed.height },
        colors: parsed.colors.map((c) => ops.makeProjectColor(catalog.find(c.brand, c.code) || c, { stitches: c.stitches, bsStitches: c.bsStitches })),
      }));
    });
    toast(`Imported ${parsed.colors.length} colors`);
    onClose();
    go('projects/' + id);
  };

  return (
    <Modal title="Import chart" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={create}>Create project</button></>}>
      <div className="field">
        <label htmlFor="pn">Project name</label>
        <input id="pn" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        {parsed.title && parsed.title !== name && <button className="btn small ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setName(parsed.title)}>Use chart title “{parsed.title}”</button>}
      </div>
      <p className="muted">{parsed.width}×{parsed.height} stitches · {plural(parsed.colors.length, 'color')} · {parsed.totalStitches.toLocaleString()} stitches</p>
      <div className="field-grid">
        <div className="field"><label htmlFor="fc">Fabric count</label>
          <select id="fc" className="input" value={FABRIC_COUNTS.includes(fabric) ? fabric : 'custom'} onChange={(e) => setFabric(e.target.value === 'custom' ? 28 : Number(e.target.value))}>
            {FABRIC_COUNTS.map((n) => <option key={n} value={n}>{n} count</option>)}<option value="custom">Custom…</option>
          </select>
          {!FABRIC_COUNTS.includes(fabric) && <Stepper small label="Custom fabric count" value={fabric} min={8} max={40} onChange={setFabric} />}
        </div>
        <div className="field"><label>Strands</label><Stepper label="Strands" value={strands} min={1} max={6} onChange={setStrands} /></div>
      </div>
      {parsed.warnings.map((w) => <div className="banner info" key={w}>{w}</div>)}
      {unknown.length > 0 && <div className="banner info">{plural(unknown.length, 'color')} {unknown.length === 1 ? 'is' : 'are'} not in the built-in catalog ({unknown.map((c) => c.code).join(', ')}). They will be added from the file.</div>}
      <div className="panel flush"><div className="list">
        {parsed.colors.map((c) => (
          <div className="item" key={c.key}><div className="grow"><ColorCell color={c} /></div><span className="muted small">{c.stitches.toLocaleString()} stitches</span></div>
        ))}
      </div></div>
    </Modal>
  );
}

function ProjectDetail({ project }) {
  const { state, update, catalog, go, toast } = useApp();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [completing, setCompleting] = useState(false);
  const t = ops.projectTotals(state, project);
  const active = ops.isActive(project);
  const mine = ops.conflicts(state).filter((c) => c.uses.some((u) => u.projectId === project.id));
  const hasReserved = project.colors.some((c) => c.assigned > 0);
  const set = (patch) => update((s) => ops.updateProject(s, project.id, patch));
  const setColor = (c, patch) => update((s) => ops.upsertProjectColor(s, project.id, c, patch));

  const changeStatus = (status) => {
    if (status === 'completed' && hasReserved) return setCompleting(true);
    if (status === 'completed') set({ status, completedAt: Date.now() });
    else set({ status, completedAt: null });
  };

  const shop = () => {
    update((s) => ops.syncProjectShopping(s, project.id));
    toast(t.toBuy > 0 ? `Shopping list updated: ${plural(t.toBuy, 'skein')}` : 'Nothing to buy. Everything is covered.');
    if (t.toBuy > 0) go('shopping');
  };

  const fabricIsStd = FABRIC_COUNTS.includes(project.fabricCount);

  return (
    <div className="stack">
      <div className="row"><button className="btn small ghost" onClick={() => go('projects')}><Icon name="back" size={16} /> Projects</button></div>
      <div className="page-head">
        <div className="grow" style={{ minWidth: 220 }}>
          <input className="input" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.4rem' }} aria-label="Project name" value={project.name} onChange={(e) => set({ name: e.target.value })} />
        </div>
        <select className="input" style={{ width: 160 }} aria-label="Status" value={project.status} onChange={(e) => changeStatus(e.target.value)}>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {mine.map((c) => (
        <div className="banner" key={c.key}><div><strong>{c.code} {c.name}:</strong> {c.type === 'over-assigned' ? `reserved ${fmtSkeins(c.assigned)} across projects but you own ${fmtSkeins(c.total)}.` : `shared with ${c.uses.filter((u) => u.projectId !== project.id).map((u) => u.name).join(', ')}; together they need ${fmtSkeins(c.needSum)} and you own ${fmtSkeins(c.total)}.`}</div></div>
      ))}

      {active && (
        <div className="panel stack">
          <div className="row spread">
            <div><b>{t.covered} of {t.needed}</b> colors covered{t.toBuy > 0 ? <> · <b>{plural(t.toBuy, 'skein')}</b> to buy</> : null}</div>
            <div className="row">
              <button className="btn" onClick={() => { update((s) => ops.reserveFromSupply(s, project.id)); toast('Reserved what you have'); }}>Reserve from supply</button>
              {hasReserved && <button className="btn" onClick={() => { update((s) => ops.releaseAssigned(s, project.id)); toast('Released reserved skeins'); }}>Release reserved</button>}
              <button className="btn primary" onClick={shop}>Make shopping list</button>
            </div>
          </div>
          <hr className="divider" />
          <div className="field-grid">
            <div className="field"><label htmlFor="fcount">Fabric count</label>
              <select id="fcount" className="input" value={fabricIsStd ? project.fabricCount : 'custom'} onChange={(e) => set({ fabricCount: e.target.value === 'custom' ? 28 : Number(e.target.value) })}>
                {FABRIC_COUNTS.map((n) => <option key={n} value={n}>{n} count</option>)}<option value="custom">Custom…</option>
              </select>
              {!fabricIsStd && <Stepper small label="Custom fabric count" value={project.fabricCount} min={8} max={40} onChange={(v) => set({ fabricCount: v })} />}
            </div>
            <div className="field"><label>Strands</label><Stepper label="Strands" value={project.strands} min={1} max={6} onChange={(v) => set({ strands: v })} /></div>
            <div className="field"><label>Waste buffer %</label><Stepper label="Waste buffer percent" value={project.waste} min={0} max={100} step={5} onChange={(v) => set({ waste: v })} /></div>
          </div>
          <p className="muted small">Skein counts are estimates from stitch counts, fabric count and strands. Adjust the waste buffer if your estimates run high or low, or type your own number in the Need column.</p>
        </div>
      )}

      <div className="panel flush">
        {project.colors.length === 0 ? <Empty title="No colors yet">Add colors below, or import a chart.</Empty> : (
          <>
            <div className="prow head"><span>Color</span><span className="r">Stitches</span><span className="r">Estimate</span><span>Need</span><span className="r">Reserved / own</span><span>Status</span><span /></div>
            {t.rows.map((r) => {
              const c = r.color;
              const st = { covered: ['Covered', 'ok'], short: [`Buy ${r.short}`, 'warn'], missing: [`Buy ${r.short}`, 'warn'], none: ['Set amount', ''], done: ['Done', 'ok'] }[r.status];
              return (
                <div className="prow" key={c.key}>
                  <ColorCell color={c} />
                  <span className="r cell-sm"><span className="cell-label only-sm">Stitches</span>{c.stitches ? c.stitches.toLocaleString() : '–'}</span>
                  <span className="r cell-sm"><span className="cell-label only-sm">Estimate</span>{c.stitches ? `~${r.estimate.toFixed(1)}` : '–'}</span>
                  <span className="cell-sm">
                    <span className="cell-label only-sm">Need</span>
                    {active ? <Stepper small label={`Need for ${c.code}`} value={r.need} step={0.25} onChange={(v) => setColor(c, { need: v })} /> : fmtSkeins(c.used)}
                    {active && c.need != null && c.stitches > 0 && <button className="btn small ghost" title="Go back to the estimate" onClick={() => setColor(c, { need: null })}>auto</button>}
                  </span>
                  <span className="r cell-sm"><span className="cell-label only-sm">Reserved / own</span>{fmtSkeins(c.assigned)} / {fmtSkeins(r.total)}</span>
                  <span className="cell-sm"><span className={'pill ' + st[1]}>{st[0]}</span></span>
                  <span><button className="icon-btn" aria-label={`Remove ${c.code}`} onClick={() => update((s) => ops.removeProjectColor(s, project.id, c.key))}><Icon name="x" size={16} /></button></span>
                </div>
              );
            })}
          </>
        )}
      </div>

      {active && (
        <div className="panel stack tight">
          <label className="label">Add a color to this project</label>
          <ColorPicker catalog={catalog} placeholder="Search by number or name" onSelect={(c) => { update((s) => ops.upsertProjectColor(s, project.id, c)); toast(`Added ${c.code}`); }} />
        </div>
      )}

      <div className="field"><label htmlFor="pnotes">Notes</label><textarea id="pnotes" className="input" value={project.notes} onChange={(e) => set({ notes: e.target.value })} /></div>
      <div><button className="btn danger" onClick={() => setConfirmDelete(true)}>Delete project</button></div>

      {confirmDelete && <Confirm title="Delete this project?" body="The project, its reservations and its shopping sublist are removed. Your supply is not changed." confirmLabel="Delete" danger onConfirm={() => { update((s) => ops.deleteProject(s, project.id)); go('projects'); }} onClose={() => setConfirmDelete(false)} />}
      {completing && (
        <Modal title="Finish this project" onClose={() => setCompleting(false)}>
          <p>Some skeins are reserved for this project. What should happen to them?</p>
          <div className="stack tight">
            <button className="btn primary" onClick={() => { update((s) => ops.completeProject(s, project.id, 'use')); setCompleting(false); toast('Marked as used and deducted from supply'); }}>Mark as used (take out of supply)</button>
            <button className="btn" onClick={() => { update((s) => ops.completeProject(s, project.id, 'release')); setCompleting(false); toast('Reserved skeins released back to supply'); }}>Release them back to supply</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
