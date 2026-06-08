# Player Profiles UI (Sub-project B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Profiles tab to Clash HQ — 5 player cards that open a deep per-player page (champ pool w/ real WR, recent form + rank, lane/early-game panel, game-by-game history) with a Solo/Flex ↔ 5-Stack toggle, reading the pipeline's `data/players/*.json`.

**Architecture:** Static vanilla HTML/CSS/JS, no build step (matches existing app). Pure aggregation math lives in a new tested `js/profiles-core.js` (browser global + Node module, like `js/analysis-core.js`). The Profiles view fetches the 5 JSON files once per session, caches them in memory, and renders an overview or a deep page from an in-memory `profileState`. The service worker serves player JSON **network-first** (fresh when online, cached when offline) while keeping the app shell cache-first.

**Tech Stack:** Vanilla JS, `node --test` for `profiles-core`, browser (`npx serve .`) for render verification. Existing helpers reused: `ico()`, `icoURL()`, `wrColor()`, `el()`, `store`, `safe`, `ORDER5`, `ROLE_C`, `PLAYERS`, and the `.panel`/`.pip`/`.form-pips`/`.sec-title`/`.grid.g3` styles.

**Spec:** `docs/superpowers/specs/2026-06-07-player-profiles-ui-design.md`

---

## File structure (target)

```
js/profiles-core.js          # NEW — pure: laneAggregate, recordOf, splitByStack, fmtDiff (tested)
test/profiles-core.test.js   # NEW — node --test fixtures
index.html                   # MODIFY — nav button, <section id="profiles">, <script> for profiles-core
css/styles.css               # MODIFY — append Profiles styles + ≤600px rules
js/render.js                 # MODIFY — append profiles state, loadProfiles, overview, deep page, openProfile; add Roster link
js/app.js                    # MODIFY — tab click triggers loadProfiles('profiles')
sw.js                        # MODIFY — network-first for data/players/*.json, precache the 5 files, bump CACHE v5
```

Data files already exist (from Sub-project A): `data/players/{shabir,harendra,steven,eshantha,geeth}.json`.

**Data facts the code depends on (verified):**
- Each file: `{ player, puuid, generatedAt, rank:{solo,flex}, games:[…flat, newest-first…], soloFlex:{champPool,roleSplits,form}, fiveStack:{champPool,roleSplits,form} }`.
- `champPool` item: `{champ, games, wr, kda, csm, csDiff10}`. `roleSplits` item: `{role, games, wr}`. `form`: `["W","L",…]` newest-first.
- Per-game item: `{matchId, queue, champ, role, win, k, d, a, kda, csm, kp, vision, dmgShare, csAt10, goldAt10, csDiff10, goldDiff10, csDiff14, goldDiff14, fiveStack, date}`.
- File name = player name lowercased (`Shabir` → `shabir.json`). All 5 players currently have both solo/flex and 5-stack games.

---

## Task 1: Pure aggregation logic (`profiles-core.js`) with `node --test`

**Files:**
- Create: `js/profiles-core.js`
- Test: `test/profiles-core.test.js`

- [ ] **Step 1: Write the failing tests**

Create `test/profiles-core.test.js`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test`
Expected: FAIL — `Cannot find module '../js/profiles-core.js'`.

- [ ] **Step 3: Implement `js/profiles-core.js`**

```js
// Pure, dependency-free. Works as a browser global AND a Node module (mirrors analysis-core.js).
(function (root) {
  const LANE_FIELDS = ['csAt10', 'csDiff10', 'csDiff14', 'goldDiff10', 'goldDiff14'];

  function laneAggregate(games) {
    const out = { n: games.length };
    LANE_FIELDS.forEach(f => {
      const vals = games.map(g => g[f]).filter(v => typeof v === 'number' && !isNaN(v));
      out[f] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    });
    return out;
  }

  function recordOf(games) {
    const w = games.filter(g => g.win).length;
    const l = games.filter(g => !g.win).length;
    const n = w + l;
    return { w, l, games: n, winrate: n ? w / n : 0 };
  }

  function splitByStack(games) {
    return { solo: games.filter(g => !g.fiveStack), five: games.filter(g => g.fiveStack) };
  }

  function fmtDiff(v, opts) {
    opts = opts || {};
    if (v == null || isNaN(v)) return '—';
    const sign = v > 0 ? '+' : v < 0 ? '-' : '';
    const abs = Math.abs(v);
    let body;
    if (opts.k && abs >= 1000) body = (abs / 1000).toFixed(1) + 'k';
    else if (opts.dec != null) body = abs.toFixed(opts.dec);
    else body = String(Math.round(abs));
    return sign + body;
  }

  const api = { laneAggregate, recordOf, splitByStack, fmtDiff };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api); // expose as globals in the browser
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test`
Expected: PASS — all `profiles-core` tests green (plus the existing `analysis-core` tests).

- [ ] **Step 5: Commit**

```bash
git add js/profiles-core.js test/profiles-core.test.js
git commit -m "feat: add tested profiles-core aggregation logic"
```

---

## Task 2: Add the Profiles tab + view shell + script tag (`index.html`)

**Files:**
- Modify: `index.html` (nav button after Roster tab; `<section>` after the Roster section; `<script>` before `render.js`)

- [ ] **Step 1: Add the nav button**

In `<nav id="nav">`, insert immediately after the Roster tab line (`<button class="tab" data-v="roster">Roster</button>`):

```html
  <button class="tab" data-v="profiles">👤 Profiles</button>
```

- [ ] **Step 2: Add the view container**

Immediately after the ROSTER `<section>…</section>` block (after `</section>` that closes `id="roster"`), insert:

```html
<!-- PROFILES -->
<section class="view" id="profiles"></section>
```

The section is filled entirely by JS when the tab is opened.

- [ ] **Step 3: Add the script tag**

In the `<script>` list before `</body>`, insert `profiles-core.js` right after `analysis-core.js` and before `render.js`:

```html
<script src="js/analysis-core.js"></script>
<script src="js/profiles-core.js"></script>
<script src="js/render.js"></script>
```

- [ ] **Step 4: Verify in browser**

Run: `npx serve .`, open the app, click the new 👤 Profiles tab.
Expected: the tab highlights and switches to an empty Profiles view (rendering comes in Task 4). Zero console errors; `node -e "void 0"` not needed — just confirm `laneAggregate` exists by typing `typeof laneAggregate` in the console → `"function"`.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add Profiles tab nav + view shell + profiles-core script"
```

---

## Task 3: Profiles CSS (`css/styles.css`)

**Files:**
- Modify: `css/styles.css` (append)

- [ ] **Step 1: Append the Profiles styles**

Add to the end of `css/styles.css`:

```css
/* ── Profiles ── */
.pf-updated{font-size:11px;color:var(--txt-faint);letter-spacing:.05em;margin-top:12px;text-transform:uppercase}
.pf-ov{cursor:pointer;transition:border-color .15s}
.pf-ov:hover{border-color:var(--gold)}
.pf-ov.err{cursor:default;color:var(--txt-faint);font-size:13px}
.pf-ov-head{display:flex;align-items:center;gap:10px}
.pf-ov-name{font-family:var(--font-d);font-weight:700;color:var(--gold-bright);font-size:16px}
.pf-ov-rank{font-size:12px;color:var(--txt-dim)}
.pf-ov-role{margin-left:auto;font-family:var(--font-d);font-weight:700;font-size:11px;letter-spacing:.1em;text-transform:uppercase}
.pf-ov-main{font-size:13px;color:var(--txt-dim);margin:10px 0 4px}
.pf-ov-main b{color:var(--txt)}

.pf-back{display:inline-block;cursor:pointer;color:var(--gold);font-size:14px;margin-bottom:14px}
.pf-back:hover{color:var(--gold-bright)}
.pf-hero{display:flex;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:6px}
.pf-hero-name{font-family:var(--font-d);font-weight:700;font-size:26px;color:var(--gold-bright);letter-spacing:.04em}
.pf-toggle{display:flex;gap:0;margin-left:auto;border:1px solid var(--line2);overflow:hidden}
.pf-tg{background:var(--bg2);color:var(--txt-dim);border:0;padding:8px 16px;font-family:var(--font-d);font-weight:700;
  font-size:12px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}
.pf-tg.on{background:var(--gold);color:var(--bg)}
.pf-subline{font-size:13px;color:var(--txt-dim);margin:4px 0 18px;display:flex;gap:14px;flex-wrap:wrap;align-items:center}

.pf-cp-row{display:grid;grid-template-columns:auto 1.4fr .6fr .6fr .9fr .9fr 1fr;gap:10px;align-items:center;
  padding:9px 0;border-bottom:1px solid var(--line)}
.pf-cp-row:last-child{border-bottom:0}
.pf-cp-nm{font-weight:600;color:var(--txt)}
.pf-cp-g,.pf-cp-kda,.pf-cp-cs,.pf-cp-d{font-size:12px;color:var(--txt-dim)}
.pf-cp-wr{font-family:var(--font-d);font-weight:700;font-size:13px}

.pf-lane{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.pf-lane .lane-cell{background:var(--bg2);border:1px solid var(--line);padding:12px}
.pf-lane .lane-k{font-size:11px;color:var(--txt-faint);text-transform:uppercase;letter-spacing:.08em}
.pf-lane .lane-v{font-family:var(--font-d);font-weight:700;font-size:20px;color:var(--txt);margin-top:4px}
.pf-lane-n{font-size:11px;color:var(--txt-faint);margin-top:10px}

.pf-roles{font-size:14px;color:var(--txt-dim);line-height:1.8}
.pf-gm{display:grid;grid-template-columns:auto auto 1.2fr .8fr .8fr .8fr .9fr;gap:10px;align-items:center;
  padding:8px 0;border-bottom:1px solid var(--line);font-size:13px}
.pf-gm:last-child{border-bottom:0}
.pf-gm b.gm-w{color:var(--good)} .pf-gm b.gm-l{color:var(--red)}
.pf-gm-nm{font-weight:600;color:var(--txt)}
.pf-gm-kda,.pf-gm-cs,.pf-gm-kp,.pf-gm-d{color:var(--txt-dim)}
.pf-empty{font-size:14px;color:var(--txt-faint);padding:6px 0}

/* Roster → profile link */
.pf-link{margin-top:10px;font-size:12px;color:var(--gold);cursor:pointer;letter-spacing:.03em}
.pf-link:hover{color:var(--gold-bright)}

@media(max-width:600px){
  .pf-cp-row{grid-template-columns:auto 1fr auto auto;row-gap:2px}
  .pf-cp-kda,.pf-cp-cs{display:none}
  .pf-gm{grid-template-columns:auto auto 1fr auto;row-gap:2px}
  .pf-gm-cs,.pf-gm-kp{display:none}
  .pf-lane{grid-template-columns:1fr 1fr}
  .pf-toggle{margin-left:0;width:100%}
  .pf-tg{flex:1}
}
```

- [ ] **Step 2: Verify**

Run: `npx serve .`. Open Profiles tab — still empty (no render yet), but confirm no CSS parse errors in the console and the page styling elsewhere is unchanged.

- [ ] **Step 3: Commit**

```bash
git add css/styles.css
git commit -m "feat: add Profiles tab styles"
```

---

## Task 4: Data load + overview cards (`js/render.js`)

**Files:**
- Modify: `js/render.js` (append a Profiles block)

- [ ] **Step 1: Append the profiles state, loader, helpers, dispatcher, and overview**

Add to the **end** of `js/render.js`:

```js
/* ── Profiles ── */
const PROFILE_FILES = { Harendra:'harendra', Geeth:'geeth', Steven:'steven', Shabir:'shabir', Eshantha:'eshantha' };
let PROFILES = null;            // { Harendra:{json}|null, ... } once a load attempt finishes
let profilesLoading = false;
let profileState = { player:null, side:'soloFlex' };  // side: 'soloFlex' | 'fiveStack'

function relTime(ts){
  const s = Math.floor((Date.now()-ts)/1000);
  if(s<60) return 'just now';
  const m = Math.floor(s/60); if(m<60) return m+'m ago';
  const h = Math.floor(m/60); if(h<24) return h+'h ago';
  return Math.floor(h/24)+'d ago';
}
function diffColor(v){ return v>0?'var(--good)':v<0?'var(--bad)':'var(--txt-dim)'; }

function loadProfiles(){
  if(PROFILES || profilesLoading){ renderProfiles(); return; }
  profilesLoading = true;
  renderProfiles();               // show loading state
  Promise.allSettled(ORDER5.map(name =>
    fetch(`data/players/${PROFILE_FILES[name]}.json`)
      .then(r => { if(!r.ok) throw new Error(r.status); return r.json(); })
  )).then(results => {
    PROFILES = {};
    ORDER5.forEach((name,i) => { PROFILES[name] = results[i].status==='fulfilled' ? results[i].value : null; });
    profilesLoading = false;
    renderProfiles();
  });
}

function renderProfiles(){
  const root = document.getElementById('profiles');
  if(!PROFILES && profilesLoading){
    root.innerHTML = `<div class="sec-title">Player Profiles</div><div class="panel"><div class="an-headline">Loading live player data…</div></div>`;
    return;
  }
  if(!PROFILES) return;           // tab never opened yet
  if(profileState.player) renderPlayerPage(profileState.player);
  else renderProfilesOverview();
}

function renderProfilesOverview(){
  const loaded = ORDER5.filter(n => PROFILES[n]);
  if(!loaded.length){
    document.getElementById('profiles').innerHTML =
      `<div class="sec-title">Player Profiles</div>
       <div class="panel"><div class="an-headline">Profiles need to load online once. Connect to the internet and reopen this tab.</div></div>`;
    return;
  }
  const oldest = Math.min(...loaded.map(n => new Date(PROFILES[n].generatedAt).getTime()));
  const cards = ORDER5.map(name => {
    const d = PROFILES[name];
    if(!d) return `<div class="panel pf-ov err">${name} — couldn't load data. Check connection.</div>`;
    const top  = (d.soloFlex.champPool||[])[0];
    const role = (d.soloFlex.roleSplits||[])[0];
    const pips = (d.soloFlex.form||[]).map(r => `<span class="pip ${r}">${r}</span>`).join('');
    return `<div class="panel pf-ov" data-player="${name}">
      <div class="pf-ov-head">
        ${top?ico(top.champ):''}
        <div><div class="pf-ov-name">${name}</div>
          <div class="pf-ov-rank">${d.rank.solo||'Unranked'}${d.rank.flex?` · ${d.rank.flex} (flex)`:''}</div></div>
        ${role?`<div class="pf-ov-role" style="color:${ROLE_C[role.role]||'var(--gold)'}">${role.role}</div>`:''}
      </div>
      ${top?`<div class="pf-ov-main">Main: <b>${top.champ}</b> · <span style="color:${wrColor(top.wr)}">${top.wr}% WR</span> · ${top.games} gms</div>`:''}
      <div class="form-pips">${pips}</div>
    </div>`;
  }).join('');
  document.getElementById('profiles').innerHTML =
    `<div class="sec-title">Player Profiles <span class="n">// tap a player · live from Riot</span></div>
     <div class="grid g3">${cards}</div>
     <div class="pf-updated">Updated ${relTime(oldest)}</div>`;
  document.querySelectorAll('#profiles [data-player]').forEach(c => c.onclick = () => {
    profileState.player = c.dataset.player; profileState.side = 'soloFlex';
    renderProfiles(); window.scrollTo({ top:0, behavior:'smooth' });
  });
}
```

(`renderPlayerPage` is added in Task 5; calling it before then would error, but it's only reachable after tapping a card — implement Task 5 before tapping a card in verification.)

- [ ] **Step 2: Temporarily verify the overview**

So the overview is reachable before Task 5 exists, temporarily make tapping a no-op: this step is verification-only. Run `npx serve .`, open Profiles. 
Expected: 5 cards render — each with a champ icon, name, Solo + Flex rank, "Main: <champ> · NN% WR · N gms", and a row of W/L form pips; an "Updated …" line under the grid. Do **not** tap a card yet (no deep page until Task 5). Zero console errors on load.

- [ ] **Step 3: Commit**

```bash
git add js/render.js
git commit -m "feat: profiles data load + overview cards"
```

---

## Task 5: Deep player page + toggle + back + openProfile (`js/render.js`)

**Files:**
- Modify: `js/render.js` (append after the Task 4 block)

- [ ] **Step 1: Append the deep-page renderer and navigation helper**

Add to the **end** of `js/render.js`:

```js
function renderPlayerPage(name){
  const root = document.getElementById('profiles');
  const d = PROFILES[name];
  const backHTML = `<div class="pf-back" id="pfBack">‹ Profiles</div>`;
  if(!d){
    root.innerHTML = backHTML + `<div class="panel"><div class="an-headline">Couldn't load ${name}'s data. Check your connection and reopen.</div></div>`;
    document.getElementById('pfBack').onclick = backToOverview;
    return;
  }
  const side  = profileState.side;                 // 'soloFlex' | 'fiveStack'
  const agg   = d[side] || { champPool:[], roleSplits:[], form:[] };
  const games = (d.games||[]).filter(g => side==='fiveStack' ? g.fiveStack : !g.fiveStack);
  const pool  = [...(agg.champPool||[])].sort((a,b)=>b.games-a.games);
  const empty = !pool.length && !games.length;

  const pips = (agg.form||[]).map(r => `<span class="pip ${r}">${r}</span>`).join('') || '<span class="pf-empty">—</span>';

  const poolHTML = pool.length ? pool.map(c => `
    <div class="pf-cp-row">${ico(c.champ)}<span class="pf-cp-nm">${c.champ}</span>
      <span class="pf-cp-g">${c.games}g</span>
      <span class="pf-cp-wr" style="color:${wrColor(c.wr)}">${c.wr}%</span>
      <span class="pf-cp-kda">${c.kda} KDA</span>
      <span class="pf-cp-cs">${c.csm} CS/m</span>
      <span class="pf-cp-d" style="color:${diffColor(c.csDiff10)}">${fmtDiff(c.csDiff10,{dec:1})} CSΔ10</span></div>`).join('')
    : `<div class="pf-empty">No ${side==='fiveStack'?'5-stack':'solo/flex'} champ data yet.</div>`;

  const la = laneAggregate(games);
  const laneCell = (k, v) => `<div class="lane-cell"><div class="lane-k">${k}</div><div class="lane-v">${v}</div></div>`;
  const laneHTML = games.length ? `<div class="pf-lane">
      ${laneCell('CS @10', la.csAt10!=null?la.csAt10.toFixed(0):'—')}
      ${laneCell('CSΔ @10', `<span style="color:${diffColor(la.csDiff10)}">${fmtDiff(la.csDiff10,{dec:1})}</span>`)}
      ${laneCell('CSΔ @14', `<span style="color:${diffColor(la.csDiff14)}">${fmtDiff(la.csDiff14,{dec:1})}</span>`)}
      ${laneCell('GoldΔ @10', `<span style="color:${diffColor(la.goldDiff10)}">${fmtDiff(la.goldDiff10,{k:true})}</span>`)}
      ${laneCell('GoldΔ @14', `<span style="color:${diffColor(la.goldDiff14)}">${fmtDiff(la.goldDiff14,{k:true})}</span>`)}
    </div><div class="pf-lane-n">Averages over ${la.n} game${la.n===1?'':'s'} vs lane opponent.</div>`
    : `<div class="pf-empty">No ${side==='fiveStack'?'5-stack':'solo/flex'} games to measure.</div>`;

  const rolesHTML = (agg.roleSplits||[]).length
    ? `<div class="pf-roles">${agg.roleSplits.map(r=>`${r.role} ${r.games}g <span style="color:${wrColor(r.wr)}">${r.wr}%</span>`).join('  ·  ')}</div>`
    : `<div class="pf-empty">No role data yet.</div>`;

  const gamesHTML = games.length ? games.slice(0,20).map(g => `
    <div class="pf-gm">
      <b class="${g.win?'gm-w':'gm-l'}">${g.win?'W':'L'}</b>
      ${ico(g.champ)}<span class="pf-gm-nm">${g.champ}</span>
      <span class="pf-gm-kda">${g.k}/${g.d}/${g.a}</span>
      <span class="pf-gm-cs">${g.csm} cs/m</span>
      <span class="pf-gm-kp">${g.kp}% KP</span>
      <span class="pf-gm-d" style="color:${diffColor(g.csDiff10)}">${fmtDiff(g.csDiff10,{dec:0})} csΔ10</span>
    </div>`).join('')
    : `<div class="pf-empty">No ${side==='fiveStack'?'5-stack':'solo/flex'} games yet.</div>`;

  root.innerHTML = backHTML + `
    <div class="pf-hero">
      <div class="pf-hero-name">${name}</div>
      <div class="pf-toggle">
        <button class="pf-tg ${side==='soloFlex'?'on':''}" data-side="soloFlex">Solo/Flex</button>
        <button class="pf-tg ${side==='fiveStack'?'on':''}" data-side="fiveStack">5-Stack</button>
      </div>
    </div>
    <div class="pf-subline">
      <span>${d.rank.solo||'Unranked'} (Solo)${d.rank.flex?` · ${d.rank.flex} (Flex)`:''}</span>
      <span class="form-pips" style="margin:0">${pips}</span>
      <span style="color:var(--txt-faint)">Updated ${relTime(new Date(d.generatedAt).getTime())}</span>
    </div>
    ${empty ? `<div class="panel"><div class="pf-empty">No ${side==='fiveStack'?'5-stack':'solo/flex'} games for ${name} yet.</div></div>` : `
    <div class="sec-title" style="margin-top:6px">Champ Pool <span class="n">// real win rate</span></div>
    <div class="panel" style="margin-bottom:8px">${poolHTML}</div>
    <div class="sec-title" style="margin-top:22px">Lane / Early Game <span class="n">// vs lane opponent</span></div>
    <div class="panel" style="margin-bottom:8px">${laneHTML}</div>
    <div class="sec-title" style="margin-top:22px">Role Split</div>
    <div class="panel" style="margin-bottom:8px">${rolesHTML}</div>
    <div class="sec-title" style="margin-top:22px">Game-by-Game <span class="n">// recent</span></div>
    <div class="panel">${gamesHTML}</div>`}
  `;

  document.getElementById('pfBack').onclick = backToOverview;
  document.querySelectorAll('#profiles .pf-tg').forEach(b => b.onclick = () => {
    profileState.side = b.dataset.side; renderProfiles();
  });
}

function backToOverview(){ profileState.player = null; renderProfiles(); window.scrollTo({ top:0, behavior:'smooth' }); }

function openProfile(name){
  profileState.player = name; profileState.side = 'soloFlex';
  showView('profiles'); loadProfiles();
}
```

- [ ] **Step 2: Verify the deep page in browser**

Run: `npx serve .`, open Profiles, tap **Shabir**.
Expected: deep page shows the hero name + a Solo/Flex|5-Stack toggle (Solo/Flex active), a subline with Solo + Flex rank + form pips + "Updated …", then Champ Pool rows (sorted most-played first, WR colored — e.g. Khazix 39g 49%), a Lane/Early grid (CS@10, CSΔ@10/14, GoldΔ@10/14 with green/red signs + "Averages over N games"), a Role Split line, and a Game-by-Game list (W/L colored). Tap **5-Stack** → every panel swaps to the 5-stack numbers. Tap **‹ Profiles** → back to the 5 cards. Repeat for one more player. Zero console errors.

- [ ] **Step 3: Commit**

```bash
git add js/render.js
git commit -m "feat: profiles deep page with Solo/Flex<->5-Stack toggle"
```

---

## Task 6: Trigger the load when the tab opens (`js/app.js`)

**Files:**
- Modify: `js/app.js:7` (the `.tab` click listener)

- [ ] **Step 1: Wire the tab click to `loadProfiles`**

Replace this line in `js/app.js`:

```js
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>showView(t.dataset.v)));
```

with:

```js
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{
  showView(t.dataset.v);
  if(t.dataset.v==='profiles') loadProfiles();
}));
```

(`loadProfiles` is a global defined in `render.js`, which loads before `app.js`.)

- [ ] **Step 2: Verify**

Run: `npx serve .`. Load the app, click 👤 Profiles directly (without touching anything else first).
Expected: cards load on first click (loading text flashes, then the 5 cards). Switching to another tab and back does **not** re-fetch (cards appear instantly). Zero console errors.

- [ ] **Step 3: Commit**

```bash
git add js/app.js
git commit -m "feat: load profiles when the Profiles tab is opened"
```

---

## Task 7: Link the Roster tab into Profiles (`js/render.js`)

**Files:**
- Modify: `js/render.js` (the roster grid template ~line 97-103 and its click wiring ~line 104)

- [ ] **Step 1: Add a "View data profile" link to each roster card**

In the roster grid template (the `PLAYERS.map(p=>…)` block), replace the existing hint line:

```js
   <div class="expand-hint">▾ tap for champ pool</div>
```

with:

```js
   <div class="expand-hint">▾ tap for champ pool</div>
   <div class="pf-link" data-pf="${p.name}">View data profile →</div>
```

- [ ] **Step 2: Wire the link (stop it from toggling the card)**

Immediately after the existing roster card click wiring:

```js
document.querySelectorAll('.player').forEach(p=>p.onclick=()=>p.classList.toggle('open'));
```

add:

```js
document.querySelectorAll('.pf-link').forEach(l=>l.addEventListener('click',e=>{ e.stopPropagation(); openProfile(l.dataset.pf); }));
```

- [ ] **Step 3: Verify**

Run: `npx serve .`, open the Roster tab, click **View data profile →** on Harendra's card.
Expected: jumps to the Profiles tab showing Harendra's deep page (Solo/Flex). The card does NOT expand/toggle when the link is clicked. Tapping elsewhere on the card still toggles the champ pool as before. Zero console errors.

- [ ] **Step 4: Commit**

```bash
git add js/render.js
git commit -m "feat: link Roster cards to data profiles"
```

---

## Task 8: Service worker — network-first for player JSON (`sw.js`)

**Files:**
- Modify: `sw.js` (precache list, fetch handler, `CACHE` version)

- [ ] **Step 1: Add the JSON files to the precache list and bump the cache version**

Replace the top of `sw.js` (the `CACHE` const and `ASSETS` array) with:

```js
/* Clash HQ service worker. Bump CACHE on every deploy so clients pick up new code. */
const CACHE = 'clashhq-v5';
const ASSETS = [
  './', './index.html', './css/styles.css',
  './js/analysis-core.js', './js/profiles-core.js', './js/render.js', './js/app.js',
  './data/roster.js', './data/comps.js', './data/meta.js', './data/analysis.js',
  './data/players/shabir.json', './data/players/harendra.json', './data/players/steven.json',
  './data/players/eshantha.json', './data/players/geeth.json',
  './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'
];
```

- [ ] **Step 2: Make player JSON network-first**

Replace the existing `fetch` listener with:

```js
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Network-first for live player data so daily refreshes show through; fall back to cache offline.
  if (url.pathname.includes('/data/players/')) {
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for the app shell.
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

- [ ] **Step 3: Verify the SW (must be http, not file://)**

Run: `npx serve .`. In Chrome DevTools → Application:
- Service Worker updates to the new version and is "activated and running" (may need one reload; the old `v4` cache is deleted on activate).
- Application → Cache Storage → `clashhq-v5` lists the 5 `data/players/*.json` files.
- Network tab: opening Profiles fetches the JSON from the network (or "ServiceWorker"). 
- Tick **Offline** in DevTools → reload → open Profiles → cards + a deep page still render from cache.

Expected: all of the above pass; zero console errors.

- [ ] **Step 4: Commit**

```bash
git add sw.js
git commit -m "feat: cache player JSON network-first; precache profiles; bump SW v5"
```

---

## Task 9: Mobile QA + final verification

**Files:** `css/styles.css` (only if an overflow is found)

- [ ] **Step 1: Test a narrow viewport (≤400px)**

Run: `npx serve .`. DevTools device mode (e.g. iPhone SE). Check:
- Profiles overview: cards (`g3`) stack to 1 column, form pips fit.
- Deep page: toggle goes full-width (two equal buttons); champ-pool rows show icon/name/games/WR (KDA & CS/m hidden by the ≤600px rule); lane grid is 2-up; game rows show W·icon·champ·csΔ; nothing overflows horizontally.
- Roster → "View data profile →" reachable with a ≥44px touch target.

- [ ] **Step 2: Fix any overflow inline**

If any row still overflows on a very narrow screen, tighten in `css/styles.css` under the existing `@media(max-width:600px)` block (e.g. reduce `gap` or hide one more `.pf-cp-*`/`.pf-gm-*` column). Only change what's needed.

- [ ] **Step 3: Run the full test suite + final browser pass**

Run: `node --test`
Expected: PASS — `analysis-core` + `profiles-core` all green.

Browser final pass (`npx serve .`): overview → each of the 5 players → toggle Solo/Flex↔5-Stack → back; Roster link; offline reload. Zero console errors.

- [ ] **Step 4: Commit (if CSS changed) and push**

```bash
git add css/styles.css
git commit -m "polish: mobile layout for Profiles tab"
git push
```

If no CSS change was needed, just `git push` to deploy the committed work.

---

## Self-review notes

- **Spec coverage:** §4 architecture/data-flow → Tasks 4,6,8. §4.2 units (`profiles-core`) → Task 1. §5.1 overview cards → Task 4. §5.2 deep page + toggle → Task 5. §6 states (loading/error/empty) → Tasks 4 (loading, all-failed), 5 (per-player error, empty side). §7 Roster link → Task 7. §8 testing → Task 1 (unit) + browser steps throughout + Task 9. SW freshness decision (§3) → Task 8. Out-of-scope coaching → untouched.
- **Type/name consistency:** `laneAggregate/recordOf/splitByStack/fmtDiff` match between `profiles-core.js`, its test, and `render.js`. `profileState` shape `{player, side}` and side values `'soloFlex'|'fiveStack'` used consistently. `PROFILE_FILES` keys match `ORDER5` names; file names match `data/players/*.json`. `openProfile/loadProfiles/renderProfiles/renderProfilesOverview/renderPlayerPage/backToOverview` all defined in render.js; `showView` (app.js) and `ico/icoURL/wrColor/ORDER5/ROLE_C/PLAYERS` (render.js/roster.js) reused. `recordOf` is defined/tested though not yet consumed by render — kept as a small public API per spec §4.2 (used by C later); acceptable, no dead code in render.
- **Placeholders:** none — every code/test/command step is concrete.
- **Note:** `recordOf` is intentionally part of the tested API for Sub-project C even though the v1 render doesn't call it; this is the only API surface not consumed by render and is justified by the spec's unit list.
