import { canonicalCode } from './catalog.js';
import { colorKey } from './utils.js';

// Repair data saved before aliases were understood (for example FlossCross's "BLANC" for DMC White).
// `builtin` is a catalog made from the built-in list only. Returns the same object if nothing changed.
export function repairState(state, builtin) {
  let changed = false;
  const canon = (brand, code) => {
    const c = canonicalCode(builtin, brand, code);
    return c && c !== code ? c : null;
  };
  const info = (brand, code) => builtin.find(brand, code);

  // Inventory
  const inventory = { ...state.inventory };
  for (const [key, it] of Object.entries(state.inventory)) {
    const to = canon(it.brand, it.code);
    if (!to) continue;
    changed = true;
    delete inventory[key];
    const tk = colorKey(it.brand, to);
    const cur = inventory[tk];
    inventory[tk] = cur
      ? {
          ...cur,
          whole: cur.whole + it.whole,
          partials: [...cur.partials, ...it.partials].sort(),
          minStock: Math.max(cur.minStock, it.minStock),
          notes: [cur.notes, it.notes].filter(Boolean).join('; '),
          usedUp: cur.usedUp && it.usedUp,
        }
      : { ...it, code: to };
  }

  // Projects
  const projects = state.projects.map((p) => {
    let pChanged = false;
    const out = [];
    for (const c of p.colors) {
      const to = canon(c.brand, c.code);
      if (!to) { out.push(c); continue; }
      pChanged = true;
      const meta = info(c.brand, to);
      const key = colorKey(c.brand, to);
      const dup = out.find((x) => x.key === key);
      if (dup) {
        dup.stitches += c.stitches;
        dup.bsStitches += c.bsStitches;
        dup.assigned += c.assigned;
        dup.used += c.used;
        if (dup.need == null) dup.need = c.need;
      } else {
        out.push({ ...c, key, code: to, name: meta?.name || c.name, hex: meta?.hex || c.hex });
      }
    }
    if (pChanged) changed = true;
    return pChanged ? { ...p, colors: out } : p;
  });

  // Shopping items
  const lists = state.shopping.lists.map((l) => {
    let lChanged = false;
    const items = l.items.map((i) => {
      const to = canon(i.brand, i.code);
      if (!to) return i;
      lChanged = true;
      const meta = info(i.brand, to);
      return { ...i, key: colorKey(i.brand, to), code: to, name: meta?.name || i.name, hex: meta?.hex || i.hex };
    });
    if (lChanged) changed = true;
    return lChanged ? { ...l, items } : l;
  });

  // Stray custom colors that duplicate a built-in one under another name
  const customColors = state.customColors.filter((c) => !canon(c.brand, c.code));
  if (customColors.length !== state.customColors.length) changed = true;

  return changed ? { ...state, inventory, projects, shopping: { lists }, customColors } : state;
}
