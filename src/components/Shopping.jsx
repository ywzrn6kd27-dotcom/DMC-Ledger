import { useState } from 'react';
import { useApp } from '../lib/context.js';
import * as ops from '../lib/ops.js';
import { masterCsv, shoppingCsv } from '../lib/csv.js';
import MasterShopping from './MasterShopping.jsx';
import { download, plural, uid } from '../lib/utils.js';
import ColorPicker from './ColorPicker.jsx';
import { ColorCell, Confirm, Empty, Icon, Stepper } from './ui.jsx';

const QUICK = [['Fabric', 'Fabric'], ['Needles', 'Needles'], ['Hoop', 'Hoops & frames'], ['Scissors', 'Tools'], ['Floss bobbins', 'Storage']];

export default function Shopping() {
  const { state, update, toast, go } = useApp();
  const [newList, setNewList] = useState(false);
  const [name, setName] = useState('');
  const [tab, setTab] = useState('master');
  const lists = state.shopping.lists;
  const { toBuy, suppliesToBuy } = ops.overview(state);
  const auto = state.settings.autoAddPurchased;

  const copy = async () => {
    if (tab === 'master') {
      const rows = ops.masterList(state).filter((r) => r.toBuy > 0);
      const sup = (state.supplies || []).filter((i) => !i.checked);
      const lines = [rows.length ? 'Floss to buy\n' + rows.map((r) => `- ${r.code} ${r.name} × ${r.toBuy}${r.uses.length > 1 ? ` (${r.uses.map((u) => `${u.name} ${u.need}`).join(', ')})` : ''}`).join('\n') : '', sup.length ? 'Other supplies\n' + sup.map((i) => `- ${i.name}${i.qty > 1 ? ` × ${i.qty}` : ''}`).join('\n') : ''].filter(Boolean);
      try { await navigator.clipboard.writeText(lines.join('\n\n') || 'Nothing to buy'); toast('Copied the list'); } catch { toast('Could not copy. Use CSV export instead.', 'bad'); }
      return;
    }
    const text = lists.map((l) => {
      const items = l.items.filter((i) => !i.checked);
      return items.length ? `${l.name}\n` + items.map((i) => `- ${i.code} ${i.name} × ${i.qty}`).join('\n') : '';
    }).filter(Boolean);
    const sup = (state.supplies || []).filter((i) => !i.checked);
    if (sup.length) text.push('Other supplies\n' + sup.map((i) => `- ${i.name}${i.qty > 1 ? ` × ${i.qty}` : ''}${i.note ? ` (${i.note})` : ''}`).join('\n'));
    try { await navigator.clipboard.writeText(text.join('\n\n') || 'Nothing to buy'); toast('Copied the list'); } catch { toast('Could not copy. Use CSV export instead.', 'bad'); }
  };

  return (
    <div className="stack">
      <div className="page-head">
        <div><h1>Shopping</h1><p className="muted">{toBuy + suppliesToBuy === 0 ? 'Nothing to buy right now.' : [toBuy > 0 && `${plural(toBuy, 'skein')} of floss`, suppliesToBuy > 0 && `${plural(suppliesToBuy, 'other item')}`].filter(Boolean).join(' · ') + ' to buy.'}</p></div>
        <div className="row">
          <button className="btn" onClick={copy}>Copy</button>
          <button className="btn" onClick={() => (tab === 'master' ? download('floss-master-list.csv', masterCsv(state), 'text/csv') : download('floss-shopping.csv', shoppingCsv(state), 'text/csv'))}>Export CSV</button>
          {tab === 'lists' && <button className="btn primary" onClick={() => setNewList(true)}>New list</button>}
        </div>
      </div>
      <div className="row tight" role="tablist" aria-label="Shopping sections">
        <button role="tab" aria-selected={tab === 'master'} className="chip" aria-pressed={tab === 'master'} onClick={() => setTab('master')}>All floss{toBuy > 0 ? ` (${toBuy})` : ''}</button>
        <button role="tab" aria-selected={tab === 'lists'} className="chip" aria-pressed={tab === 'lists'} onClick={() => setTab('lists')}>By list</button>
        <button role="tab" aria-selected={tab === 'supplies'} className="chip" aria-pressed={tab === 'supplies'} onClick={() => setTab('supplies')}>Other supplies{suppliesToBuy > 0 ? ` (${suppliesToBuy})` : ''}</button>
      </div>
      {tab === 'supplies' && <OtherSupplies />}
      {tab === 'master' && <MasterShopping />}
      {tab === 'lists' && <>
      <label className="row" style={{ cursor: 'pointer' }}>
        <input type="checkbox" checked={auto} onChange={(e) => update((s) => ({ ...s, settings: { ...s.settings, autoAddPurchased: e.target.checked } }))} />
        <span>Add skeins to my supply when I check them off</span>
      </label>
      {newList && (
        <div className="panel row">
          <input className="input grow" autoFocus placeholder="List name (for example, Michaels run)" aria-label="List name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) { update((s) => ops.createList(s, uid(), name.trim())); setName(''); setNewList(false); } }} />
          <button className="btn primary" disabled={!name.trim()} onClick={() => { update((s) => ops.createList(s, uid(), name.trim())); setName(''); setNewList(false); }}>Create</button>
          <button className="btn ghost" onClick={() => setNewList(false)}>Cancel</button>
        </div>
      )}
      {lists.map((l) => <ListPanel key={l.id} list={l} auto={auto} />)}
      {state.projects.some(ops.isActive) && lists.every((l) => !l.projectId) && (
        <div className="banner info"><div>Open a project and choose <strong>Make shopping list</strong> to fill a sublist with what is missing.</div> <button className="btn small" onClick={() => go('projects')}>Projects</button></div>
      )}
      </>}
    </div>
  );
}

function OtherSupplies() {
  const { state, update, toast } = useApp();
  const [name, setName] = useState('');
  const [qty, setQty] = useState(1);
  const [category, setCategory] = useState('Other');
  const [projectId, setProjectId] = useState('');
  const [note, setNote] = useState('');
  const [filter, setFilter] = useState('all');
  const items = state.supplies || [];
  const shown = items.filter((i) => filter === 'all' || (filter === 'none' ? !i.projectId : i.projectId === filter));
  const cats = [...new Set([...ops.SUPPLY_CATEGORIES, ...items.map((i) => i.category)])];
  const grouped = cats.map((c) => [c, shown.filter((i) => i.category === c)]).filter(([, l]) => l.length);
  const bought = items.filter((i) => i.checked).length;

  const add = () => {
    if (!name.trim()) return toast('Enter an item name.', 'bad');
    update((s) => ops.addSupply(s, { name, qty, category, note, projectId: projectId || null }));
    toast(`Added ${name.trim()}`);
    setName(''); setQty(1); setNote('');
  };
  const quick = (label, cat) => { update((s) => ops.addSupply(s, { name: label, category: cat, projectId: filter !== 'all' && filter !== 'none' ? filter : null })); toast(`Added ${label}`); };

  return (
    <div className="stack">
      <div className="panel stack">
        <h3>Add an item</h3>
        <div className="chips">{QUICK.map(([l, c]) => <button key={l} className="chip" onClick={() => quick(l, c)}>+ {l}</button>)}</div>
        <div className="field-grid">
          <div className="field"><label htmlFor="sn">Item</label><input id="sn" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. size 26 tapestry needles" onKeyDown={(e) => e.key === 'Enter' && add()} /></div>
          <div className="field"><label htmlFor="sc">Category</label><input id="sc" className="input" list="supply-cats" value={category} onChange={(e) => setCategory(e.target.value)} /><datalist id="supply-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist></div>
          <div className="field"><label htmlFor="sp">Project (optional)</label>
            <select id="sp" className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">Not linked</option>{state.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="field"><label>Quantity</label><Stepper label="Quantity" value={qty} min={1} onChange={setQty} /></div>
        </div>
        <div className="field"><label htmlFor="snote">Note (optional)</label><input id="snote" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 14-count Aida, 18 × 18 in" /></div>
        <div><button className="btn primary" onClick={add}>Add item</button></div>
      </div>

      {items.length > 0 && (
        <div className="row">
          <label className="label" htmlFor="sf">Show</label>
          <select id="sf" className="input" style={{ maxWidth: 240 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All items</option><option value="none">Not linked to a project</option>
            {state.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {bought > 0 && <button className="btn small" onClick={() => update((s) => ops.clearBoughtSupplies(s))}>Clear bought</button>}
        </div>
      )}

      {items.length === 0 && <div className="panel"><Empty title="No other supplies yet">Track fabric, needles, hoops and anything else you need to buy. Link items to a project, or add a fabric size from a project page.</Empty></div>}
      {items.length > 0 && shown.length === 0 && <div className="panel"><Empty title="Nothing here">No items match this project filter.</Empty></div>}

      {grouped.map(([cat, list]) => (
        <div className="panel flush" key={cat}>
          <div className="section-head" style={{ padding: '12px 14px 0' }}><h3>{cat}</h3><span className="muted small">{list.length}</span></div>
          <div className="list">
            {list.map((i) => (
              <div className="item" key={i.id} style={{ opacity: i.checked ? 0.6 : 1, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <input type="checkbox" style={{ width: 20, height: 20, marginTop: 8 }} checked={i.checked} aria-label={`Got ${i.name}`} onChange={() => update((s) => ops.updateSupply(s, i.id, { checked: !i.checked }))} />
                <div className="grow stack tight" style={{ minWidth: 200 }}>
                  <input className="input" style={{ minHeight: 34, padding: '4px 10px', fontWeight: 600, textDecoration: i.checked ? 'line-through' : 'none' }} aria-label="Item name" value={i.name} onChange={(e) => update((s) => ops.updateSupply(s, i.id, { name: e.target.value }))} />
                  <div className="row tight">
                    <select className="input" style={{ maxWidth: 200, minHeight: 34, padding: '4px 10px' }} aria-label={`Project for ${i.name}`} value={i.projectId || ''} onChange={(e) => update((s) => ops.updateSupply(s, i.id, { projectId: e.target.value || null }))}>
                      <option value="">Not linked</option>{state.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input className="input grow" style={{ minHeight: 34, padding: '4px 10px', minWidth: 140 }} placeholder="Note" aria-label={`Note for ${i.name}`} value={i.note} onChange={(e) => update((s) => ops.updateSupply(s, i.id, { note: e.target.value }))} />
                    <input className="input" style={{ maxWidth: 150, minHeight: 34, padding: '4px 10px' }} list="supply-cats" aria-label={`Category for ${i.name}`} value={i.category} onChange={(e) => update((s) => ops.updateSupply(s, i.id, { category: e.target.value }))} />
                  </div>
                </div>
                <Stepper small label={`Quantity of ${i.name}`} value={i.qty} min={1} onChange={(v) => update((s) => ops.updateSupply(s, i.id, { qty: v }))} />
                <button className="icon-btn" aria-label={`Remove ${i.name}`} onClick={() => update((s) => ops.removeSupply(s, i.id))}><Icon name="x" size={16} /></button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ListPanel({ list, auto }) {
  const { state, update, catalog, toast, go } = useApp();
  const [qty, setQty] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isGeneral = list.id === ops.GENERAL_LIST_ID;
  const open = list.items.filter((i) => !i.checked);
  const done = list.items.length - open.length;

  return (
    <details className="panel flush" open>
      <summary style={{ padding: '12px 14px', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <b style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>{list.name}</b>
        {list.projectId && <span className="pill accent">Project</span>}
        <span className="muted small">{open.reduce((a, i) => a + i.qty, 0)} to buy{done ? ` · ${done} bought` : ''}</span>
      </summary>
      <div className="list">
        {list.items.length === 0 && <Empty title="Empty list">Add a color below.</Empty>}
        {list.items.map((i) => (
          <div className="item" key={i.id} style={{ opacity: i.checked ? 0.6 : 1, flexWrap: 'wrap' }}>
            <input type="checkbox" style={{ width: 20, height: 20 }} checked={i.checked} aria-label={`Bought ${i.code}`} onChange={() => { update((s) => ops.toggleBought(s, list.id, i.id, auto)); if (!i.checked && auto) toast(`${i.qty} × ${i.code} added to supply`); }} />
            <div className="grow" style={{ textDecoration: i.checked ? 'line-through' : 'none' }}><ColorCell color={i} /></div>
            <Stepper small label={`Quantity of ${i.code}`} value={i.qty} min={1} onChange={(v) => update((s) => ops.updateShoppingItem(s, list.id, i.id, { qty: v }))} />
            <input className="input" style={{ maxWidth: 170, minHeight: 32, padding: '4px 10px' }} placeholder="Note" aria-label={`Note for ${i.code}`} value={i.note} onChange={(e) => update((s) => ops.updateShoppingItem(s, list.id, i.id, { note: e.target.value }))} />
            <button className="icon-btn" aria-label={`Remove ${i.code}`} onClick={() => update((s) => ops.removeShoppingItem(s, list.id, i.id))}><Icon name="x" size={16} /></button>
          </div>
        ))}
      </div>
      <div className="stack tight" style={{ padding: 14, borderTop: '1px solid var(--line)' }}>
        <div className="row">
          <div className="grow" style={{ minWidth: 200 }}>
            <ColorPicker placeholder="Add a color by number or name" onSelect={(c) => { update((s) => ops.addShoppingItem(s, list.id, c, qty)); toast(`Added ${qty} × ${c.code}`); }} />
          </div>
          <Stepper label="Quantity to add" value={qty} min={1} onChange={setQty} />
        </div>
        <div className="row">
          {list.projectId && <>
            <button className="btn small" onClick={() => { update((s) => ops.syncProjectShopping(s, list.projectId)); toast('List refreshed from project'); }}>Refresh from project</button>
            <button className="btn small ghost" onClick={() => go('projects/' + list.projectId)}>Open project</button>
          </>}
          {!isGeneral && !list.projectId && (
            <input className="input" style={{ maxWidth: 220, minHeight: 32, padding: '4px 10px' }} aria-label="Rename list" value={list.name} onChange={(e) => update((s) => ops.renameList(s, list.id, e.target.value))} />
          )}
          {done > 0 && <button className="btn small" onClick={() => update((s) => ops.clearPurchased(s, list.id))}>Clear bought</button>}
          {!isGeneral && <button className="btn small danger" onClick={() => setConfirmDelete(true)}>Delete list</button>}
        </div>
      </div>
      {confirmDelete && <Confirm title="Delete this list?" body={`“${list.name}” and its items will be removed.`} confirmLabel="Delete" danger onConfirm={() => update((s) => ops.deleteList(s, list.id))} onClose={() => setConfirmDelete(false)} />}
    </details>
  );
}
