# Player Data Pipeline (Sub-project A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dependency-free Node pipeline + daily GitHub Action that pulls each player's Solo/Flex matches and per-minute timelines from the Riot API, computes per-stage stats, auto-detects 5-stack games, and commits one JSON file per player to the repo.

**Architecture:** Pure stat functions in `pipeline/compute.js` (unit-tested with `node:test`), a thin network client in `pipeline/riot.js` (native `fetch`, rate-limit aware), an orchestrator `pipeline/run.js`, and a scheduled GitHub Action that runs it with the Riot key from an Actions secret and commits the resulting `data/players/*.json`.

**Tech Stack:** Node.js v24 (native `fetch`, `node:test`, `node:assert`), no npm dependencies. CommonJS modules (`module.exports` / `require`) to match the existing `js/analysis-core.js` + `test/analysis-core.test.js` convention.

---

## File structure

| File | Responsibility |
|---|---|
| `package.json` | Minimal — defines `npm test` → `node --test test/`. No deps. (No `"type"` field, so CommonJS stays default and existing tests keep working.) |
| `pipeline/config.js` | Single source of truth: the 5 Riot IDs, region routing, queue IDs, history sizes |
| `pipeline/compute.js` | PURE functions: parse a match + timeline into a per-game record, classify 5-stacks, aggregate champ pool / role splits / form |
| `pipeline/riot.js` | Network I/O: typed wrappers over the Riot endpoints with 429 back-off |
| `pipeline/run.js` | Orchestrator: resolve PUUIDs → fetch new matches → compute → merge → write JSON |
| `pipeline/SETUP.md` | Click-by-click Riot key + GitHub secret guide (user deliverable) |
| `.github/workflows/refresh-data.yml` | Daily cron + manual run; runs `run.js` with the secret, commits changed JSON |
| `test/compute.test.js` | Unit tests for every `compute.js` function |
| `test/fixtures/match-sample.js` | A small, hand-built match + timeline fixture for the tests |
| `data/players/*.json` | Output — one per player (created by the first run, not by hand) |
| `README.md` | Add a short "Data pipeline" section + Riot attribution notice (ToS) |

**Output JSON shape** (refinement of the spec — game rows stored once with a `fiveStack` flag instead of duplicated across two lenses, which is DRY and smaller):
```jsonc
{
  "player": "Shabir",
  "puuid": "…",
  "generatedAt": "2026-06-08T04:00:00Z",
  "rank": { "solo": "Gold III", "flex": "Platinum II" },
  "games": [ { "matchId":"EUW1_…","queue":420,"champ":"Ahri","role":"Mid","win":true,
              "k":8,"d":4,"a":5,"kda":3.25,"csm":6.67,"kp":87,"vision":18,"dmgShare":0.63,
              "csAt10":75,"goldAt10":5000,"csDiff10":10,"goldDiff10":200,
              "csDiff14":18,"goldDiff14":100,"fiveStack":false,"date":1717800000000 } ],
  "soloFlex": { "champPool":[…], "roleSplits":[…], "form":["W","L"] },
  "fiveStack": { "champPool":[…], "roleSplits":[…], "form":["W"] }
}
```
`soloFlex` aggregates over all games; `fiveStack` aggregates over `games.filter(g => g.fiveStack)`.

---

## Task 1: Project scaffolding (package.json + config)

**Files:**
- Create: `package.json`
- Create: `pipeline/config.js`

- [ ] **Step 1: Create `package.json`** (no `"type"` field — keeps CommonJS default so existing tests still run)

```json
{
  "name": "clash-hq",
  "version": "1.0.0",
  "private": true,
  "description": "Clash HQ — team war room (static PWA) + Riot data pipeline",
  "scripts": {
    "test": "node --test test/"
  }
}
```

- [ ] **Step 2: Verify existing tests still pass under `npm test`**

Run: `npm test`
Expected: the existing `test/analysis-core.test.js` suite runs and PASSES (e.g. `# pass 6`).

- [ ] **Step 3: Create `pipeline/config.js`**

```js
// pipeline/config.js — single source of truth for the data pipeline.
module.exports = {
  regional: 'europe',        // Account-V1 + Match-V5 routing
  platform: 'euw1',          // League-V4 routing
  rankedQueues: [420, 440],  // 420 = Ranked Solo/Duo, 440 = Ranked Flex
  firstRunCount: 30,         // games per queue to pull when a player has no file yet
  incrementalCount: 20,      // recent ids to check each subsequent run
  windowCap: 60,             // max games retained per player file
  players: [
    { name: 'Shabir',   file: 'shabir.json',   gameName: 'TribuIation',    tagLine: 'EUW' },
    { name: 'Harendra', file: 'harendra.json', gameName: 'Merkedi',        tagLine: 'Neru' },
    { name: 'Steven',   file: 'steven.json',   gameName: 'OrionVII',       tagLine: 'EUW' },
    { name: 'Eshantha', file: 'eshantha.json', gameName: 'Quiet Rapture',  tagLine: 'SKT' },
    { name: 'Geeth',    file: 'geeth.json',    gameName: 'Synister',       tagLine: 'ezclp' }
  ]
};
```

- [ ] **Step 4: Commit**

```bash
git add package.json pipeline/config.js
git commit -m "chore: add package.json + data pipeline config

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Test fixture (a small match + timeline)

**Files:**
- Create: `test/fixtures/match-sample.js`

This fixture is the input for every `compute.js` test. Two players per team; "OURS" (mid) has a lane opponent "OPP" (also mid). Numbers are chosen so the expected stats are easy to verify.

- [ ] **Step 1: Create `test/fixtures/match-sample.js`**

```js
// Minimal but valid Match-V5 detail + timeline for unit tests.
// Team 100 = ours (OURS mid, MATE adc). Team 200 = enemy (OPP mid, OPP2 adc).
const PUUIDS = { OURS: 'puuid-ours', MATE: 'puuid-mate', OPP: 'puuid-opp', OPP2: 'puuid-opp2' };

const match = {
  metadata: { matchId: 'EUW1_TEST1' },
  info: {
    queueId: 420,
    gameCreation: 1717800000000,
    gameDuration: 1800, // 30:00
    participants: [
      { puuid: PUUIDS.OURS, participantId: 1, teamId: 100, teamPosition: 'MIDDLE',
        championName: 'Ahri', win: true, kills: 8, deaths: 4, assists: 5,
        totalMinionsKilled: 180, neutralMinionsKilled: 20, visionScore: 18,
        totalDamageDealtToChampions: 25000, goldEarned: 13000 },
      { puuid: PUUIDS.MATE, participantId: 2, teamId: 100, teamPosition: 'BOTTOM',
        championName: 'Jinx', win: true, kills: 7, deaths: 2, assists: 10,
        totalMinionsKilled: 220, neutralMinionsKilled: 0, visionScore: 12,
        totalDamageDealtToChampions: 15000, goldEarned: 14000 },
      { puuid: PUUIDS.OPP, participantId: 6, teamId: 200, teamPosition: 'MIDDLE',
        championName: 'Zed', win: false, kills: 3, deaths: 6, assists: 2,
        totalMinionsKilled: 170, neutralMinionsKilled: 0, visionScore: 14,
        totalDamageDealtToChampions: 18000, goldEarned: 11000 },
      { puuid: PUUIDS.OPP2, participantId: 7, teamId: 200, teamPosition: 'BOTTOM',
        championName: 'Ezreal', win: false, kills: 4, deaths: 5, assists: 3,
        totalMinionsKilled: 200, neutralMinionsKilled: 0, visionScore: 10,
        totalDamageDealtToChampions: 16000, goldEarned: 12000 }
    ]
  }
};

// Build 15 frames (indices 0..14). Only 10 and 14 carry the numbers the tests check.
function frame(idx, data) {
  return { timestamp: idx * 60000, participantFrames: data || {} };
}
const timeline = {
  info: {
    frames: Array.from({ length: 15 }, (_, i) => {
      if (i === 10) return frame(10, {
        '1': { minionsKilled: 70, jungleMinionsKilled: 5, totalGold: 5000, xp: 6000 },
        '6': { minionsKilled: 65, jungleMinionsKilled: 0, totalGold: 4800, xp: 5800 }
      });
      if (i === 14) return frame(14, {
        '1': { minionsKilled: 110, jungleMinionsKilled: 8, totalGold: 7000, xp: 9000 },
        '6': { minionsKilled: 100, jungleMinionsKilled: 0, totalGold: 6900, xp: 8800 }
      });
      return frame(i);
    })
  }
};

module.exports = { match, timeline, PUUIDS };
```

- [ ] **Step 2: Commit**

```bash
git add test/fixtures/match-sample.js
git commit -m "test: add Match-V5 fixture for compute tests

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `compute.js` — participant lookup, role mapping, lane opponent

**Files:**
- Create: `pipeline/compute.js`
- Create: `test/compute.test.js`

- [ ] **Step 1: Write failing tests**

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/compute.test.js`
Expected: FAIL — `Cannot find module '../pipeline/compute.js'`.

- [ ] **Step 3: Create `pipeline/compute.js` with the three functions**

```js
// pipeline/compute.js — pure, dependency-free stat functions (Node CommonJS).
const ROLE_MAP = { TOP: 'Top', JUNGLE: 'Jungle', MIDDLE: 'Mid', BOTTOM: 'ADC', UTILITY: 'Support' };

function participantFor(match, puuid) {
  return match.info.participants.find(p => p.puuid === puuid);
}
function roleOf(teamPosition) {
  return ROLE_MAP[teamPosition] || teamPosition || 'Unknown';
}
function laneOpponent(match, me) {
  return match.info.participants.find(
    p => p.teamId !== me.teamId && p.teamPosition === me.teamPosition
  ) || null;
}

module.exports = { participantFor, roleOf, laneOpponent };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/compute.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add pipeline/compute.js test/compute.test.js
git commit -m "feat: compute participant lookup, role map, lane opponent

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `compute.js` — `statAtMinute`

**Files:**
- Modify: `pipeline/compute.js`
- Modify: `test/compute.test.js`

- [ ] **Step 1: Add failing tests**

```js
test('statAtMinute reads CS (lane+jungle) and gold from the frame', () => {
  const s = C.statAtMinute(timeline, 1, 10);
  assert.deepStrictEqual(s, { cs: 75, gold: 5000, xp: 6000 });
});

test('statAtMinute returns null when the game ended before that minute', () => {
  assert.strictEqual(C.statAtMinute(timeline, 1, 99), null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/compute.test.js`
Expected: FAIL — `C.statAtMinute is not a function`.

- [ ] **Step 3: Implement `statAtMinute` and export it**

Add to `pipeline/compute.js` (and add `statAtMinute` to `module.exports`):

```js
function statAtMinute(timeline, participantId, minute) {
  const frame = timeline.info.frames[minute];
  if (!frame) return null;
  const pf = frame.participantFrames[String(participantId)];
  if (!pf) return null;
  return {
    cs: (pf.minionsKilled || 0) + (pf.jungleMinionsKilled || 0),
    gold: pf.totalGold || 0,
    xp: pf.xp || 0
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/compute.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add pipeline/compute.js test/compute.test.js
git commit -m "feat: compute statAtMinute from timeline frames

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: `compute.js` — `gameStats` (the per-game record)

**Files:**
- Modify: `pipeline/compute.js`
- Modify: `test/compute.test.js`

Expected values for the fixture (team-100 kills = 8+7 = 15; team-100 dmg = 25000+15000 = 40000):
- `kda` = (8+5)/4 = 3.25
- `csm` = (180+20) / (1800/60) = 200/30 = 6.6667 → rounded to 6.67
- `kp` = round((8+5)/15*100) = round(86.67) = 87
- `dmgShare` = round(25000/40000 * 100) / 100 = 0.63
- `csAt10` = 75, `goldAt10` = 5000
- `csDiff10` = 75 − 65 = 10, `goldDiff10` = 5000 − 4800 = 200
- `csDiff14` = 118 − 100 = 18, `goldDiff14` = 7000 − 6900 = 100

- [ ] **Step 1: Add failing test**

```js
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
  // A match where our player has a unique teamPosition (no enemy match-up).
  const solo = JSON.parse(JSON.stringify(match));
  solo.info.participants[2].teamPosition = 'TOP'; // move OPP off mid
  const r = C.gameStats(solo, timeline, PUUIDS.OURS);
  assert.strictEqual(r.csDiff10, null);
  assert.strictEqual(r.goldDiff10, null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/compute.test.js`
Expected: FAIL — `C.gameStats is not a function`.

- [ ] **Step 3: Implement `gameStats` and export it**

Add to `pipeline/compute.js` (add `gameStats` to `module.exports`):

```js
const round2 = n => Math.round(n * 100) / 100;

function gameStats(match, timeline, puuid) {
  const me = participantFor(match, puuid);
  const info = match.info;
  const mins = info.gameDuration / 60;
  const team = info.participants.filter(p => p.teamId === me.teamId);
  const teamKills = team.reduce((s, p) => s + p.kills, 0);
  const teamDmg = team.reduce((s, p) => s + p.totalDamageDealtToChampions, 0);
  const cs = (me.totalMinionsKilled || 0) + (me.neutralMinionsKilled || 0);

  const opp = laneOpponent(match, me);
  const me10 = statAtMinute(timeline, me.participantId, 10);
  const me14 = statAtMinute(timeline, me.participantId, 14);
  const op10 = opp ? statAtMinute(timeline, opp.participantId, 10) : null;
  const op14 = opp ? statAtMinute(timeline, opp.participantId, 14) : null;
  const diff = (a, b, key) => (a && b ? a[key] - b[key] : null);

  return {
    matchId: match.metadata.matchId,
    queue: info.queueId,
    champ: me.championName,
    role: roleOf(me.teamPosition),
    win: me.win,
    k: me.kills, d: me.deaths, a: me.assists,
    kda: round2((me.kills + me.assists) / Math.max(me.deaths, 1)),
    csm: round2(cs / mins),
    kp: teamKills ? Math.round((me.kills + me.assists) / teamKills * 100) : 0,
    vision: me.visionScore,
    dmgShare: teamDmg ? round2(me.totalDamageDealtToChampions / teamDmg) : 0,
    csAt10: me10 ? me10.cs : null,
    goldAt10: me10 ? me10.gold : null,
    csDiff10: diff(me10, op10, 'cs'),
    goldDiff10: diff(me10, op10, 'gold'),
    csDiff14: diff(me14, op14, 'cs'),
    goldDiff14: diff(me14, op14, 'gold'),
    fiveStack: false, // set later by run.js once all 5 PUUIDs are known
    date: info.gameCreation
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/compute.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add pipeline/compute.js test/compute.test.js
git commit -m "feat: compute full per-game record (gameStats)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: `compute.js` — `isFiveStack`

**Files:**
- Modify: `pipeline/compute.js`
- Modify: `test/compute.test.js`

- [ ] **Step 1: Add failing tests**

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/compute.test.js`
Expected: FAIL — `C.isFiveStack is not a function`.

- [ ] **Step 3: Implement `isFiveStack` and export it**

```js
function isFiveStack(match, rosterPuuids) {
  const ours = match.info.participants.filter(p => rosterPuuids.includes(p.puuid));
  if (ours.length < 5) return false;
  const teams = new Set(ours.map(p => p.teamId));
  return ours.length === 5 && teams.size === 1;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/compute.test.js`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add pipeline/compute.js test/compute.test.js
git commit -m "feat: compute isFiveStack roster detection

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: `compute.js` — aggregates (`aggregateChampPool`, `aggregateRoleSplits`, `form`)

**Files:**
- Modify: `pipeline/compute.js`
- Modify: `test/compute.test.js`

Game records are stored **newest-first**. Use this shared test input:

- [ ] **Step 1: Add failing tests**

```js
const GAMES = [ // newest-first
  { champ:'Ahri', role:'Mid', win:true,  kda:3.0, csm:7.0, csDiff10:10 },
  { champ:'Ahri', role:'Mid', win:false, kda:1.0, csm:6.0, csDiff10:-2 },
  { champ:'Zed',  role:'Mid', win:true,  kda:2.0, csm:8.0, csDiff10:5  }
];

test('aggregateChampPool groups, counts, averages and rounds', () => {
  const pool = C.aggregateChampPool(GAMES);
  const ahri = pool.find(c => c.champ === 'Ahri');
  assert.strictEqual(ahri.games, 2);
  assert.strictEqual(ahri.wr, 50);          // 1 of 2
  assert.strictEqual(ahri.kda, 2.0);        // (3+1)/2
  assert.strictEqual(ahri.csm, 6.5);        // (7+6)/2
  assert.strictEqual(ahri.csDiff10, 4);     // (10 + -2)/2
});

test('aggregateChampPool sorts by games descending', () => {
  const pool = C.aggregateChampPool(GAMES);
  assert.strictEqual(pool[0].champ, 'Ahri'); // 2 games before Zed's 1
});

test('aggregateRoleSplits groups by role with WR', () => {
  const roles = C.aggregateRoleSplits(GAMES);
  assert.deepStrictEqual(roles, [{ role:'Mid', games:3, wr:67 }]); // 2 of 3 = 66.7 -> 67
});

test('form returns most-recent-first W/L capped at n', () => {
  assert.deepStrictEqual(C.form(GAMES, 2), ['W', 'L']);
});

test('aggregateChampPool ignores null csDiff10 in the average', () => {
  const g = [{ champ:'X', role:'Mid', win:true, kda:1, csm:5, csDiff10:null },
             { champ:'X', role:'Mid', win:true, kda:1, csm:5, csDiff10:8 }];
  assert.strictEqual(C.aggregateChampPool(g)[0].csDiff10, 8); // only the non-null one
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/compute.test.js`
Expected: FAIL — `C.aggregateChampPool is not a function`.

- [ ] **Step 3: Implement the aggregates and export them**

```js
const avg = arr => arr.length ? arr.reduce((s, n) => s + n, 0) / arr.length : 0;

function aggregateChampPool(games) {
  const by = {};
  games.forEach(g => { (by[g.champ] = by[g.champ] || []).push(g); });
  return Object.entries(by).map(([champ, gs]) => {
    const diffs = gs.map(g => g.csDiff10).filter(v => v != null);
    return {
      champ,
      games: gs.length,
      wr: Math.round(gs.filter(g => g.win).length / gs.length * 100),
      kda: round2(avg(gs.map(g => g.kda))),
      csm: round2(avg(gs.map(g => g.csm))),
      csDiff10: diffs.length ? round2(avg(diffs)) : null
    };
  }).sort((a, b) => b.games - a.games);
}

function aggregateRoleSplits(games) {
  const by = {};
  games.forEach(g => { (by[g.role] = by[g.role] || []).push(g); });
  return Object.entries(by).map(([role, gs]) => ({
    role,
    games: gs.length,
    wr: Math.round(gs.filter(g => g.win).length / gs.length * 100)
  })).sort((a, b) => b.games - a.games);
}

function form(games, n) {
  return games.slice(0, n).map(g => (g.win ? 'W' : 'L'));
}
```

Add `aggregateChampPool`, `aggregateRoleSplits`, `form` to `module.exports`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/compute.test.js`
Expected: PASS (15 tests).

- [ ] **Step 5: Run the full suite (no regressions)**

Run: `npm test`
Expected: both `analysis-core.test.js` and `compute.test.js` PASS.

- [ ] **Step 6: Commit**

```bash
git add pipeline/compute.js test/compute.test.js
git commit -m "feat: compute champ pool / role split / form aggregates

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: `pipeline/riot.js` — Riot API client

**Files:**
- Create: `pipeline/riot.js`

Network I/O — not unit-tested. Verified in Task 11 with a real dev key. Uses native `fetch` (Node 18+).

- [ ] **Step 1: Create `pipeline/riot.js`**

```js
// pipeline/riot.js — thin Riot API client. Native fetch, 429-aware. No deps.
const { regional, platform } = require('./config.js');

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Generic GET with retry on 429 (respects Retry-After) and a 1.2s base throttle.
async function get(host, path, key, attempt = 0) {
  const res = await fetch(`https://${host}.api.riotgames.com${path}`, {
    headers: { 'X-Riot-Token': key }
  });
  if (res.status === 429 && attempt < 4) {
    const wait = (Number(res.headers.get('retry-after')) || 5) * 1000;
    console.warn(`  429 rate-limited, waiting ${wait}ms…`);
    await sleep(wait);
    return get(host, path, key, attempt + 1);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Riot ${res.status} on ${path} :: ${body.slice(0, 160)}`);
  }
  await sleep(1200); // stay well under 20 req/s + 100 req/2min dev limits
  return res.json();
}

async function getAccountByRiotId(gameName, tagLine, key) {
  const enc = s => encodeURIComponent(s);
  return get(regional, `/riot/account/v1/accounts/by-riot-id/${enc(gameName)}/${enc(tagLine)}`, key);
}

async function getRankByPuuid(puuid, key) {
  const entries = await get(platform, `/lol/league/v4/entries/by-puuid/${puuid}`, key);
  const find = q => entries.find(e => e.queueType === q);
  const fmt = e => (e ? `${cap(e.tier)} ${e.rank}` : null);
  return { solo: fmt(find('RANKED_SOLO_5x5')), flex: fmt(find('RANKED_FLEX_SR')) };
}
const cap = s => s ? s[0] + s.slice(1).toLowerCase() : s;

async function getMatchIds(puuid, queue, count, key) {
  return get(regional, `/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=${queue}&count=${count}`, key);
}

async function getMatch(matchId, key) {
  return get(regional, `/lol/match/v5/matches/${matchId}`, key);
}

async function getTimeline(matchId, key) {
  return get(regional, `/lol/match/v5/matches/${matchId}/timeline`, key);
}

module.exports = { getAccountByRiotId, getRankByPuuid, getMatchIds, getMatch, getTimeline };
```

- [ ] **Step 2: Sanity-check the file parses**

Run: `node -e "require('./pipeline/riot.js'); console.log('riot.js OK')"`
Expected: prints `riot.js OK` (no syntax errors).

- [ ] **Step 3: Commit**

```bash
git add pipeline/riot.js
git commit -m "feat: add Riot API client (account, rank, matches, timeline)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: `pipeline/run.js` — orchestrator

**Files:**
- Create: `pipeline/run.js`

- [ ] **Step 1: Create `pipeline/run.js`**

```js
// pipeline/run.js — resolve PUUIDs, fetch new matches, compute, merge, write JSON.
const fs = require('fs');
const path = require('path');
const cfg = require('./config.js');
const riot = require('./riot.js');
const C = require('./compute.js');

const OUT_DIR = path.join(__dirname, '..', 'data', 'players');

function loadExisting(file) {
  const p = path.join(OUT_DIR, file);
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function buildLenses(games) {
  const lens = gs => ({
    champPool: C.aggregateChampPool(gs),
    roleSplits: C.aggregateRoleSplits(gs),
    form: C.form(gs, 10)
  });
  return { soloFlex: lens(games), fiveStack: lens(games.filter(g => g.fiveStack)) };
}

async function main() {
  const key = process.env.RIOT_API_KEY;
  if (!key) { console.error('FATAL: RIOT_API_KEY env var is not set.'); process.exit(1); }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Pass 1 — resolve every PUUID (from cache when possible).
  const state = {};
  for (const pl of cfg.players) {
    const existing = loadExisting(pl.file);
    let puuid = existing && existing.puuid;
    if (!puuid) {
      const acct = await riot.getAccountByRiotId(pl.gameName, pl.tagLine, key);
      puuid = acct.puuid;
    }
    state[pl.name] = { pl, existing: existing || { games: [] }, puuid };
  }
  const rosterPuuids = cfg.players.map(p => state[p.name].puuid);

  // Pass 2 — fetch + compute + write, isolating failures per player.
  for (const pl of cfg.players) {
    const s = state[pl.name];
    try {
      const rank = await riot.getRankByPuuid(s.puuid, key);
      const haveIds = new Set(s.existing.games.map(g => g.matchId));
      const count = s.existing.games.length ? cfg.incrementalCount : cfg.firstRunCount;

      let ids = [];
      for (const q of cfg.rankedQueues) {
        ids = ids.concat(await riot.getMatchIds(s.puuid, q, count, key));
      }
      const newIds = [...new Set(ids)].filter(id => !haveIds.has(id));

      const fresh = [];
      for (const id of newIds) {
        const match = await riot.getMatch(id, key);
        const timeline = await riot.getTimeline(id, key);
        const rec = C.gameStats(match, timeline, s.puuid);
        rec.fiveStack = C.isFiveStack(match, rosterPuuids);
        fresh.push(rec);
      }

      const merged = [...fresh, ...s.existing.games]
        .sort((a, b) => b.date - a.date)
        .slice(0, cfg.windowCap);

      const out = {
        player: pl.name,
        puuid: s.puuid,
        generatedAt: new Date().toISOString(),
        rank,
        games: merged,
        ...buildLenses(merged)
      };
      fs.writeFileSync(path.join(OUT_DIR, pl.file), JSON.stringify(out, null, 2));
      console.log(`✓ ${pl.name}: +${fresh.length} new, ${merged.length} total`);
    } catch (e) {
      console.error(`✗ ${pl.name}: ${e.message}`); // skip, keep going
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Sanity-check the file parses and fails cleanly without a key**

Run (PowerShell): `node pipeline/run.js`
Expected: prints `FATAL: RIOT_API_KEY env var is not set.` and exits (no stack trace).

- [ ] **Step 3: Commit**

```bash
git add pipeline/run.js
git commit -m "feat: add pipeline orchestrator (resolve, fetch, compute, write)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: GitHub Action — daily refresh

**Files:**
- Create: `.github/workflows/refresh-data.yml`

- [ ] **Step 1: Create `.github/workflows/refresh-data.yml`**

```yaml
name: Refresh player data

on:
  schedule:
    - cron: '0 4 * * *'   # daily 04:00 UTC
  workflow_dispatch:        # manual "Run workflow" button

permissions:
  contents: write           # allow the action to commit data

jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Run pipeline
        env:
          RIOT_API_KEY: ${{ secrets.RIOT_API_KEY }}
        run: node pipeline/run.js
      - name: Commit updated data
        run: |
          git config user.name "clash-hq-bot"
          git config user.email "actions@github.com"
          git add data/players
          if git diff --staged --quiet; then
            echo "No data changes."
          else
            git commit -m "data: refresh player profiles [skip ci]"
            git push
          fi
```

- [ ] **Step 2: Validate YAML parses**

Run: `node -e "const fs=require('fs');fs.readFileSync('.github/workflows/refresh-data.yml','utf8');console.log('yaml present')"`
Expected: prints `yaml present` (basic existence/read check; full validation happens when GitHub runs it).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/refresh-data.yml
git commit -m "ci: daily GitHub Action to refresh player data

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11: Live end-to-end verification (maintainer, dev key)

**Files:** none (verification + first data commit)

This is the one step that needs a Riot key. Run by a maintainer locally; produces the first real `data/players/*.json`.

- [ ] **Step 1: Get a dev key** — sign in at https://developer.riotgames.com, copy the "Development API Key" (valid 24h).

- [ ] **Step 2: Run the pipeline against the real API** (PowerShell)

Run: `$env:RIOT_API_KEY="RGAPI-xxxxxxxx"; node pipeline/run.js`
Expected: five `✓ <name>: +N new, N total` lines (first run pulls ~30–60 games each; takes a few minutes due to throttling). No `✗` lines. If a `✗` appears, read the message (401 = bad/expired key; 404 on account = wrong Riot ID).

- [ ] **Step 3: Spot-check one output file**

Run: `node -e "const j=require('./data/players/geeth.json');console.log(j.rank, j.games.length, j.games[0].champ, j.games[0].csDiff10)"`
Expected: a rank object, a game count > 0, a champ name, and a numeric (or null) csDiff10 — confirming timeline parsing worked.

- [ ] **Step 4: Commit the first real data**

```bash
git add data/players
git commit -m "data: first Riot pipeline pull (all 5 players)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 12: `SETUP.md` + README pipeline section + Riot attribution

**Files:**
- Create: `pipeline/SETUP.md`
- Modify: `README.md`

- [ ] **Step 1: Create `pipeline/SETUP.md`** (the user-facing, click-by-click guide)

```markdown
# Setting up the Riot data pipeline

This makes Clash HQ refresh everyone's stats automatically once a day. You do
this **once**. ~10 minutes.

## 1. Get a Riot API key
1. Go to https://developer.riotgames.com and sign in with your Riot account.
2. On the dashboard you'll see a **Development API Key** (starts with `RGAPI-`).
   - This one **expires every 24 hours** — fine for a first test.
3. For the daily automation to keep working, click **"Register Product" →
   "Personal API Key"**, fill in the short form (name it "Clash HQ", describe it
   as a private team stats tool, use the GitHub Pages URL). Approval is usually a
   few days. The Personal key does **not** expire daily.

## 2. Add the key to GitHub (so the robot can use it secretly)
1. Open the repo on GitHub → **Settings** (top tab).
2. Left sidebar: **Secrets and variables → Actions**.
3. Click **New repository secret**.
4. **Name:** `RIOT_API_KEY`  **Secret:** paste your `RGAPI-…` key. **Add secret**.
   - The key is encrypted. It is never shown in the website or the code.

## 3. Turn it on / test it
1. Repo → **Actions** tab → **Refresh player data** (left).
2. Click **Run workflow → Run workflow**.
3. Wait ~2–3 minutes. A green check means it worked and your stats were committed.
4. It now also runs by itself every day at 04:00 UTC.

## If something breaks
- **Run shows 401 / Unauthorized:** the key expired (dev key) or is wrong.
  Get a fresh key and update the `RIOT_API_KEY` secret (step 2). Switch to a
  Personal key to stop this happening daily.
- **One player shows ✗ 404:** their Riot ID changed — update it in
  `pipeline/config.js`.

## Running it on your own computer (optional)
Install Node 18+ then, in PowerShell, from the project folder:
```powershell
$env:RIOT_API_KEY="RGAPI-your-key-here"
node pipeline/run.js
```
```

- [ ] **Step 2: Add a "Data pipeline" section + Riot attribution to `README.md`**

Append to `README.md`:

```markdown
## Data pipeline

Player profiles are powered by `pipeline/` — a dependency-free Node script that
pulls each player's ranked matches + timelines from the Riot API, computes
per-stage stats, and writes `data/players/*.json`. A daily GitHub Action
(`.github/workflows/refresh-data.yml`) runs it with the `RIOT_API_KEY` secret.
First-time setup: see `pipeline/SETUP.md`. Run the tests with `npm test`.

Clash HQ isn't endorsed by Riot Games and doesn't reflect the views or opinions
of Riot Games or anyone officially involved in producing or managing Riot Games
properties. Riot Games and all associated properties are trademarks or
registered trademarks of Riot Games, Inc.
```

- [ ] **Step 3: Commit**

```bash
git add pipeline/SETUP.md README.md
git commit -m "docs: add pipeline SETUP guide + Riot attribution

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Done — definition of complete

- `npm test` passes (existing analysis-core tests + 15 new compute tests).
- `node pipeline/run.js` with a real key writes five `data/players/*.json` files containing rank, per-game records with per-stage diffs, and both `soloFlex` + `fiveStack` aggregates.
- The GitHub Action exists, runs on cron + manual dispatch, and commits changed data.
- `pipeline/SETUP.md` lets a non-technical user wire up the key.
- **Next sub-project:** B (Profile UI) reads these JSON files into a new Profiles tab.
```
