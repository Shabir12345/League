// test/compute.test.js
const test = require('node:test');
const assert = require('node:assert');
const C = require('../pipeline/compute.js');
const { match, timeline, PUUIDS } = require('./fixtures/match-sample.js');

test('participantFor finds the participant by puuid', () => {
  const p = C.participantFor(match, PUUIDS.OURS);
  assert.strictEqual(p.championName, 'Ahri');
});

test('roleOf maps Riot teamPosition to our role names', () => {
  assert.strictEqual(C.roleOf('TOP'), 'Top');
  assert.strictEqual(C.roleOf('JUNGLE'), 'Jungle');
  assert.strictEqual(C.roleOf('MIDDLE'), 'Mid');
  assert.strictEqual(C.roleOf('BOTTOM'), 'ADC');
  assert.strictEqual(C.roleOf('UTILITY'), 'Support');
});

test('laneOpponent finds the enemy in the same position', () => {
  const me = C.participantFor(match, PUUIDS.OURS);
  const opp = C.laneOpponent(match, me);
  assert.strictEqual(opp.puuid, PUUIDS.OPP);
});

test('statAtMinute reads CS (lane+jungle) and gold from the frame', () => {
  const s = C.statAtMinute(timeline, 1, 10);
  assert.deepStrictEqual(s, { cs: 75, gold: 5000, xp: 6000 });
});

test('statAtMinute returns null when the game ended before that minute', () => {
  assert.strictEqual(C.statAtMinute(timeline, 1, 99), null);
});
