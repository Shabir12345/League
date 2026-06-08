const test = require('node:test');
const assert = require('node:assert');
const P = require('../js/profiles-core.js');

const GAMES = [
  { win:true,  fiveStack:false, csAt10:80, csDiff10:10,  csDiff14:20,  goldDiff10:500,  goldDiff14:1000 },
  { win:false, fiveStack:true,  csAt10:60, csDiff10:-10, csDiff14:-20, goldDiff10:-500, goldDiff14:-1000 },
  { win:true,  fiveStack:true,  csAt10:70, csDiff10:0,   csDiff14:0,   goldDiff10:0,    goldDiff14:0 }
];

test('laneAggregate averages each field and reports sample size', () => {
  const a = P.laneAggregate(GAMES);
  assert.strictEqual(a.n, 3);
  assert.strictEqual(a.csAt10, 70);      // (80+60+70)/3
  assert.strictEqual(a.csDiff10, 0);     // (10-10+0)/3
  assert.strictEqual(a.goldDiff14, 0);
});

test('laneAggregate skips missing fields, returns null when no values', () => {
  const a = P.laneAggregate([{ win:true, csAt10:50 }]);
  assert.strictEqual(a.csAt10, 50);
  assert.strictEqual(a.csDiff10, null);
});

test('recordOf counts wins/losses/winrate', () => {
  assert.deepStrictEqual(P.recordOf(GAMES), { w:2, l:1, games:3, winrate:2/3 });
});

test('splitByStack partitions on the fiveStack flag', () => {
  const s = P.splitByStack(GAMES);
  assert.strictEqual(s.solo.length, 1);
  assert.strictEqual(s.five.length, 2);
});

test('fmtDiff formats sign, decimals, and k-suffix', () => {
  assert.strictEqual(P.fmtDiff(4.2, { dec:1 }), '+4.2');
  assert.strictEqual(P.fmtDiff(-1242, { k:true }), '-1.2k');
  assert.strictEqual(P.fmtDiff(430, { k:true }), '+430');
  assert.strictEqual(P.fmtDiff(0), '0');
  assert.strictEqual(P.fmtDiff(null), '—');
});
