import { useState } from 'react';
import { useApp } from '../lib/context.js';
import * as ops from '../lib/ops.js';
import { shoppingCsv } from '../lib/csv.js';
import { download, plural, uid } from '../lib/utils.js';
import ColorPicker from './ColorPicker.jsx';
import { ColorCell, Confirm, Empty, Icon, Stepper } from './ui.jsx';

export default function Shopping() {
  const { state, update, toast, go } = useApp();
  const [newList, setNewList] = useState(false);
  const [name, setName] = useState('');
  const lists = state.shopping.lists;
  const toBuy = ops.overview(state).toBuy;
  const auto = state.settings.autoAddPurchased;

  const copy = async () => {
    const text = lists.map((l) => {
      const items = l.items.filter((i) => !i.checked);
      return items.length ? `${l.name}\n` + items.map((i) => `- ${i.code} ${i.name} × ${i.qty}`).join('\n') : '';
    }).filter(Boolean).join('\n\n');
    try { await navigator.clipboard.writeText(text || 'Nothing to buy'); toast('Copied the list'); } catch { toast('Could not copy. Use CSV export instead.', 'bad'); }
  };

  return (
    <div className="stack">
      <div className="page-head">
        <div><h1>Shopping</h1><p className="muted">{toBuy === 0 ? 'Nothing to buy right now.' : `${plural(toBuy, 'skein')} to buy.`}</p></div>
        <div className="row">
          <button className="btn" onClick={copy}>Copy</button>
          <button className="btn" onClick={() => download('floss-shopping.csv', shoppingCsv(state), 'text/csv')}>Export CSV</button>
          <button className="btn primary" onClick={() => setNewList(true)}>New list</button>
        </div>
      </div>
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
            <ColorPicker catalog={catalog} placeholder="Add a color by number or name" onSelect={(c) => { update((s) => ops.addShoppingItem(s, list.id, c, qty)); toast(`Added ${qty} × ${c.code}`); }} />
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
