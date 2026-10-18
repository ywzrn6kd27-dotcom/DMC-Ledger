import { useMemo } from 'react';
import { useApp } from '../lib/context.js';
import * as ops from '../lib/ops.js';
import { FAMILIES, colorFamily, fmtSkeins, lightness, plural } from '../lib/utils.js';
import { ColorCell, StitchX, Empty } from './ui.jsx';

export default function Overview() {
  const { state, catalog, go } = useApp();
  const o = ops.overview(state);
  const conflicts = ops.conflicts(state);
  const low = ops.lowStock(state);
  const active = state.projects.filter(ops.isActive);

  const tiles = useMemo(() => {
    return Object.entries(state.inventory)
      .map(([key, it]) => ({ key, it, total: ops.totalOf(it), c: catalog.find(it.brand, it.code) }))
      .filter((t) => t.total > 0 && t.c)
      .sort((a, b) => FAMILIES.indexOf(a.c.family) - FAMILIES.indexOf(b.c.family) || lightness(a.c.hex) - lightness(b.c.hex));
  }, [state.inventory, catalog]);

  const empty = tiles.length === 0;
  const ghosts = Array.from({ length: 40 });

  return (
    <div className="stack">
      <div className="wall-hero">
        <div className="page-head" style={{ marginBottom: 0 }}>
          <div>
            <h1>{empty ? 'Your thread wall is empty' : `${plural(o.colors, 'color')} on the shelf`}</h1>
            <p className="muted">{empty ? 'Add floss and each color appears here as a stitch.' : `${fmtSkeins(o.skeins)} skeins in total. Tap a stitch to open that color.`}</p>
          </div>
          <div className="row">
            <button className="btn primary" onClick={() => go('add')}>Add floss</button>
            <button className="btn" onClick={() => go('projects')}>Import a chart</button>
          </div>
        </div>
        <div className="wall" aria-label="Thread wall">
          {empty
            ? ghosts.map((_, i) => <span key={i} className="tile ghost" />)
            : tiles.map(({ key, c, total }) => (
                <button key={key} className="tile" title={`${c.code} ${c.name} · ${fmtSkeins(total)} skein${total === 1 ? '' : 's'}`} onClick={() => go('supply?q=' + encodeURIComponent(c.code))}>
                  <StitchX hex={c.hex} colors={c.colors} />
                  {total > 1 && <span className="n">{fmtSkeins(total)}</span>}
                </button>
              ))}
        </div>
      </div>

      <div className="statstrip">
        <div className="stat"><b>{fmtSkeins(o.skeins)}</b><span>Total skeins</span></div>
        <div className="stat"><b>{o.colors}</b><span>Colors owned</span></div>
        <div className="stat"><b>{fmtSkeins(o.reserved)}</b><span>Reserved for projects</span></div>
        <div className="stat"><b>{o.toBuy}</b><span>On shopping lists</span></div>
      </div>

      {(conflicts.length > 0 || low.length > 0) && (
        <div className="stack tight">
          {conflicts.map((c) => (
            <div className="banner" key={c.key}>
              <div>
                <strong>{c.code} {c.name}:</strong>{' '}
                {c.type === 'over-assigned'
                  ? `${fmtSkeins(c.assigned)} skeins are reserved but you own ${fmtSkeins(c.total)}.`
                  : `${c.uses.map((u) => u.name).join(' and ')} need ${fmtSkeins(c.needSum)} together; you own ${fmtSkeins(c.total)}.`}
              </div>
            </div>
          ))}
          {low.length > 0 && (
            <div className="banner info">
              <div><strong>Running low:</strong>{' '}
                {low.map((l) => `${l.item.code} (${fmtSkeins(l.total)} of ${l.min})`).join(', ')}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="panel flush">
        <div className="section-head" style={{ padding: '14px 14px 0' }}>
          <h2>Active projects</h2>
          <button className="btn small ghost" onClick={() => go('projects')}>All projects</button>
        </div>
        {active.length === 0 ? (
          <Empty title="No active projects">Import a FlossCross chart to see what you already own and what to buy.</Empty>
        ) : (
          <div className="list">
            {active.map((p) => {
              const t = ops.projectTotals(state, p);
              const pct = t.needed ? Math.round((t.covered / t.needed) * 100) : 0;
              return (
                <button key={p.id} className="item click" onClick={() => go('projects/' + p.id)}>
                  <div className="grow">
                    <b>{p.name}</b>
                    <div className="meter" style={{ marginTop: 6 }}><i style={{ width: pct + '%' }} /></div>
                  </div>
                  <div className="qty muted small">{t.covered} of {t.needed} colors covered{t.toBuy > 0 ? ` · buy ${t.toBuy}` : ''}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
