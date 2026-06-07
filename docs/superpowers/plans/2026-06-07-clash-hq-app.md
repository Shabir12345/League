# Clash HQ — App + Daily Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single-file Clash HQ into an installable, online PWA with a daily Analysis tab that tracks results and tells the team what to focus on.

**Architecture:** Static site (no backend). Refactor `index.html` into `css/` + `js/` + `data/` files (data as plain-global JS so there's no fetch/CORS and edits are clean). Pure data-logic lives in `js/analysis-core.js` (browser global + Node module) and is unit-tested with `node --test`. Rendering is manually verified in a browser. Ships as a PWA on GitHub Pages.

**Tech Stack:** Vanilla HTML/CSS/JS, no framework, no build step. `node --test` for logic tests. Service worker + web manifest for PWA. GitHub Pages for hosting.

---

## File structure (target)

```
index.html              # shell: head, header, nav, empty .view containers, <script> tags
css/styles.css          # all styles (moved verbatim from current <style>)
js/analysis-core.js     # PURE functions: records, verdicts, winrate, form, player-form (tested)
js/app.js               # nav/view switching, countdown, SW registration
js/render.js            # render functions for every view (reads data globals → DOM)
data/roster.js          # PLAYERS, SEATS
data/comps.js           # COMPS (data-driven + proposed candidates)
data/meta.js            # TIERS, PHASES, GLOSSARY, GAMEPLAN_DO/DONT, JOBS, PLAIN
data/analysis.js        # DAILY_LOG, FOCUS   ← edited daily
manifest.webmanifest
sw.js
icons/icon-192.png, icon-512.png, icon-maskable-512.png
test/analysis-core.test.js
```

A local static server is needed because the service worker only runs over http/https (not `file://`). Use: `npx serve .` or `python -m http.server 8000`. The app itself (without SW) also works from `file://` because data is plain globals, not fetched.

---

## Task 1: Extract CSS into its own file (no behavior change)

**Files:**
- Create: `css/styles.css`
- Modify: `index.html` (remove inline `<style>`, add `<link>`)

- [ ] **Step 1: Create the stylesheet from the current inline styles**

Copy the entire contents **between** `<style>` and `</style>` in `index.html` (current lines 10–324) verbatim into `css/styles.css`. Do not edit any rule.

- [ ] **Step 2: Replace the inline block with a link**

In `index.html` `<head>`, delete the `<style>…</style>` block and insert in its place:

```html
<link rel="stylesheet" href="css/styles.css">
```

- [ ] **Step 3: Verify in browser**

Run: `npx serve .` then open the served URL.
Expected: page looks identical to before (all tabs, panels, countdown render unchanged).

- [ ] **Step 4: Commit**

```bash
git add css/styles.css index.html
git commit -m "refactor: extract styles into css/styles.css"
```

---

## Task 2: Split data and logic out of the inline `<script>`

The current `<script>` (lines 479–773) mixes data + render + behavior. Split it into data files, a render file, an app file, with **no logic changes**.

**Files:**
- Create: `data/roster.js`, `data/comps.js`, `data/meta.js`, `data/analysis.js`, `js/render.js`, `js/app.js`
- Modify: `index.html` (replace inline `<script>` with ordered `<script src>` tags)

- [ ] **Step 1: Create `data/roster.js`**

Move these declarations verbatim from the current script: `ROLE_C`, `API`, `PLAYERS`, `SEATS`, `ORDER5`. Keep them as top-level `const`s (they become globals).

- [ ] **Step 2: Create `data/comps.js`**

Move `COMPS` and `PLAIN` verbatim. Then **add two fields to every COMPS entry**: `source:'claude'` and `status:'core'`. Example for the first entry:

```js
{id:'A',name:'Wombo',tag:'Hard-Engage Teamfight',tier:'PRIMARY',color:'#c8aa6e',
 source:'claude',status:'core',
 roles:[/* unchanged */], win:'…', spike:'…', lose:'…'}
```

- [ ] **Step 3: Create `data/meta.js`**

Move `TIERS`, `PHASES`, `GAMEPLAN_DO`, `GAMEPLAN_DONT`, `JOBS`, `GLOSSARY` verbatim.

- [ ] **Step 4: Create `data/analysis.js` with empty seeds for now**

```js
const DAILY_LOG = [];
const FOCUS = [];
```

- [ ] **Step 5: Create `js/render.js`**

Move all rendering + the helper functions `el`, `ico`, `icoURL`, `wrColor`, and the Draft Lab block, the Prep block (`renderPhases`, `store`, `safe`, `LS`, `done`), lineup/roster/comps/meta/start-here renders. Keep them verbatim. (These currently run at load; keep that.)

- [ ] **Step 6: Create `js/app.js`**

Move `showView`, the tab wiring, and the countdown (`TARGET`, `tick`, `setInterval`). Keep verbatim.

- [ ] **Step 7: Replace inline script with ordered tags**

In `index.html`, delete the inline `<script>…</script>` and add before `</body>`, in this order (data → core → render → app):

```html
<script src="data/roster.js"></script>
<script src="data/comps.js"></script>
<script src="data/meta.js"></script>
<script src="data/analysis.js"></script>
<script src="js/analysis-core.js"></script>
<script src="js/render.js"></script>
<script src="js/app.js"></script>
```

(`js/analysis-core.js` is created in Task 3; add the tag now — a 404 is harmless until then, or create an empty file.)

- [ ] **Step 8: Verify in browser**

Run: `npx serve .` and open it.
Expected: every tab works exactly as before — roster expands, Draft Lab bans recalc, Prep checkboxes persist, countdown ticks. Check the console for zero errors.

- [ ] **Step 9: Commit**

```bash
git add index.html data js
git commit -m "refactor: split script into data/render/app modules"
```

---

## Task 3: Pure analysis-core logic (TDD with node --test)

**Files:**
- Create: `js/analysis-core.js`
- Test: `test/analysis-core.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// test/analysis-core.test.js
const test = require('node:test');
const assert = require('node:assert');
const C = require('../js/analysis-core.js');

const LOG = [
  { date:'2026-06-06', games:[
    { result:'L', comp:'wombo', lineup:[{role:'ADC',player:'Shabir',champ:'Caitlyn',k:10,d:7,a:5,csm:8.1,kp:47}] },
    { result:'W', comp:'control', lineup:[{role:'ADC',player:'Shabir',champ:'Caitlyn',k:14,d:5,a:14,csm:7.4,kp:61}] },
    { result:'L', comp:'ftb', lineup:[{role:'ADC',player:'Shabir',champ:'Caitlyn',k:4,d:7,a:3,csm:6.0,kp:64}] }
  ]}
];

test('overallRecord counts wins and losses', () => {
  assert.deepStrictEqual(C.overallRecord(LOG), { w:1, l:2, games:3, winrate:1/3 });
});

test('compRecords groups by comp id', () => {
  const r = C.compRecords(LOG);
  assert.deepStrictEqual(r.wombo, { w:0, l:1 });
  assert.deepStrictEqual(r.control, { w:1, l:0 });
});

test('verdictFor applies thresholds', () => {
  assert.strictEqual(C.verdictFor({ w:0, l:0 }), 'Untested');
  assert.strictEqual(C.verdictFor({ w:3, l:0 }), 'Proven');         // 3+ games, >=60%
  assert.strictEqual(C.verdictFor({ w:0, l:3 }), 'Underperforming');// 3+ games, <40%
  assert.strictEqual(C.verdictFor({ w:1, l:1 }), 'Testing');        // <3 games
});

test('formGuide returns most-recent-first W/L', () => {
  assert.deepStrictEqual(C.formGuide(LOG, 3), ['L','W','L']);
});

test('playerForm returns latest and trend for a player', () => {
  const pf = C.playerForm(LOG, 'Shabir');
  assert.strictEqual(pf.latest.champ, 'Caitlyn');
  assert.strictEqual(pf.latest.kda, (4+3)/7);            // (k+a)/max(d,1)
  assert.ok(pf.trend === 'down');                        // 1.0 KDA < prior 5.6
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test`
Expected: FAIL — `Cannot find module '../js/analysis-core.js'`.

- [ ] **Step 3: Implement `js/analysis-core.js`**

```js
// Pure, dependency-free. Works as a browser global AND a Node module.
(function (root) {
  const flatGames = log => log.flatMap(d => d.games.map(g => ({ ...g, date: d.date })));

  function overallRecord(log) {
    const g = flatGames(log);
    const w = g.filter(x => x.result === 'W').length;
    const l = g.filter(x => x.result === 'L').length;
    const games = w + l;
    return { w, l, games, winrate: games ? w / games : 0 };
  }

  function compRecords(log) {
    const out = {};
    flatGames(log).forEach(x => {
      const r = (out[x.comp] = out[x.comp] || { w: 0, l: 0 });
      if (x.result === 'W') r.w++; else if (x.result === 'L') r.l++;
    });
    return out;
  }

  function verdictFor(rec) {
    const w = rec ? rec.w : 0, l = rec ? rec.l : 0, n = w + l;
    if (n === 0) return 'Untested';
    if (n < 3) return 'Testing';
    const wr = w / n;
    if (wr >= 0.6) return 'Proven';
    if (wr < 0.4) return 'Underperforming';
    return 'Testing';
  }

  function formGuide(log, n) {
    return flatGames(log).map(x => x.result).reverse().slice(0, n);
  }

  function dayRecords(log) {
    return log.map(d => ({
      date: d.date,
      w: d.games.filter(g => g.result === 'W').length,
      l: d.games.filter(g => g.result === 'L').length
    }));
  }

  const kdaOf = r => (r.k + r.a) / Math.max(r.d, 1);

  function playerForm(log, player) {
    const outings = flatGames(log)
      .map(g => ({ g, row: g.lineup.find(p => p.player === player) }))
      .filter(x => x.row)
      .map(x => ({ ...x.row, result: x.g.result, date: x.g.date }));
    if (!outings.length) return null;
    const latest = outings[outings.length - 1];
    const prior = outings.length > 1 ? outings[outings.length - 2] : null;
    const lk = kdaOf(latest);
    const trend = !prior ? 'flat' : lk > kdaOf(prior) + 0.2 ? 'up'
                : lk < kdaOf(prior) - 0.2 ? 'down' : 'flat';
    return { latest: { ...latest, kda: lk }, prior, trend, count: outings.length };
  }

  const api = { overallRecord, compRecords, verdictFor, formGuide, dayRecords, playerForm, kdaOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);   // expose as globals in the browser
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test`
Expected: PASS — 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add js/analysis-core.js test/analysis-core.test.js
git commit -m "feat: add tested analysis-core data logic"
```

---

## Task 4: Seed June 6 data + Focus list

**Files:**
- Modify: `data/analysis.js`

- [ ] **Step 1: Pull exact per-player KDAs for the 3 June-6 Flex games**

Use Playwright MCP on the five dpm.lol profiles (see `memory/clash-data-source.md`). For each card, the page owner's stat is the card's `K/D/A · CS/m · KP` text; the owner's champ is the champ immediately before its summoner-spell icons. Games to fill (durations are the join key): `32:34` (L), `33:48` (W), `24:26` (L). Confirmed lineups:
- 32:34 L: Malphite(Harendra) / Wukong(Geeth) / Annie(Steven) / Caitlyn(Shabir) / Rell(Eshantha)
- 33:48 W: Shen(Harendra) / Viego(Geeth) / Orianna(Steven) / Caitlyn(Shabir) / Rell(Eshantha)
- 24:26 L: Sion(Harendra) / Viego(Geeth) / Orianna(Steven) / Caitlyn(Shabir) / Alistar(Eshantha)

Known already: Shabir — 10/7/5 (8.1cs 47kp), 14/5/14 (7.4cs 61kp), 4/7/3 (6.0cs 64kp). Harendra — 8/6/4, 5/5/12, 1/7/3.

- [ ] **Step 2: Write the seed into `data/analysis.js`**

Replace the empty seeds with (fill the `k/d/a/csm/kp` you pulled in Step 1; the structure and known values are shown):

```js
const DAILY_LOG = [
  {
    date: '2026-06-06',
    headline: '1–2 on comp tests. The one win was the grouped Viego/Orianna/Caitlyn fight (61% KP); both losses came from low KP / losing early.',
    games: [
      { dur:'32:34', queue:'Flex', result:'L', comp:'wombo', note:'Low team KP (38–47%) — fought spread out, engage never connected.',
        lineup:[
          {role:'Top',player:'Harendra',champ:'Malphite',k:8,d:6,a:4,csm:6.0,kp:38},
          {role:'Jungle',player:'Geeth',champ:'Wukong',k:0,d:0,a:0,csm:0,kp:0},
          {role:'Mid',player:'Steven',champ:'Annie',k:0,d:0,a:0,csm:0,kp:0},
          {role:'ADC',player:'Shabir',champ:'Caitlyn',k:10,d:7,a:5,csm:8.1,kp:47},
          {role:'Support',player:'Eshantha',champ:'Rell',k:0,d:0,a:0,csm:0,kp:0}
        ]},
      { dur:'33:48', queue:'Flex', result:'W', comp:'control', note:'Grouped 5-man teamfights, three fed carries, 61% KP. Shen top + Rell engage.',
        lineup:[
          {role:'Top',player:'Harendra',champ:'Shen',k:5,d:5,a:12,csm:0,kp:0},
          {role:'Jungle',player:'Geeth',champ:'Viego',k:0,d:0,a:0,csm:0,kp:0},
          {role:'Mid',player:'Steven',champ:'Orianna',k:0,d:0,a:0,csm:0,kp:0},
          {role:'ADC',player:'Shabir',champ:'Caitlyn',k:14,d:5,a:14,csm:7.4,kp:61},
          {role:'Support',player:'Eshantha',champ:'Rell',k:0,d:0,a:0,csm:0,kp:0}
        ]},
      { dur:'24:26', queue:'Flex', result:'L', comp:'ftb', note:'24-min stomp — lost early, scaling teamfight comp never came online.',
        lineup:[
          {role:'Top',player:'Harendra',champ:'Sion',k:1,d:7,a:3,csm:0,kp:0},
          {role:'Jungle',player:'Geeth',champ:'Viego',k:0,d:0,a:0,csm:0,kp:0},
          {role:'Mid',player:'Steven',champ:'Orianna',k:0,d:0,a:0,csm:0,kp:0},
          {role:'ADC',player:'Shabir',champ:'Caitlyn',k:4,d:7,a:3,csm:6.0,kp:64},
          {role:'Support',player:'Eshantha',champ:'Alistar',k:0,d:0,a:0,csm:0,kp:0}
        ]}
    ]
  }
];

const FOCUS = [
  { id:'kp', priority:1, status:'open', title:'Group by ~14 min and fight as 5',
    why:'Both losses had low kill participation; the win had 61% KP.' },
  { id:'early', priority:2, status:'open', title:'Stabilise the early game',
    why:'The 24-min loss was decided before the teamfight spike — don’t fall behind pre-14.' },
  { id:'engagesup', priority:3, status:'open', title:'Default to Rell over Alistar as primary engage',
    why:'The win ran Rell; the harder loss ran Alistar and the early game wasn’t rescued.' },
  { id:'mid', priority:4, status:'open', title:'Prefer Orianna over Annie mid',
    why:'Orianna was on the winning side; Shockwave is a more reliable teamfight button for us.' }
];
```

The `comp` ids (`wombo`,`control`,`ftb`) are wired to COMPS in Task 6.

- [ ] **Step 3: Verify it loads**

Run: `npx serve .`, open console, type `DAILY_LOG.length` → `1`, `overallRecord(DAILY_LOG)` → `{w:1,l:2,games:3,winrate:0.33…}`.
Expected: no errors, correct values.

- [ ] **Step 4: Commit**

```bash
git add data/analysis.js
git commit -m "feat: seed June 6 comp-test results and focus list"
```

---

## Task 5: Analysis tab — nav, view container, and rendering

**Files:**
- Modify: `index.html` (nav button + `<section>`), `css/styles.css` (small additions), `js/render.js` (render functions)

- [ ] **Step 1: Add the nav button and the view container**

In `index.html` `<nav id="nav">`, insert after the War Room tab:

```html
<button class="tab" data-v="analysis">📊 Analysis</button>
```

After the War Room `<section>`, add:

```html
<!-- ANALYSIS -->
<section class="view" id="analysis">
  <div id="anBriefing"></div>
  <div class="sec-title" style="margin-top:26px">Form &amp; Winrate <span class="n">// 5-stack games</span></div>
  <div class="panel" id="anForm" style="margin-bottom:8px"></div>
  <div class="sec-title" style="margin-top:26px">Comp Ledger <span class="n">// results decide</span></div>
  <div id="anLedger"></div>
  <div class="sec-title" style="margin-top:26px">Player Form <span class="n">// last outing + trend</span></div>
  <div class="grid g3" id="anPlayers"></div>
  <div class="sec-title" style="margin-top:26px">Focus Now <span class="n">// tap to check off</span></div>
  <div class="panel" id="anFocus"></div>
  <div class="sec-title" style="margin-top:26px">Daily Log <span class="n">// tap a day</span></div>
  <div id="anLog"></div>
</section>
```

- [ ] **Step 2: Add CSS for the new pieces**

Append to `css/styles.css`:

```css
/* ── Analysis ── */
.an-headline{font-size:16px;color:var(--txt);line-height:1.5}
.an-headline b{color:var(--gold-bright)}
.an-record{font-family:var(--font-d);font-weight:700;font-size:13px;letter-spacing:.1em;color:var(--gold)}
.form-pips{display:flex;gap:5px;margin:10px 0}
.pip{width:24px;height:24px;display:grid;place-items:center;font-family:var(--font-d);font-weight:700;
  font-size:12px;color:var(--bg);clip-path:polygon(5px 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%,0 5px)}
.pip.W{background:var(--good)} .pip.L{background:var(--bad)}
.wr-big{font-family:var(--font-d);font-weight:700;font-size:34px;color:var(--gold-bright);line-height:1}
.day-bars{display:flex;gap:8px;align-items:flex-end;margin-top:12px}
.day-bar{flex:0 0 auto;text-align:center;font-size:10px;color:var(--txt-faint)}
.day-bar .bar2{width:34px;display:flex;flex-direction:column-reverse;border:1px solid var(--line);background:var(--bg2)}
.day-bar .bw{background:var(--good)} .day-bar .bl{background:var(--bad)}
.ledger-row{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;
  background:linear-gradient(160deg,var(--panel),var(--bg2));border:1px solid var(--line);padding:12px 14px;margin-bottom:8px}
.ledger-bar{height:10px;background:var(--bg);border:1px solid var(--line);display:flex;overflow:hidden;min-width:120px}
.ledger-bar .lw{background:var(--good)} .ledger-bar .ll{background:var(--bad)}
.verdict{font-family:var(--font-d);font-size:10px;letter-spacing:.12em;text-transform:uppercase;font-weight:700;padding:4px 9px;border:1px solid}
.v-Proven{color:var(--good);border-color:rgba(63,185,80,.5)}
.v-Testing{color:var(--mid-wr);border-color:rgba(230,195,74,.5)}
.v-Underperforming{color:var(--red);border-color:rgba(255,70,85,.5)}
.v-Untested{color:var(--txt-dim);border-color:var(--line2)}
.src-tag{font-size:10px;color:var(--txt-faint);letter-spacing:.05em;text-transform:uppercase}
.pf-card .pf-champ{font-family:var(--font-d);font-weight:700;color:var(--gold-bright);font-size:16px}
.pf-stat{font-size:13px;color:var(--txt-dim)}
.trend-up{color:var(--good)} .trend-down{color:var(--red)} .trend-flat{color:var(--txt-faint)}
```

- [ ] **Step 3: Add render functions to `js/render.js`**

Append:

```js
function renderAnalysis(){
  if(!DAILY_LOG.length){
    document.getElementById('anBriefing').innerHTML =
      '<div class="panel"><div class="an-headline">No games logged yet.</div></div>';
    return;
  }
  const latest = DAILY_LOG[DAILY_LOG.length-1];
  const day = {w:latest.games.filter(g=>g.result==='W').length, l:latest.games.filter(g=>g.result==='L').length};
  document.getElementById('anBriefing').innerHTML =
   `<div class="panel"><div class="sec-title" style="margin-bottom:10px">Latest Briefing
      <span class="n">// ${latest.date}</span></div>
     <div class="an-record">${day.w}W – ${day.l}L</div>
     <div class="an-headline" style="margin-top:8px">${latest.headline}</div></div>`;

  // Form & winrate
  const o = overallRecord(DAILY_LOG);
  const pips = formGuide(DAILY_LOG, 8).map(r=>`<span class="pip ${r}">${r}</span>`).join('');
  const days = dayRecords(DAILY_LOG);
  const maxG = Math.max(1, ...days.map(d=>d.w+d.l));
  const bars = days.map(d=>{
    const h=70, wh=(d.w/maxG)*h, lh=(d.l/maxG)*h;
    return `<div class="day-bar"><div class="bar2" style="height:${h}px">
      <i class="bl" style="height:${lh}px"></i><i class="bw" style="height:${wh}px"></i></div>
      ${d.date.slice(5)}</div>`;
  }).join('');
  document.getElementById('anForm').innerHTML =
   `<div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap">
      <div><div class="wr-big">${Math.round(o.winrate*100)}%</div>
        <div class="pf-stat">${o.w}W – ${o.l}L · ${o.games} games</div></div>
      <div><div class="pf-stat">Recent form</div><div class="form-pips">${pips}</div></div>
    </div>
    <div class="day-bars">${bars}</div>`;

  // Ledger
  const recs = compRecords(DAILY_LOG);
  const ledger = COMPS.map(c=>{
    const r = recs[c.id] || {w:0,l:0}; const n=r.w+r.l;
    const v = verdictFor(r);
    const wpct = n ? (r.w/n*100) : 0, lpct = n ? (r.l/n*100) : 0;
    return `<div class="ledger-row">
      <div class="comp-badge" style="background:${c.color};width:34px;height:34px;font-size:16px"><span>${c.id}</span></div>
      <div><div class="lc-name">${c.name} <span class="src-tag">· ${c.source}${c.status==='proposed'?' · proposed':''}</span></div>
        <div class="an-record" style="margin:4px 0">${r.w}W – ${r.l}L</div>
        <div class="ledger-bar"><i class="lw" style="width:${wpct}%"></i><i class="ll" style="width:${lpct}%"></i></div></div>
      <div class="verdict v-${v}">${v}</div></div>`;
  }).join('');
  document.getElementById('anLedger').innerHTML = ledger;

  // Player form
  document.getElementById('anPlayers').innerHTML = ORDER5.map(name=>{
    const pf = playerForm(DAILY_LOG, name);
    if(!pf) return `<div class="panel pf-card"><div class="pf-champ">${name}</div><div class="pf-stat">No games.</div></div>`;
    const L = pf.latest;
    const arrow = pf.trend==='up'?'▲':pf.trend==='down'?'▼':'�—';
    return `<div class="panel pf-card">
      <div style="display:flex;align-items:center;gap:10px">${ico(L.champ)}
        <div><div class="pf-champ">${name}</div><div class="pf-stat">${L.champ} · ${L.result}</div></div>
        <div class="trend-${pf.trend}" style="margin-left:auto;font-size:18px">${arrow}</div></div>
      <div class="pf-stat" style="margin-top:10px">${L.k}/${L.d}/${L.a} · ${pf.latest.kda.toFixed(1)} KDA${L.csm?` · ${L.csm} CS/m`:''}${L.kp?` · ${L.kp}% KP`:''}</div>
    </div>`;
  }).join('');

  // Focus (checkable, persisted)
  const FLS='clashhq_focus_v1';
  let fdone={}; safe(()=>{fdone=JSON.parse(store.get(FLS)||'{}')});
  const focusSorted=[...FOCUS].sort((a,b)=>a.priority-b.priority);
  document.getElementById('anFocus').innerHTML = focusSorted.map(f=>`
    <div class="task ${fdone[f.id]?'done':''}" data-fid="${f.id}">
      <span class="checkbox">✓</span>
      <span class="task-txt"><b>${f.title}.</b> <span style="color:var(--txt-faint)">${f.why}</span></span></div>`).join('');
  document.querySelectorAll('[data-fid]').forEach(t=>t.onclick=()=>{
    const id=t.dataset.fid; fdone[id]=!fdone[id]; store.set(FLS,JSON.stringify(fdone));
    t.classList.toggle('done');
  });

  // Daily log (collapsible)
  document.getElementById('anLog').innerHTML = [...DAILY_LOG].reverse().map((d,i)=>{
    const w=d.games.filter(g=>g.result==='W').length, l=d.games.filter(g=>g.result==='L').length;
    const games=d.games.map(g=>`
      <div class="task" style="cursor:default">
        <span class="task-txt"><b style="color:${g.result==='W'?'var(--good)':'var(--red)'}">${g.result}</b>
        · ${g.dur} · ${g.lineup.map(p=>p.champ).join(' / ')}
        ${g.note?`<span class="why" style="display:block;font-size:12px;color:var(--txt-faint)">${g.note}</span>`:''}</span></div>`).join('');
    return `<div class="phase ${i===0?'open':''}">
      <div class="phase-head"><span class="phase-dot" style="background:var(--gold)"></span>
        <span class="phase-title">${d.date}</span><span class="phase-when">${w}W – ${l}L</span></div>
      <div class="phase-body">${games}</div></div>`;
  }).join('');
  document.querySelectorAll('#anLog .phase-head').forEach(h=>h.onclick=()=>h.parentNode.classList.toggle('open'));
}
renderAnalysis();
```

- [ ] **Step 4: Verify in browser**

Run: `npx serve .`, open the Analysis tab.
Expected: Briefing shows `1W – 2L` + headline; winrate shows `33%`; form pips `L W L`; ledger lists comps with `control 1W–0L` and others; player cards show Caitlyn for Shabir with a trend arrow; Focus items toggle and persist on refresh; Daily Log expands June 6 into 3 games. Zero console errors.

- [ ] **Step 5: Commit**

```bash
git add index.html css/styles.css js/render.js
git commit -m "feat: add Analysis tab (briefing, winrate, ledger, player form, focus, log)"
```

---

## Task 6: Wire comp ids + add the proposed (PDF) comps

The ledger keys on `comp` ids in the log. Ensure existing comps carry matching ids and add Eshantha's archetypes as proposed candidates.

**Files:**
- Modify: `data/comps.js`

- [ ] **Step 1: Give the seeded comps stable ids**

The June 6 log uses `wombo`, `control`, `ftb`. In `data/comps.js`, set the existing entries' `id` accordingly: `A→'wombo'`, `C→'ftb'`, and add a new core entry `control` (Shen/Viego/Orianna/Caitlyn/Rell — the proven win). Keep `name`/`tag`/`color` readable. Update the badge text rendering (it uses `c.id`) — for multi-letter ids, shorten the badge to the first letter via `c.id[0].toUpperCase()` in BOTH `render.js` comp badge spots (Comps list and ledger). Apply:

In `js/render.js`, replace `<span>${c.id}</span>` (comps list) and `<span>${c.id}</span>` (ledger) with `<span>${c.id[0].toUpperCase()}</span>`.

- [ ] **Step 2: Add the proposed comps**

Append to `COMPS` (champs may be off your dpm history; that's expected for untested):

```js
,{id:'snowball',name:'Aggressive Snowball',tag:'Lane Kingdom',tier:'FLEX',color:'#e0503e',
  source:'eshantha',status:'proposed',
  roles:[{r:'Top',p:'Eshantha',k:['Anivia']},{r:'Jungle',p:'Harendra',k:['Volibear']},
    {r:'Mid',p:'Geeth',k:['Talon']},{r:'ADC',p:'Shabir',k:['Draven']},{r:'Support',p:'Steven',k:['Morgana']}],
  win:'Pure early aggression — Talon/Voli invade, Draven snowballs, Anivia traps lanes. 8–10 kill lead by 15.',
  spike:'Early (0–15 min).', lose:'Falls off if the early lead doesn’t convert. Proposed — untested.'}
,{id:'president',name:'Protect the President',tag:'Peel for MF',tier:'FLEX',color:'#c586e0',
  source:'eshantha',status:'proposed',
  roles:[{r:'Top',p:'Harendra',k:['Shen']},{r:'Jungle',p:'Shabir',k:['Warwick']},
    {r:'Mid',p:'Steven',k:['Orianna']},{r:'ADC',p:'Geeth',k:['Miss Fortune']},{r:'Support',p:'Eshantha',k:['Alistar']}],
  win:'Keep Geeth’s MF alive to channel Bullet Time. Fight only when MF can free-fire.',
  spike:'Mid game.', lose:'Dive assassins (Zed/Rengar) bypass peel. Proposed — untested.'}
,{id:'zone',name:'Zone Control',tag:'Suffocate the map',tier:'FLEX',color:'#0397ab',
  source:'eshantha',status:'proposed',
  roles:[{r:'Top',p:'Eshantha',k:['Anivia']},{r:'Jungle',p:'Harendra',k:['Ivern']},
    {r:'Mid',p:'Steven',k:['Veigar']},{r:'ADC',p:'Geeth',k:['Caitlyn']},{r:'Support',p:'Shabir',k:['Rell']}],
  win:'Wall/cage/traps make every objective a prison. Force enemies to enter your fortress.',
  spike:'Mid-late.', lose:'Mobile/flank champs (Hecarim) skip the zone. Proposed — untested.'}
,{id:'poke',name:'Poke & Distance',tag:'Bleed them dry',tier:'FLEX',color:'#4b9cff',
  source:'eshantha',status:'proposed',
  roles:[{r:'Top',p:'Eshantha',k:['Anivia']},{r:'Jungle',p:'Harendra',k:['Ivern']},
    {r:'Mid',p:'Steven',k:['Lux']},{r:'ADC',p:'Geeth',k:['Caitlyn']},{r:'Support',p:'Shabir',k:['Morgana']}],
  win:'Chunk enemies before fights; start objectives only after they’re low. Never flip Baron.',
  spike:'Mid game.', lose:'Hard engage that closes distance. Proposed — untested.'}
```

Also add `PLAIN` entries for the new ids so the Comps tab’s plain-English line doesn’t break:

```js
PLAIN.snowball='Win every lane early and run them over before 15 minutes. <b>Proposed by Eshantha — not tested yet.</b>';
PLAIN.president='Everyone protects Geeth on Miss Fortune so he can ult safely. <b>Proposed — untested.</b>';
PLAIN.zone='Lock down objectives with walls/cages so the enemy can’t walk in. <b>Proposed — untested.</b>';
PLAIN.poke='Chip them from range until they’re too low to fight. <b>Proposed — untested.</b>';
PLAIN.control='Stand behind tanks, Orianna Shockwave, Caitlyn cleans up — the comp that won June 6.';
```

- [ ] **Step 3: Verify in browser**

Run: `npx serve .`. Check the Comps tab renders all comps (no broken plain-English line) and the Analysis ledger now shows the proposed comps as `Untested` with their `eshantha · proposed` tag, while `control` shows `1W–0L`, `wombo`/`ftb` show `0W–1L`.
Expected: all good, zero console errors.

- [ ] **Step 4: Commit**

```bash
git add data/comps.js js/render.js
git commit -m "feat: add proposed PDF comps as tracked candidates; stable comp ids"
```

---

## Task 7: PWA — manifest, icons, service worker

**Files:**
- Create: `manifest.webmanifest`, `sw.js`, `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-maskable-512.png`
- Modify: `index.html` (head links), `js/app.js` (SW registration)

- [ ] **Step 1: Create icons**

Add three PNG icons in `icons/` (192×192, 512×512, and a 512×512 maskable with padding). Use the gold "CLASH HQ" mark on the `#080b14` background. (If generating quickly: a solid `#080b14` square with a centered gold diamond + "HQ" is fine for v1.)

- [ ] **Step 2: Create `manifest.webmanifest`**

```json
{
  "name": "Clash HQ — Team War Room",
  "short_name": "Clash HQ",
  "start_url": "./index.html",
  "scope": "./",
  "display": "standalone",
  "background_color": "#080b14",
  "theme_color": "#080b14",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 3: Create `sw.js`**

```js
const CACHE = 'clashhq-v1';
const ASSETS = [
  './', './index.html', './css/styles.css',
  './js/analysis-core.js', './js/render.js', './js/app.js',
  './data/roster.js', './data/comps.js', './data/meta.js', './data/analysis.js',
  './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => hit ||
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match('./index.html')))
  );
});
```

**Note:** bump `CACHE` to `clashhq-v2`, `-v3`… on each future deploy so clients pick up new data.

- [ ] **Step 4: Add head links in `index.html`**

In `<head>`:

```html
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#080b14">
<link rel="apple-touch-icon" href="icons/icon-192.png">
```

- [ ] **Step 5: Register the service worker in `js/app.js`**

Append:

```js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW:', e));
  });
}
```

- [ ] **Step 6: Verify PWA**

Run: `npx serve .` (must be http, not file://). In Chrome DevTools → Application:
- Manifest shows name/icons with no errors.
- Service Worker is "activated and running".
- Offline tickbox → reload → app still loads.
- An install/⊕ icon appears in the address bar.

Expected: all of the above pass.

- [ ] **Step 7: Commit**

```bash
git add manifest.webmanifest sw.js icons index.html js/app.js
git commit -m "feat: make Clash HQ an installable offline PWA"
```

---

## Task 8: Deploy to GitHub Pages

**Files:** none (repo settings)

- [ ] **Step 1: Create the GitHub repo and push**

Run (user may need to authenticate `gh auth login` interactively in their own terminal):

```bash
gh repo create clash-hq --public --source=. --remote=origin --push
```

- [ ] **Step 2: Enable Pages**

Run:

```bash
gh api -X POST repos/:owner/clash-hq/pages -f source.branch=main -f source.path=/
```

(or enable via the repo Settings → Pages → Deploy from branch → `main` / root.)

- [ ] **Step 3: Verify the live weblink**

Open `https://<user>.github.io/clash-hq/`.
Expected: app loads over HTTPS, Analysis tab works, install prompt available, offline works. Confirm install on a phone home screen.

- [ ] **Step 4: Record the URL**

Add the live URL to `README.md` and commit.

```bash
git add README.md
git commit -m "docs: add live Clash HQ URL"
git push
```

---

## Task 9: Mobile QA + polish

**Files:** `css/styles.css` (only if issues found)

- [ ] **Step 1: Test on a narrow viewport (≤400px)**

DevTools device mode. Check: nav scrolls horizontally; Analysis ledger rows, player cards (`g3`→1 col), day-bars, and form pips all fit without overflow; touch targets feel ≥44px.

- [ ] **Step 2: Fix any overflow inline**

If the ledger 3-column grid is cramped on phones, add to `css/styles.css`:

```css
@media(max-width:600px){
  .ledger-row{grid-template-columns:auto 1fr}
  .ledger-row .verdict{grid-column:2;justify-self:start;margin-top:4px}
  .an-form-flex{gap:14px}
}
```

- [ ] **Step 3: Verify and commit**

Run: re-check in device mode.

```bash
git add css/styles.css
git commit -m "polish: mobile layout for Analysis tab"
git push
```

---

## Self-review notes

- **Spec coverage:** §3 architecture → Tasks 1,2,7,8. §4 data model → Tasks 3,4. §5 Analysis tab → Task 5. §6 comps integration → Task 6. §8 PWA → Task 7. §9 hosting → Task 8. §11 seed → Task 4. §12 UX → Task 9. §10 daily workflow → documented (no code; it's the recurring Task-4-style edit). §2 data-first/§7 roster → Tasks 5/6 (ledger + dpm-only roster, unchanged).
- **Placeholders:** seed KDAs marked `0` are explicitly filled in Task 4 Step 1 (a real scrape action), not left vague.
- **Type consistency:** `overallRecord/compRecords/verdictFor/formGuide/dayRecords/playerForm/kdaOf` names match between `analysis-core.js`, its tests, and `render.js`. Comp ids (`wombo/control/ftb/snowball/president/zone/poke`) match between `data/comps.js` and `data/analysis.js`.
