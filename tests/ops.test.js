import test from 'node:test';
import assert from 'node:assert/strict';
import * as ops from '../src/lib/ops.js';
import { estimateSkeins, roundUpQuarter } from '../src/lib/skeins.js';
import { fmtSkeins } from '../src/lib/utils.js';

const black = { brand: 'DMC', code: '310', name: 'Black', hex: '#000000' };
const red = { brand: 'DMC', code: '666', name: 'Bright Red', hex: '#E31D42' };
const K = 'DMC:310';

test('add / set stock and partial bookkeeping', () => {
  let s = ops.addStock(ops.emptyState(), black, { whole: 2, partials: [0.5] });
  assert.equal(ops.totalOf(s.inventory[K]), 2.5);
  s = ops.addStock(s, black, { whole: 1 });
  assert.equal(s.inventory[K].whole, 3);
  s = ops.markPartial(s, K, 0.25);
  assert.equal(s.inventory[K].whole, 2);
  assert.deepEqual(s.inventory[K].partials, [0.25, 0.5]);
  s = ops.markUsedUp(s, K);
  assert.equal(ops.totalOf(s.inventory[K]), 0);
  assert.equal(s.inventory[K].usedUp, true);
  s = ops.addStock(s, black, { whole: 1 });
  assert.equal(s.inventory[K].usedUp, false);
});

test('consume uses partials first, then cuts into a whole skein', () => {
  assert.deepEqual(ops.consume({ whole: 2, partials: [0.5] }, 1), { whole: 1, partials: [0.5] });
  assert.deepEqual(ops.consume({ whole: 1, partials: [] }, 0.25), { whole: 0, partials: [0.75] });
  assert.deepEqual(ops.consume({ whole: 0, partials: [0.25, 0.75] }, 0.5), { whole: 0, partials: [0.5] });
  assert.deepEqual(ops.consume({ whole: 3, partials: [] }, 3), { whole: 0, partials: [] });
});

test('estimates are sane and round up to quarters', () => {
  const est = estimateSkeins({ stitches: 2000, fabricCount: 14, strands: 2, waste: 25 });
  assert.ok(est > 0.8 && est < 1.2, String(est));
  assert.ok(estimateSkeins({ stitches: 2000, fabricCount: 18, strands: 2 }) < est); // finer fabric uses less
  assert.equal(roundUpQuarter(0.01), 0.25);
  assert.equal(roundUpQuarter(1.01), 1.25);
  assert.equal(roundUpQuarter(0), 0);
  assert.equal(fmtSkeins(1.5), '1½');
});

function withProject() {
  let s = ops.addStock(ops.emptyState(), black, { whole: 2 });
  const p = ops.makeProject({ id: 'p1', name: 'Owl', colors: [
    ops.makeProjectColor(black, { stitches: 5000 }),
    ops.makeProjectColor(red, { need: 2 }),
  ] });
  return ops.addProject(s, p);
}

test('matching: covered, missing and shopping list from the shortfall', () => {
  let s = withProject();
  const p = s.projects[0];
  const rows = ops.projectRows(s, p);
  const need310 = rows[0].need;
  assert.ok(need310 >= 2 && need310 <= 3, String(need310));
  assert.equal(rows[1].status, 'missing');
  assert.equal(rows[1].short, 2);
  s = ops.syncProjectShopping(s, 'p1');
  const list = s.shopping.lists.find((l) => l.projectId === 'p1');
  assert.equal(list.items.find((i) => i.code === '666').qty, 2);
  // re-sync after buying: auto items update, nothing duplicates
  s = ops.syncProjectShopping(s, 'p1');
  assert.equal(s.shopping.lists.find((l) => l.projectId === 'p1').items.filter((i) => i.code === '666').length, 1);
});

test('reserving decrements free stock and completion can use or release', () => {
  let s = withProject();
  s = ops.reserveFromSupply(s, 'p1');
  const assigned = s.projects[0].colors[0].assigned;
  assert.equal(assigned, 2);
  assert.equal(ops.stockInfo(s, K).available, 0);
  const used = ops.completeProject(s, 'p1', 'use');
  assert.equal(ops.totalOf(used.inventory[K]), 0);
  assert.equal(used.projects[0].status, 'completed');
  assert.equal(used.projects[0].colors[0].used, 2);
  const rel = ops.completeProject(s, 'p1', 'release');
  assert.equal(ops.totalOf(rel.inventory[K]), 2);
  assert.equal(rel.projects[0].colors[0].assigned, 0);
});

test('conflicts: two projects competing for the same limited skeins', () => {
  let s = withProject();
  s = ops.addProject(s, ops.makeProject({ id: 'p2', name: 'Fox', colors: [ops.makeProjectColor(black, { need: 2 })] }));
  const c = ops.conflicts(s);
  assert.equal(c.length, 1);
  assert.equal(c[0].type, 'competing');
  assert.equal(c[0].uses.length, 2);
  // second project's coverage accounts for the first one's reservation
  s = ops.reserveFromSupply(s, 'p1');
  const r2 = ops.projectRows(s, s.projects[1])[0];
  assert.equal(r2.free, 0);
  assert.ok(r2.short >= 2);
});

test('shopping check-off adds to supply and unchecking reverses it', () => {
  let s = ops.addShoppingItem(ops.emptyState(), 'general', red, 2);
  const id = s.shopping.lists[0].items[0].id;
  s = ops.toggleBought(s, 'general', id, true);
  assert.equal(s.inventory['DMC:666'].whole, 2);
  s = ops.toggleBought(s, 'general', id, true);
  assert.equal(s.inventory['DMC:666'].whole, 0);
  assert.equal(s.shopping.lists[0].items[0].checked, false);
  s = ops.toggleBought(s, 'general', id, false);
  assert.equal(s.inventory['DMC:666'].whole, 0);
});

test('low stock and normalizeState round trip', () => {
  let s = ops.addStock(ops.emptyState(), black, { whole: 1, minStock: 3 });
  assert.equal(ops.lowStock(s).length, 1);
  const again = ops.normalizeState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(again.inventory, s.inventory);
  assert.equal(ops.normalizeState(null).projects.length, 0);
  assert.equal(ops.normalizeState({ shopping: { lists: [] } }).shopping.lists[0].id, 'general');
});
