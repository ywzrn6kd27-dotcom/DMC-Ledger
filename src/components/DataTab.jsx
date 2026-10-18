import { useRef, useState } from 'react';
import { useApp } from '../lib/context.js';
import { inventoryCsv, shoppingCsv } from '../lib/csv.js';
import { parseCatalogInput } from '../lib/catalog.js';
import { makeBackup, readBackup, clearState } from '../lib/storage.js';
import { download, plural } from '../lib/utils.js';
import { FABRIC_COUNTS } from '../lib/skeins.js';
import ColorDetails from './ColorDetails.jsx';
import { ColorCell, Confirm, Icon, Stepper } from './ui.jsx';

export default function DataTab() {
  const { state, setState, update, catalog, toast } = useApp();
  const backupRef = useRef(null);
  const catRef = useRef(null);
  const [restore, setRestore] = useState(null);
  const [reset, setReset] = useState(false);
  const [editing, setEditing] = useState(null); // null | {} (new) | color (edit)
  const setPref = (patch) => update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));

  const backup = () => {
    download(`floss-ledger-backup-${new Date().toISOString().slice(0, 10)}.json`, makeBackup(state), 'application/json');
    setPref({ lastBackupAt: Date.now() });
    toast('Backup downloaded');
  };

  const onRestore = async (file) => {
    if (!file) return;
    try { setRestore(readBackup(await file.text())); } catch (e) { toast(e.message, 'bad'); }
  };

  const onCatalog = async (file) => {
    if (!file) return;
    const { colors, errors } = parseCatalogInput(await file.text());
    if (colors.length) {
      update((s) => {
        const map = new Map(s.customColors.map((c) => [`${c.brand}:${c.code}`, c]));
        colors.forEach((c) => map.set(`${c.brand}:${c.code}`, c));
        return { ...s, customColors: [...map.values()] };
      });
    }
    toast(`${plural(colors.length, 'color')} imported${errors.length ? `, ${errors.length} skipped: ${errors[0]}` : ''}`, errors.length && !colors.length ? 'bad' : undefined);
  };

  const counts = `${plural(Object.keys(state.inventory).length, 'color')}, ${plural(state.projects.length, 'project')}`;

  return (
    <div className="stack">
      <div className="page-head"><div><h1>Data</h1><p className="muted">Everything is stored in this browser. Back up regularly.</p></div></div>

      <div className="panel stack">
        <h2>Backup and restore</h2>
        <p className="muted">Your data lives in this browser only. A backup file lets you move to another device or recover from a cleared browser. Currently: {counts}.</p>
        <p className="small muted">{state.settings.lastBackupAt ? `Last backup: ${new Date(state.settings.lastBackupAt).toLocaleString()}` : 'No backup downloaded yet.'}</p>
        <div className="row">
          <button className="btn primary" onClick={backup}>Download backup</button>
          <input ref={backupRef} type="file" accept=".json,application/json" hidden onChange={(e) => { onRestore(e.target.files?.[0]); e.target.value = ''; }} />
          <button className="btn" onClick={() => backupRef.current.click()}>Restore from backup</button>
        </div>
      </div>

      <div className="panel stack">
        <h2>Export to CSV</h2>
        <div className="row">
          <button className="btn" onClick={() => download('floss-supply.csv', inventoryCsv(state, catalog), 'text/csv')}>Supply</button>
          <button className="btn" onClick={() => download('floss-shopping.csv', shoppingCsv(state), 'text/csv')}>Shopping lists</button>
        </div>
      </div>

      <div className="panel stack">
        <h2>Preferences</h2>
        <div className="field-grid">
          <div className="field"><label htmlFor="theme">Appearance</label>
            <select id="theme" className="input" value={state.settings.theme} onChange={(e) => setPref({ theme: e.target.value })}>
              <option value="system">Match my device</option><option value="light">Light</option><option value="dark">Dark</option>
            </select>
          </div>
          <div className="field"><label htmlFor="dfc">Default fabric count</label>
            <select id="dfc" className="input" value={state.settings.defaultFabricCount} onChange={(e) => setPref({ defaultFabricCount: Number(e.target.value) })}>
              {FABRIC_COUNTS.map((n) => <option key={n} value={n}>{n} count</option>)}
            </select>
          </div>
          <div className="field"><label>Default waste buffer %</label><Stepper label="Default waste buffer" value={state.settings.defaultWaste} step={5} max={100} onChange={(v) => setPref({ defaultWaste: v })} /></div>
        </div>
      </div>

      <div className="panel stack">
        <h2>Color catalog</h2>
        <p className="muted">{catalog.size} colors available ({state.customColors.length} custom). The built-in DMC list was typed in by hand and hex values are approximate, so correct or extend it here. Add multicolor (variegated) skeins and anything else missing. Custom entries with the same code override the built-in color.</p>
        <div className="row">
          <button className="btn primary" onClick={() => setEditing({})}>Add custom color</button>
          <input ref={catRef} type="file" accept=".json,.csv,text/csv,application/json" hidden onChange={(e) => { onCatalog(e.target.files?.[0]); e.target.value = ''; }} />
          <button className="btn" onClick={() => catRef.current.click()}>Import catalog (JSON or CSV)</button>
        </div>
        <p className="small muted">CSV needs a header row with code, name, hex and optionally brand, type (solid, variegated, metallic, other) and colors (hex codes separated by |).</p>
        {state.customColors.length > 0 && (
          <div className="panel flush"><div className="list">
            {state.customColors.map((c) => (
              <div className="item" key={c.brand + c.code}>
                <div className="grow"><ColorCell color={c} /></div>
                <button className="btn small" onClick={() => setEditing(c)}>Edit</button>
                <button className="icon-btn" aria-label={`Remove ${c.code}`} onClick={() => update((s) => ({ ...s, customColors: s.customColors.filter((x) => x !== s.customColors.find((y) => y.brand === c.brand && y.code === c.code)) }))}><Icon name="trash" size={16} /></button>
              </div>
            ))}
          </div></div>
        )}
      </div>

      <div className="panel stack">
        <h2>Start over</h2>
        <p className="muted">Deletes the supply, projects and shopping lists stored in this browser.</p>
        <div><button className="btn danger" onClick={() => setReset(true)}>Erase all data</button></div>
      </div>

      {editing && <ColorDetails initial={editing.code ? editing : undefined} edit={!!editing.code} onClose={() => setEditing(null)} />}
      {restore && <Confirm title="Replace your data with this backup?" body={`The backup has ${plural(Object.keys(restore.inventory).length, 'color')}, ${plural(restore.projects.length, 'project')} and ${plural(restore.shopping.lists.length, 'shopping list')}. Your current data in this browser will be replaced.`} confirmLabel="Restore" danger onConfirm={() => { setState(restore); toast('Backup restored'); }} onClose={() => setRestore(null)} />}
      {reset && <Confirm title="Erase everything?" body="This cannot be undone. Download a backup first if you might want this data again." confirmLabel="Erase all" danger onConfirm={() => { clearState(); setState(null); toast('All data erased'); }} onClose={() => setReset(false)} />}
    </div>
  );
}
