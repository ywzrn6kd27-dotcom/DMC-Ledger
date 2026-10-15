// Pure state operations. Every function takes the app state and returns a new one.
import { colorKey, uid } from './utils.js';
import { estimateSkeins, roundUpQuarter } from './skeins.js';

export const GENERAL_LIST_ID = 'general';
const EPS = 1e-9;

export function emptyState() {
  return {
    version: 1,
    settings: {
      theme: 'system',
      defaultFabricCount: 14,
      defaultWaste: 25,
      autoAddPurchased: true,
      lastBackupAt: null,
    },
    customColors: [],
    inventory: {},
    projects: [],
    shopping: { lists: [{ id: GENERAL_LIST_ID, name: 'General', projectId: null, items: [] }] },
  };
}

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const quarters = (v) => Math.max(0, Math.round(num(v) * 4) / 4);

export function normalizeState(raw) {
  const base = emptyState();
  if (!raw || typeof raw !== 'object') return base;
  const s = { ...base, settings: { ...base.settings, ...(raw.settings || {}) } };
  s.customColors = (Array.isArray(raw.customColors) ? raw.customColors : [])
    .filter((c) => c && c.code && /^#[0-9a-f]{6}$/i.test(c.hex || ''))
    .map((c) => ({ brand: c.brand || 'DMC', code: String(c.code), name: c.name || '', hex: c.hex.toUpperCase() }));
  s.inventory = {};
  for (const it of Object.values(raw.inventory || {})) {
    if (!it || !it.code) continue;
    const brand = it.brand || 'DMC';
    s.inventory[colorKey(brand, it.code)] = {
      brand,
      code: String(it.code),
      whole: Math.max(0, Math.floor(num(it.whole))),
      partials: (Array.isArray(it.partials) ? it.partials : []).map(quarters).filter((p) => p > 0 && p < 1).sort(),
      minStock: Math.max(0, Math.floor(num(it.minStock))),
      usedUp: !!it.usedUp,
      notes: String(it.notes || ''),
      updatedAt: num(it.updatedAt, 0),
    };
  }
  s.projects = (Array.isArray(raw.projects) ? raw.projects : []).filter((p) => p && p.id).map((p) => ({
    id: p.id,
    name: String(p.name || 'Untitled project'),
    status: ['planned', 'inprogress', 'completed'].includes(p.status) ? p.status : 'planned',
    fabricCount: num(p.fabricCount, 14) || 14,
    strands: Math.min(6, Math.max(1, Math.round(num(p.strands, 2)))),
    bsStrands: Math.min(6, Math.max(1, Math.round(num(p.bsStrands, 1)))),
    waste: Math.max(0, num(p.waste, 25)),
    createdAt: num(p.createdAt, Date.now()),
    completedAt: p.completedAt ?? null,
    source: p.source || null,
    notes: String(p.notes || ''),
    colors: (Array.isArray(p.colors) ? p.colors : []).filter((c) => c && c.code).map((c) => {
      const brand = c.brand || 'DMC';
      return {
        key: colorKey(brand, c.code),
        brand,
        code: String(c.code),
        name: c.name || '',
        hex: c.hex || '#808080',
        stitches: Math.max(0, Math.floor(num(c.stitches))),
        bsStitches: Math.max(0, Math.floor(num(c.bsStitches))),
        need: c.need == null ? null : quarters(c.need),
        assigned: quarters(c.assigned),
        used: quarters(c.used),
      };
    }),
  }));
  const lists = (raw.shopping?.lists || []).filter((l) => l && l.id).map((l) => ({
    id: l.id,
    name: String(l.name || 'List'),
    projectId: l.projectId ?? null,
    items: (Array.isArray(l.items) ? l.items : []).filter((i) => i && i.code).map((i) => ({
      id: i.id || uid(),
      key: colorKey(i.brand || 'DMC', i.code),
      brand: i.brand || 'DMC',
      code: String(i.code),
      name: i.name || '',
      hex: i.hex || '#808080',
      qty: Math.max(1, Math.round(num(i.qty, 1))),
      checked: !!i.checked,
      added: !!i.added,
      note: String(i.note || ''),
      auto: !!i.auto,
    })),
  }));
  if (!lists.some((l) => l.id === GENERAL_LIST_ID)) lists.unshift(base.shopping.lists[0]);
  s.shopping = { lists };
  return s;
}

/* ---------- Stock math ---------- */

export const totalOf = (it) => (it ? it.whole + it.partials.reduce((a, b) => a + b, 0) : 0);
export const isActive = (p) => p.status !== 'completed';

export function assignedByKey(state, excludeProjectId = null) {
  const m = new Map();
  for (const p of state.projects) {
    if (!isActive(p) || p.id === excludeProjectId) continue;
    for (const c of p.colors) if (c.assigned > 0) m.set(c.key, (m.get(c.key) || 0) + c.assigned);
  }
  return m;
}

export function stockInfo(state, key, assignedMap = assignedByKey(state)) {
  const total = totalOf(state.inventory[key]);
  const assigned = assignedMap.get(key) || 0;
  return { total, assigned, available: total - assigned };
}

const blankItem = (color) => ({
  brand: color.brand, code: color.code, whole: 0, partials: [], minStock: 0, usedUp: false, notes: '', updatedAt: 0,
});

function putItem(state, key, item) {
  const next = { ...item, updatedAt: Date.now() };
  if (totalOf(next) > 0 && item.usedUp === state.inventory[key]?.usedUp) next.usedUp = false;
  return { ...state, inventory: { ...state.inventory, [key]: next } };
}

export function addStock(state, color, { whole = 0, partials = [], mode = 'add', minStock } = {}) {
  const key = colorKey(color.brand, color.code);
  const cur = state.inventory[key] || blankItem(color);
  const next =
    mode === 'set'
      ? { ...cur, whole, partials: [...partials].sort() }
      : { ...cur, whole: cur.whole + whole, partials: [...cur.partials, ...partials].sort() };
  if (minStock !== undefined) next.minStock = minStock;
  next.usedUp = false;
  return putItem(state, key, next);
}

export function setItemFields(state, key, patch) {
  const cur = state.inventory[key];
  if (!cur) return state;
  const next = { ...cur, ...patch };
  if (patch.partials) next.partials = [...patch.partials].sort();
  if (patch.whole !== undefined || patch.partials) next.usedUp = totalOf(next) === 0 ? cur.usedUp : false;
  return putItem(state, key, next);
}

export function removeItem(state, key) {
  const inv = { ...state.inventory };
  delete inv[key];
  return { ...state, inventory: inv };
}

// A skein was started: `fraction` of it is left.
export function markPartial(state, key, fraction) {
  const cur = state.inventory[key];
  if (!cur) return state;
  return putItem(state, key, {
    ...cur,
    whole: Math.max(0, cur.whole - (cur.whole >= 1 ? 1 : 0)),
    partials: [...cur.partials, fraction].sort(),
    usedUp: false,
  });
}

export function markUsedUp(state, key) {
  const cur = state.inventory[key];
  if (!cur) return state;
  return putItem(state, key, { ...cur, whole: 0, partials: [], usedUp: true });
}

// Take `amount` skeins out of stock: smallest partials first, then cut into a whole skein.
export function consume(item, amount) {
  let q = Math.round(amount * 4);
  let whole = item.whole;
  const partials = [];
  for (const p of [...item.partials].sort()) {
    const pq = Math.round(p * 4);
    if (q >= pq) q -= pq;
    else if (q > 0) { partials.push((pq - q) / 4); q = 0; }
    else partials.push(p);
  }
  if (q > 0) {
    const need = Math.ceil(q / 4);
    whole = Math.max(0, whole - need);
    const leftover = need * 4 - q;
    if (leftover > 0 && item.whole >= need) partials.push(leftover / 4);
  }
  return { whole, partials: partials.sort() };
}

/* ---------- Projects ---------- */

export function makeProjectColor(color, extra = {}) {
  return {
    key: colorKey(color.brand, color.code),
    brand: color.brand,
    code: color.code,
    name: color.name || '',
    hex: color.hex || '#808080',
    stitches: 0,
    bsStitches: 0,
    need: null,
    assigned: 0,
    used: 0,
    ...extra,
  };
}

export function makeProject({ id = uid(), name, fabricCount = 14, strands = 2, bsStrands = 1, waste = 25, source = null, colors = [] }) {
  return {
    id, name: name || 'Untitled project', status: 'planned', fabricCount, strands, bsStrands, waste,
    createdAt: Date.now(), completedAt: null, source, notes: '', colors,
  };
}

export const addProject = (state, project) => ({ ...state, projects: [...state.projects, project] });

export function updateProject(state, id, patch) {
  const shopping = patch.name
    ? { lists: state.shopping.lists.map((l) => (l.projectId === id ? { ...l, name: patch.name } : l)) }
    : state.shopping;
  return { ...state, shopping, projects: state.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
}

export function deleteProject(state, id) {
  return {
    ...state,
    projects: state.projects.filter((p) => p.id !== id),
    shopping: { lists: state.shopping.lists.filter((l) => l.projectId !== id) },
  };
}

export function upsertProjectColor(state, projectId, color, patch = {}) {
  return {
    ...state,
    projects: state.projects.map((p) => {
      if (p.id !== projectId) return p;
      const key = colorKey(color.brand, color.code);
      const exists = p.colors.some((c) => c.key === key);
      const colors = exists
        ? p.colors.map((c) => (c.key === key ? { ...c, ...patch } : c))
        : [...p.colors, makeProjectColor(color, { need: 1, ...patch })];
      return { ...p, colors };
    }),
  };
}

export function removeProjectColor(state, projectId, key) {
  return { ...state, projects: state.projects.map((p) => (p.id === projectId ? { ...p, colors: p.colors.filter((c) => c.key !== key) } : p)) };
}

export function setAssigned(state, projectId, color, qty) {
  return upsertProjectColor(state, projectId, color, { assigned: quarters(qty) });
}

export function estimateFor(project, c) {
  return estimateSkeins({
    stitches: c.stitches, bsStitches: c.bsStitches, fabricCount: project.fabricCount,
    strands: project.strands, bsStrands: project.bsStrands, waste: project.waste,
  });
}

export function needFor(project, c) {
  if (c.need != null) return c.need;
  return roundUpQuarter(estimateFor(project, c));
}

export function projectRows(state, project) {
  const assignedAll = assignedByKey(state);
  const active = isActive(project);
  return project.colors.map((c) => {
    const total = totalOf(state.inventory[c.key]);
    const need = needFor(project, c);
    const free = Math.max(0, total - (assignedAll.get(c.key) || 0));
    const availToThis = active ? c.assigned + free : 0;
    const short = active ? Math.max(0, Math.ceil(need - availToThis - EPS)) : 0;
    let status = 'covered';
    if (!active) status = 'done';
    else if (need <= 0) status = 'none';
    else if (short > 0) status = total === 0 ? 'missing' : 'short';
    return { color: c, need, estimate: estimateFor(project, c), total, free, availToThis, short, status };
  });
}

export function projectTotals(state, project) {
  const rows = projectRows(state, project);
  const needed = rows.filter((r) => r.need > 0);
  return {
    rows,
    colors: project.colors.length,
    covered: needed.filter((r) => r.short === 0).length,
    needed: needed.length,
    toBuy: rows.reduce((a, r) => a + r.short, 0),
    stitches: project.colors.reduce((a, c) => a + c.stitches, 0),
  };
}

// Reserve as much free stock as each color needs.
export function reserveFromSupply(state, projectId) {
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return state;
  const rows = projectRows(state, project);
  const byKey = new Map(rows.map((r) => [r.color.key, r]));
  return {
    ...state,
    projects: state.projects.map((p) =>
      p.id !== projectId ? p : {
        ...p,
        colors: p.colors.map((c) => {
          const r = byKey.get(c.key);
          const target = Math.min(r.need, c.assigned + r.free);
          return { ...c, assigned: Math.max(c.assigned, quarters(target)) };
        }),
      },
    ),
  };
}

export function releaseAssigned(state, projectId) {
  return { ...state, projects: state.projects.map((p) => (p.id === projectId ? { ...p, colors: p.colors.map((c) => ({ ...c, assigned: 0 })) } : p)) };
}

// Turn a reservation into real use: stock goes down, the project remembers what it used.
export function markAssignmentUsed(state, projectId, key) {
  const project = state.projects.find((p) => p.id === projectId);
  const c = project?.colors.find((x) => x.key === key);
  if (!c || c.assigned <= 0) return state;
  let next = state;
  const item = state.inventory[key];
  if (item) {
    const left = consume(item, c.assigned);
    next = putItem(next, key, { ...item, whole: left.whole, partials: left.partials, usedUp: totalOf({ whole: left.whole, partials: left.partials }) === 0 ? true : item.usedUp });
  }
  return {
    ...next,
    projects: next.projects.map((p) =>
      p.id !== projectId ? p : { ...p, colors: p.colors.map((x) => (x.key === key ? { ...x, used: x.used + x.assigned, assigned: 0 } : x)) },
    ),
  };
}

export function completeProject(state, projectId, mode) {
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return state;
  let next = state;
  if (mode === 'use') {
    for (const c of project.colors) if (c.assigned > 0) next = markAssignmentUsed(next, projectId, c.key);
  } else if (mode === 'release') {
    next = releaseAssigned(next, projectId);
  }
  return updateProject(next, projectId, { status: 'completed', completedAt: Date.now() });
}

/* ---------- Warnings ---------- */

export function conflicts(state) {
  const byKey = new Map();
  for (const p of state.projects) {
    if (!isActive(p)) continue;
    for (const c of p.colors) {
      const need = needFor(p, c);
      if (need <= 0 && c.assigned <= 0) continue;
      const e = byKey.get(c.key) || { key: c.key, brand: c.brand, code: c.code, name: c.name, hex: c.hex, uses: [] };
      e.uses.push({ projectId: p.id, name: p.name, need, assigned: c.assigned });
      byKey.set(c.key, e);
    }
  }
  const out = [];
  for (const e of byKey.values()) {
    const total = totalOf(state.inventory[e.key]);
    const assigned = e.uses.reduce((a, u) => a + u.assigned, 0);
    const needSum = e.uses.reduce((a, u) => a + u.need, 0);
    if (assigned > total + EPS) out.push({ ...e, type: 'over-assigned', total, assigned, needSum });
    else if (e.uses.length >= 2 && needSum > total + EPS) out.push({ ...e, type: 'competing', total, assigned, needSum });
  }
  return out;
}

export function lowStock(state) {
  const assigned = assignedByKey(state);
  return Object.entries(state.inventory)
    .filter(([, it]) => it.minStock > 0 && totalOf(it) < it.minStock)
    .map(([key, it]) => ({ key, item: it, total: totalOf(it), min: it.minStock, assigned: assigned.get(key) || 0 }));
}

export function overview(state) {
  const assigned = assignedByKey(state);
  let skeins = 0, colors = 0, partialColors = 0;
  for (const it of Object.values(state.inventory)) {
    const t = totalOf(it);
    skeins += t;
    if (t > 0) colors++;
    if (it.partials.length) partialColors++;
  }
  const reserved = [...assigned.values()].reduce((a, b) => a + b, 0);
  const toBuy = state.shopping.lists.reduce((a, l) => a + l.items.filter((i) => !i.checked).reduce((x, i) => x + i.qty, 0), 0);
  return { skeins, colors, partialColors, reserved, toBuy };
}

/* ---------- Shopping ---------- */

const shoppingItem = (color, qty, extra = {}) => ({
  id: uid(), key: colorKey(color.brand, color.code), brand: color.brand, code: color.code, name: color.name || '',
  hex: color.hex || '#808080', qty: Math.max(1, Math.round(qty)), checked: false, added: false, note: '', auto: false, ...extra,
});

const mapList = (state, listId, fn) => ({ ...state, shopping: { lists: state.shopping.lists.map((l) => (l.id === listId ? fn(l) : l)) } });

export function addShoppingItem(state, listId, color, qty = 1) {
  return mapList(state, listId, (l) => {
    const key = colorKey(color.brand, color.code);
    const hit = l.items.find((i) => i.key === key && !i.checked);
    if (hit) return { ...l, items: l.items.map((i) => (i === hit ? { ...i, qty: i.qty + Math.max(1, Math.round(qty)) } : i)) };
    return { ...l, items: [...l.items, shoppingItem(color, qty)] };
  });
}

export const updateShoppingItem = (state, listId, itemId, patch) =>
  mapList(state, listId, (l) => ({ ...l, items: l.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) }));

export const removeShoppingItem = (state, listId, itemId) =>
  mapList(state, listId, (l) => ({ ...l, items: l.items.filter((i) => i.id !== itemId) }));

export const clearPurchased = (state, listId) =>
  mapList(state, listId, (l) => ({ ...l, items: l.items.filter((i) => !i.checked) }));

export function toggleBought(state, listId, itemId, autoAdd) {
  const list = state.shopping.lists.find((l) => l.id === listId);
  const item = list?.items.find((i) => i.id === itemId);
  if (!item) return state;
  let next = state;
  let added = item.added;
  const checking = !item.checked;
  if (checking && autoAdd && !item.added) {
    next = addStock(next, item, { whole: item.qty });
    added = true;
  } else if (!checking && item.added) {
    const cur = next.inventory[item.key];
    if (cur) next = setItemFields(next, item.key, { whole: Math.max(0, cur.whole - item.qty) });
    added = false;
  }
  return updateShoppingItem(next, listId, itemId, { checked: checking, added });
}

export function createList(state, id, name) {
  return { ...state, shopping: { lists: [...state.shopping.lists, { id, name, projectId: null, items: [] }] } };
}

export const renameList = (state, listId, name) => mapList(state, listId, (l) => ({ ...l, name }));

export function deleteList(state, listId) {
  if (listId === GENERAL_LIST_ID) return state;
  return { ...state, shopping: { lists: state.shopping.lists.filter((l) => l.id !== listId) } };
}

// Create or refresh the shopping sublist for a project from its shortfall.
export function syncProjectShopping(state, projectId) {
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return state;
  const short = projectRows(state, project).filter((r) => r.short > 0);
  const wanted = new Set(short.map((r) => r.color.key));
  const lists = state.shopping.lists;
  const existing = lists.find((l) => l.projectId === projectId);
  const base = existing || { id: 'proj-' + projectId, name: project.name, projectId, items: [] };
  let items = base.items.filter((i) => i.checked || !i.auto || wanted.has(i.key));
  for (const r of short) {
    const hit = items.find((i) => i.key === r.color.key && i.auto && !i.checked);
    if (hit) items = items.map((i) => (i === hit ? { ...i, qty: r.short } : i));
    else items = [...items, shoppingItem(r.color, r.short, { auto: true })];
  }
  const list = { ...base, name: project.name, items };
  return { ...state, shopping: { lists: existing ? lists.map((l) => (l === existing ? list : l)) : [...lists, list] } };
}
