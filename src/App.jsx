import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppContext } from './lib/context.js';
import { makeCatalog } from './lib/catalog.js';
import { emptyState, overview, conflicts } from './lib/ops.js';
import { repairState } from './lib/migrate.js';
import { loadState, saveState } from './lib/storage.js';
import { BUILTIN_DMC } from './data/index.js';
import { Icon } from './components/ui.jsx';
import Overview from './components/Overview.jsx';
import AddFloss from './components/AddFloss.jsx';
import Supply from './components/Supply.jsx';
import Projects from './components/Projects.jsx';
import Shopping from './components/Shopping.jsx';
import DataTab from './components/DataTab.jsx';

const TABS = [
  ['overview', 'Overview', 'home'],
  ['add', 'Add', 'plus'],
  ['supply', 'Supply', 'box'],
  ['projects', 'Projects', 'folder'],
  ['shopping', 'Shopping', 'cart'],
  ['data', 'Data', 'data'],
];

function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const [tab = 'overview', id] = path.split('/');
  return { tab: TABS.some((t) => t[0] === tab) ? tab : 'overview', id, params: new URLSearchParams(query) };
}

export default function App() {
  const initial = useRef(null);
  if (!initial.current) {
    const loaded = loadState();
    // Fix data saved by older versions (for example BLANC vs White) before first render.
    initial.current = { ...loaded, state: repairState(loaded.state, makeCatalog(BUILTIN_DMC, [])) };
  }
  const [state, setStateRaw] = useState(initial.current.state);
  const [route, setRoute] = useState(parseHash);
  const [toasts, setToasts] = useState([]);
  const saveFailed = useRef(false);

  useEffect(() => {
    const on = () => setRoute(parseHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const toast = useCallback((msg, kind) => {
    const id = Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  useEffect(() => {
    if (initial.current.recovered) toast('Saved data could not be read. A copy was kept in this browser.', 'bad');
  }, [toast]);

  // Persist (debounced).
  useEffect(() => {
    const h = setTimeout(() => {
      const ok = saveState(state);
      if (!ok && !saveFailed.current) { saveFailed.current = true; toast('Could not save to this browser. Download a backup.', 'bad'); }
    }, 200);
    return () => clearTimeout(h);
  }, [state, toast]);

  // Theme.
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = () => {
      const t = state.settings.theme;
      root.dataset.theme = t === 'system' ? (mq?.matches ? 'dark' : 'light') : t;
    };
    apply();
    mq?.addEventListener?.('change', apply);
    return () => mq?.removeEventListener?.('change', apply);
  }, [state.settings.theme]);

  const update = useCallback((fn) => setStateRaw((s) => fn(s)), []);
  const setState = useCallback((s) => setStateRaw(s ?? emptyState()), []);
  const catalog = useMemo(() => makeCatalog(BUILTIN_DMC, state.customColors), [state.customColors]);
  const go = useCallback((to) => { window.location.hash = '#/' + to; window.scrollTo?.(0, 0); }, []);

  const ctx = useMemo(() => ({ state, update, setState, catalog, toast, go }), [state, update, setState, catalog, toast, go]);
  const alerts = useMemo(() => conflicts(state).length, [state]);
  const toBuy = useMemo(() => overview(state).toBuy, [state]);

  let page;
  switch (route.tab) {
    case 'add': page = <AddFloss />; break;
    case 'supply': page = <Supply initialQuery={route.params.get('q') || ''} />; break;
    case 'projects': page = <Projects projectId={route.id} />; break;
    case 'shopping': page = <Shopping />; break;
    case 'data': page = <DataTab />; break;
    default: page = <Overview />;
  }

  return (
    <AppContext.Provider value={ctx}>
      <div className="shell">
        <header className="top">
          <div className="top-inner">
            <div className="brand">
              <span className="brand-mark"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round"><path d="M5 5l14 14M19 5L5 19" /></svg></span>
              Floss Ledger
            </div>
          </div>
        </header>
        <nav className="tabs" aria-label="Sections">
          {TABS.map(([id, label, icon]) => (
            <a key={id} href={'#/' + id} className="tab" aria-current={route.tab === id ? 'page' : undefined}>
              <Icon name={icon} size={20} />
              <span>{label}</span>
              {id === 'overview' && alerts > 0 && <span className="badge-dot" aria-label={`${alerts} warnings`}>{alerts}</span>}
              {id === 'shopping' && toBuy > 0 && <span className="badge-dot" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }} aria-label={`${toBuy} to buy`}>{toBuy}</span>}
            </a>
          ))}
        </nav>
        <main className="main">{page}</main>
        <div className="toasts" role="status" aria-live="polite">
          {toasts.map((t) => <div key={t.id} className={'toast' + (t.kind === 'bad' ? ' bad' : '')}>{t.msg}</div>)}
        </div>
      </div>
    </AppContext.Provider>
  );
}
