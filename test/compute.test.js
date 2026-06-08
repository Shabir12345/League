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

test('gameStats builds a full per-game record', () => {
  const r = C.gameStats(match, timeline, PUUIDS.OURS);
  assert.strictEqual(r.matchId, 'EUW1_TEST1');
  assert.strictEqual(r.queue, 420);
  assert.strictEqual(r.champ, 'Ahri');
  assert.strictEqual(r.role, 'Mid');
  assert.strictEqual(r.win, true);
  assert.deepStrictEqual([r.k, r.d, r.a], [8, 4, 5]);
  assert.strictEqual(r.kda, 3.25);
  assert.strictEqual(r.csm, 6.67);
  assert.strictEqual(r.kp, 87);
  assert.strictEqual(r.vision, 18);
  assert.strictEqual(r.dmgShare, 0.63);
  assert.strictEqual(r.csAt10, 75);
  assert.strictEqual(r.goldAt10, 5000);
  assert.strictEqual(r.csDiff10, 10);
  assert.strictEqual(r.goldDiff10, 200);
  assert.strictEqual(r.csDiff14, 18);
  assert.strictEqual(r.goldDiff14, 100);
  assert.strictEqual(r.date, 1717800000000);
});

test('gameStats sets lane-diff fields to null when no lane opponent', () => {
  const solo = JSON.parse(JSON.stringify(match));
  solo.info.participants[2].teamPosition = 'TOP'; // move OPP off mid
  const r = C.gameStats(solo, timeline, PUUIDS.OURS);
  assert.strictEqual(r.csDiff10, null);
  assert.strictEqual(r.goldDiff10, null);
});

test('isFiveStack true when all five puuids share one team', () => {
  const five = JSON.parse(JSON.stringify(match));
  const ids = ['a', 'b', 'c', 'd', 'e'];
  five.info.participants = ids.map((puuid, i) => ({
    puuid, participantId: i + 1, teamId: 100, teamPosition: 'TOP',
    championName: 'X', win: true, kills: 1, deaths: 1, assists: 1,
    totalMinionsKilled: 1, neutralMinionsKilled: 0, visionScore: 1,
    totalDamageDealtToChampions: 1, goldEarned: 1
  }));
  assert.strictEqual(C.isFiveStack(five, ids), true);
});

test('isFiveStack false when the five are split across teams', () => {
  const split = JSON.parse(JSON.stringify(match));
  const ids = ['a', 'b', 'c', 'd', 'e'];
  split.info.participants = ids.map((puuid, i) => ({
    puuid, participantId: i + 1, teamId: i < 4 ? 100 : 200, teamPosition: 'TOP',
    championName: 'X', win: true, kills: 1, deaths: 1, assists: 1,
    totalMinionsKilled: 1, neutralMinionsKilled: 0, visionScore: 1,
    totalDamageDealtToChampions: 1, goldEarned: 1
  }));
  assert.strictEqual(C.isFiveStack(split, ids), false);
});

test('isFiveStack false when fewer than five roster members are present', () => {
  assert.strictEqual(C.isFiveStack(match, [PUUIDS.OURS, PUUIDS.MATE]), false);
});
