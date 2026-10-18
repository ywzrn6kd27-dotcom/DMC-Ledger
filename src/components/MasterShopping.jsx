import { useMemo, useState } from 'react';
import { useApp } from '../lib/context.js';
import * as ops from '../lib/ops.js';
import { naturalCodeCompare, fmtSkeins, plural } from '../lib/utils.js';
import ColorPicker from './ColorPicker.jsx';
import { ColorCell, Empty, Stepper } from './ui.jsx';

// One top-level list of everything to buy: a row per color with the total needed across all active
// projects, what you own, and how many skeins to buy. Tap a row to see which projects need it.
export default function MasterShopping() {
  const { state, update, toast } = useApp();
  const [showAll, setShowAll] = useState(false);
  const [sort, setSort] = useState('code');
  const [open, setOpen] = useState(null);
  const [qty, setQty] = useState(1);

  const all = useMemo(() => ops.masterList(state), [state]);
  const rows = useMemo(() => {
    const list = all.filter((r) => showAll || r.toBuy > 0);
    return list.sort(sort === 'most'
      ? (a, b) => b.toBuy - a.toBuy || naturalCodeCompare(a.code, b.code)
      : (a, b) => a.brand.localeCompare(b.brand) || naturalCodeCompare(a.code, b.code));
  }, [all, showAll, sort]);
  const totals = ops.masterTotals(state);
  const covered = all.filter((r) => r.toBuy === 0).length;

  const bought = (r) => {
    update((s) => ops.markMasterBought(s, r.key));
    toast(`${plural(r.toBuy, 'skein')} of ${r.code} added to supply`);
  };

  return (
    <div className="stack">
      <div className="panel stack tight">
        <div className="row spread">
          <div>
            <b style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem' }}>{totals.toBuy}</b>{' '}
            <span className="muted">skein{totals.toBuy === 1 ? '' : 's'} to buy across {plural(totals.colors, 'color')}</span>
          </div>
          <select className="input" style={{ maxWidth: 170 }} aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="code">Sort: number</option><option value="most">Sort: most to buy</option>
          </select>
        </div>
        <p className="muted small">Combined from every active project, plus anything you add by hand below. Colors you already own are subtracted once, even when several projects use them.</p>
        <div className="row">
          <div className="grow" style={{ minWidth: 200 }}>
            <ColorPicker placeholder="Add a color to buy by hand" onSelect={(c) => { update((s) => ops.addShoppingItem(s, ops.GENERAL_LIST_ID, c, qty)); toast(`Added ${qty} × ${c.code}`); }} />
          </div>
          <Stepper label="Quantity to add" value={qty} min={1} onChange={setQty} />
        </div>
      </div>

      {covered > 0 && (
        <label className="row" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          <span>Also show {plural(covered, 'color')} I already have enough of</span>
        </label>
      )}

      {rows.length === 0 ? (
        <div className="panel"><Empty title={all.length ? 'You have everything you need' : 'Nothing to buy yet'}>{all.length ? 'Every color in your active projects is covered by your supply.' : 'Import a chart or create a project and its missing colors appear here, combined across projects.'}</Empty></div>
      ) : (
        <div className="panel flush"><div className="list">
          {rows.map((r) => {
            const isOpen = open === r.key;
            return (
              <div key={r.key} style={{ borderTop: '1px solid var(--line)' }}>
                <button className="item click" style={{ borderTop: 0 }} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.key)}>
                  <div className="grow"><ColorCell color={r} sub={`${r.uses.length + (r.manual ? 1 : 0) > 1 ? `${r.uses.length + (r.manual ? 1 : 0)} sources` : r.uses[0]?.name || 'added by hand'}`} /></div>
                  <div className="qty">
                    <b style={{ color: r.toBuy > 0 ? 'var(--warn)' : 'var(--ok)' }}>{r.toBuy > 0 ? `Buy ${r.toBuy}` : 'Covered'}</b>
                    <div className="muted small">need {fmtSkeins(r.needed)} · own {fmtSkeins(r.owned)}</div>
                  </div>
                </button>
                {isOpen && (
                  <div className="stack tight" style={{ padding: '0 14px 12px 54px' }}>
                    {r.uses.map((u) => <div key={u.projectId} className="row spread small"><span>{u.name}</span><span className="muted">{fmtSkeins(u.need)} skein{u.need === 1 ? '' : 's'}</span></div>)}
                    {r.manualItems.map((m) => <div key={m.itemId} className="row spread small"><span>Added by hand · {m.listName}</span><span className="muted">{m.qty}</span></div>)}
                    <div className="row spread small"><b>Total needed</b><b>{fmtSkeins(r.needed)}</b></div>
                    <div className="row spread small"><span>You own</span><span>{fmtSkeins(r.owned)}</span></div>
                    {r.toBuy > 0 && <div><button className="btn small primary" onClick={() => bought(r)}>Mark {r.toBuy} bought (add to supply)</button></div>}
                  </div>
                )}
              </div>
            );
          })}
        </div></div>
      )}
    </div>
  );
}
