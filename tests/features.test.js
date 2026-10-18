import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeCatalog } from '../src/lib/catalog.js';
import { repairState } from '../src/lib/migrate.js';
import { fabricSize } from '../src/lib/fabric.js';
import * as ops from '../src/lib/ops.js';
import { shoppingCsv } from '../src/lib/csv.js';

const dmc = JSON.parse(readFileSync(new URL('../src/data/dmc.json', import.meta.url), 'utf8'));
const builtin = makeCatalog(dmc);

test('repairState merges BLANC into White everywhere and drops the stray custom color', () => {
  let s = ops.emptyState();
  s = ops.addStock(s, { brand: 'DMC', code: 'White' }, { whole: 6 });
  s = ops.addStock(s, { brand: 'DMC', code: 'BLANC' }, { whole: 1, partials: [0.5] });
  const p = ops.makeProject({ id: 'p', name: 'Chart', colors: [
    ops.makeProjectColor({ brand: 'DMC', code: 'BLANC', name: 'White', hex: '#FFFFFF' }, { stitches: 64, assigned: 1 }),
  ] });
  s = ops.addProject(s, p);
  s = { ...s, customColors: [{ brand: 'DMC', code: 'BLANC', name: 'White', hex: '#FFFFFF' }] };
  s = ops.addShoppingItem(s, 'general', { brand: 'DMC', code: 'BLANC', name: 'White', hex: '#FFFFFF' }, 1);

  const r = repairState(s, builtin);
  assert.equal(r.inventory['DMC:BLANC'], undefined);
  assert.equal(r.inventory['DMC:White'].whole, 7);
  assert.deepEqual(r.inventory['DMC:White'].partials, [0.5]);
  assert.equal(r.projects[0].colors[0].code, 'White');
  assert.equal(r.projects[0].colors[0].key, 'DMC:White');
  assert.equal(r.projects[0].colors[0].stitches, 64);
  assert.equal(r.customColors.length, 0);
  assert.equal(r.shopping.lists[0].items[0].code, 'White');
  // the project now sees the white it owns
  const row = ops.projectRows(r, r.projects[0])[0];
  assert.equal(row.total, 7.5);
  assert.equal(repairState(r, builtin), r); // idempotent: same object back
});

test('fabric size: stitched area plus margin, rounded up', () => {
  const f = fabricSize(175, 110, 14, 3);
  assert.equal(f.w, 19);
  assert.equal(f.h, 14);
  assert.equal(fabricSize(175, 110, 18, 3).w, 16);
  assert.equal(fabricSize(0, 110, 14), null);
});

test('other supplies: add, link, unlink on project delete, export', () => {
  let s = ops.addProject(ops.emptyState(), ops.makeProject({ id: 'p1', name: 'Owl' }));
  s = ops.addSupply(s, { name: '14-count fabric', category: 'Fabric', projectId: 'p1', qty: 1 });
  s = ops.addSupply(s, { name: 'Needles', qty: 2 });
  assert.equal(s.supplies.length, 2);
  assert.equal(ops.overview(s).suppliesToBuy, 3);
  s = ops.updateSupply(s, s.supplies[1].id, { checked: true });
  assert.equal(ops.overview(s).suppliesToBuy, 1);
  assert.match(shoppingCsv(s), /Other supplies: Fabric,,,14-count fabric,1,no,,Owl/);
  s = ops.deleteProject(s, 'p1');
  assert.equal(s.supplies[0].projectId, null);
  const again = ops.normalizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(again.supplies.length, 2);
});

test('saved custom colors keep type, gradient and pending flag through normalize', () => {
  let s = ops.saveCustomColor(ops.emptyState(), { code: '4050', name: 'Leaves', hex: '#AA0000', type: 'variegated', colors: ['#AA0000', '#00AA00'] });
  s = ops.saveCustomColor(s, { code: '4055', name: '', hex: '#9AA0A6', pending: true });
  const n = ops.normalizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(n.customColors.find((c) => c.code === '4050').colors.length, 2);
  assert.equal(n.customColors.find((c) => c.code === '4055').pending, true);
  // saving the same code again replaces it
  s = ops.saveCustomColor(s, { code: '4055', name: 'Named now', hex: '#112233' });
  assert.equal(s.customColors.filter((c) => c.code === '4055').length, 1);
  assert.equal(s.customColors.find((c) => c.code === '4055').pending, undefined);
});

test('master shopping list: totals across projects, no double counting, manual items, bought', () => {
  const black = { brand: 'DMC', code: '310', name: 'Black', hex: '#000000' };
  const red = { brand: 'DMC', code: '666', name: 'Bright Red', hex: '#E31D42' };
  let s = ops.addStock(ops.emptyState(), black, { whole: 2 });
  s = ops.addProject(s, ops.makeProject({ id: 'a', name: 'Owl', colors: [ops.makeProjectColor(black, { need: 2 }), ops.makeProjectColor(red, { need: 1 })] }));
  s = ops.addProject(s, ops.makeProject({ id: 'b', name: 'Fox', colors: [ops.makeProjectColor(black, { need: 3 })] }));
  s = ops.addShoppingItem(s, 'general', red, 2); // manual extra

  let m = ops.masterList(s);
  const b = m.find((r) => r.code === '310');
  assert.equal(b.demand, 5);
  assert.equal(b.owned, 2);
  assert.equal(b.toBuy, 3); // 5 needed in total, 2 owned: not 2 + 3
  assert.deepEqual(b.uses.map((u) => u.name).sort(), ['Fox', 'Owl']);
  const r = m.find((x) => x.code === '666');
  assert.equal(r.projectBuy, 1);
  assert.equal(r.manual, 2);
  assert.equal(r.toBuy, 3);
  assert.equal(ops.masterTotals(s).toBuy, 6);
  assert.equal(ops.overview(s).toBuy, 6);

  // project sublist items are derived, so they are not counted twice
  s = ops.syncProjectShopping(s, 'a');
  assert.equal(ops.masterTotals(s).toBuy, 6);

  s = ops.markMasterBought(s, 'DMC:310');
  assert.equal(s.inventory['DMC:310'].whole, 5);
  assert.equal(ops.masterList(s).find((x) => x.code === '310').toBuy, 0);
  s = ops.markMasterBought(s, 'DMC:666');
  assert.equal(s.inventory['DMC:666'].whole, 3);
  assert.equal(s.shopping.lists[0].items[0].checked, true);
  assert.equal(ops.masterTotals(s).toBuy, 0);
  // finished projects stop counting
  s = ops.updateProject(s, 'b', { status: 'completed' });
  assert.equal(ops.masterList(s).find((x) => x.code === '310').demand, 2);
});
