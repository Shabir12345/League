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

const GAMES = [ // newest-first
  { champ:'Ahri', role:'Mid', win:true,  kda:3.0, csm:7.0, csDiff10:10 },
  { champ:'Ahri', role:'Mid', win:false, kda:1.0, csm:6.0, csDiff10:-2 },
  { champ:'Zed',  role:'Mid', win:true,  kda:2.0, csm:8.0, csDiff10:5  }
];

test('aggregateChampPool groups, counts, averages and rounds', () => {
  const pool = C.aggregateChampPool(GAMES);
  const ahri = pool.find(c => c.champ === 'Ahri');
  assert.strictEqual(ahri.games, 2);
  assert.strictEqual(ahri.wr, 50);
  assert.strictEqual(ahri.kda, 2.0);
  assert.strictEqual(ahri.csm, 6.5);
  assert.strictEqual(ahri.csDiff10, 4);
});

test('aggregateChampPool sorts by games descending', () => {
  const pool = C.aggregateChampPool(GAMES);
  assert.strictEqual(pool[0].champ, 'Ahri');
});

test('aggregateRoleSplits groups by role with WR', () => {
  const roles = C.aggregateRoleSplits(GAMES);
  assert.deepStrictEqual(roles, [{ role:'Mid', games:3, wr:67 }]);
});

test('form returns most-recent-first W/L capped at n', () => {
  assert.deepStrictEqual(C.form(GAMES, 2), ['W', 'L']);
});

test('aggregateChampPool ignores null csDiff10 in the average', () => {
  const g = [{ champ:'X', role:'Mid', win:true, kda:1, csm:5, csDiff10:null },
             { champ:'X', role:'Mid', win:true, kda:1, csm:5, csDiff10:8 }];
  assert.strictEqual(C.aggregateChampPool(g)[0].csDiff10, 8);
});

// — hardening against real (non-fixture) Riot data —

test('gameStats throws when the puuid is not in the match', () => {
  assert.throws(() => C.gameStats(match, timeline, 'nobody'), /not in match/);
});

test('gameStats does not produce Infinity csm for a remade (0-duration) game', () => {
  const remade = JSON.parse(JSON.stringify(match));
  remade.info.gameDuration = 0;
  const r = C.gameStats(remade, timeline, PUUIDS.OURS);
  assert.ok(Number.isFinite(r.csm));
});

test('gameStats defaults vision to 0 when visionScore is missing', () => {
  const noVision = JSON.parse(JSON.stringify(match));
  delete noVision.info.participants[0].visionScore;
  const r = C.gameStats(noVision, timeline, PUUIDS.OURS);
  assert.strictEqual(r.vision, 0);
});

test('form handles an empty array and n=0', () => {
  assert.deepStrictEqual(C.form([], 5), []);
  assert.deepStrictEqual(C.form(GAMES, 0), []);
});
