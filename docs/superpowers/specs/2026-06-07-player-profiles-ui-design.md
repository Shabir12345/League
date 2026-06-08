# Player Profiles — Sub-project B: Profile UI (Design)

**Date:** 2026-06-07
**Status:** Approved design, ready for implementation plan
**Scope of this spec:** Sub-project B only (the Profiles UI). Sub-project A (data pipeline) is done and shipping per-player JSON. Sub-project C (coaching/insight layer) gets its own spec → plan → implementation cycle later.

---

## 1. Goal

Give each of the 5 Clash players a detailed, data-driven profile **page in the app**, so they can see the champions they actually play, real win rates, early-game lane performance, and recent form — for individual improvement. This is the frontend that consumes Sub-project A's `data/players/<player>.json`.

Clash HQ stays a **static, offline-capable, $0 PWA**: no backend, no build step, vanilla HTML/CSS/JS, hosted on GitHub Pages.

## 2. What's already in place (inputs)

Sub-project A commits one file per player at `data/players/<player>.json`, refreshed by a daily GitHub Action. Verified shape (Shabir example; all 5 players present):

```jsonc
{
  "player": "Shabir",
  "puuid": "…cached…",
  "generatedAt": "2026-06-08T01:37:28.652Z",
  "rank": { "solo": "Gold III", "flex": "Platinum III" },
  "games": [                       // flat array, ~60 games, newest first
    { "matchId":"EUW1_…", "queue":420, "champ":"Ashe", "role":"ADC", "win":true,
      "k":13,"d":10,"a":17,"kda":3,"csm":6.64,"kp":59,"vision":13,"dmgShare":0.21,
      "csAt10":79,"goldAt10":4275,"csDiff10":43,"goldDiff10":861,
      "csDiff14":60,"goldDiff14":2993,"fiveStack":false,"date":1780877639453 }
  ],
  "soloFlex": {                    // pre-computed aggregates over the player's solo/flex games
    "champPool":  [ {"champ":"Khazix","games":39,"wr":49,"kda":3.17,"csm":6.54,"csDiff10":2.97} ],
    "roleSplits": [ {"role":"Jungle","games":48,"wr":48}, {"role":"ADC","games":8,"wr":63} ],
    "form":       ["W","W","L","W","L","L","W","L","L","L"]   // last ~10, newest first
  },
  "fiveStack": { "champPool":[…], "roleSplits":[…], "form":[…] }  // same shape, 5-stack games only
}
```

**Key facts that shaped this design (verified against real data):**
- `champPool`, `roleSplits`, `form` are **pre-aggregated** and split into `soloFlex` vs `fiveStack`. The toggle just swaps which object the page reads.
- The per-game list lives only in the **flat `games[]`** array; each game carries a `fiveStack` boolean. Game-by-game and the lane panel filter this array by that flag.
- Per-stage lane stats (`csAt10`, `csDiff10/14`, `goldDiff10/14`) are **per-game only, not pre-aggregated** → a small pure function averages them client-side.
- All 5 players currently have 15–18 five-stack games and full 10-game form on both sides; empty states are still handled defensively.
- Champ values are Riot internal IDs (`Khazix`, `MonkeyKing`, `MissFortune`) — exactly what the existing `ico()` helper expects.

## 3. Decisions locked during brainstorming

| Decision | Choice | Why |
|---|---|---|
| Solo/Flex vs 5-Stack | **One toggle, flips the whole page, default Solo/Flex** | Goal is individual improvement; team view is one tap away |
| Page content (v1) | Champ pool w/ real WR · Recent form + rank · Lane/early-game panel · Game-by-game history | All four chosen by user; coaching insights deferred to C |
| Data loading | **`fetch()` the JSON at runtime, SW-cached** | Pipeline + Action already write JSON; converting to a JS global would duplicate/couple. Matches A's spec |
| SW strategy for JSON | **Network-first, fall back to cache** | Daily-refreshed data must show fresh when online; cache-first would freeze stats until a manual version bump |
| Routing | **In-memory `selectedPlayer` + re-render**, back link to overview | Matches existing `showView()` pattern; 5 players don't need hash routing |
| Pure logic | New tested `js/profiles-core.js` | Mirrors `analysis-core.js`; keeps math unit-testable |

## 4. Architecture

A new **Profiles** tab added to the existing nav, following the app's established structure (data → core → render → app `<script>` order; gold/dark theme; existing helpers `ico()`, `wrColor()`, `el()`, `store`, `safe`, and the `.panel` / `.pip` / `.task` styles from the Analysis tab).

### 4.1 Data flow
```
data/players/*.json  ──fetch()──►  in-memory cache {shabir:{…}, …}  ──►  render overview / deep page
        ▲ daily Action                    (fetched once per session)
        │
   service worker (network-first for /data/players/*.json, cache fallback offline)
```
- On first open of the Profiles tab, fetch all 5 JSON files in parallel (`Promise.allSettled`) and store them in a module-level object. Subsequent renders (deep page, toggle) read from memory — no re-fetch.
- Per-file failure is isolated: a player that fails to load shows an error card; the others still render (partial success, mirroring the pipeline's own philosophy).

### 4.2 Units & responsibilities
- **`js/profiles-core.js`** (new, pure, Node + browser global, unit-tested): aggregation helpers over a filtered `games[]` array. Public API:
  - `laneAggregate(games)` → `{ csAt10, csDiff10, csDiff14, goldDiff10, goldDiff14, n }` (averages; ignores games missing a field; `n` = sample size).
  - `recordOf(games)` → `{ w, l, games, winrate }`.
  - `splitByStack(games)` → `{ solo, five }` (filters on `g.fiveStack`).
  - `fmtDiff(value, {k})` → signed display string (`+3.0`, `-12`, `+3.0k`) — pure, for reuse in render.
- **`js/render.js`** (modify): `loadProfiles()` (fetch + cache + states), `renderProfilesOverview()` (the 5 cards), `renderPlayerPage(name)` (deep page), and small helpers for the champ-pool rows, lane panel, and game rows. Reads the in-memory cache + the chosen stack side.
- **`js/app.js`** (modify): wire the Profiles tab so opening it triggers `loadProfiles()` (idempotent). Keep `showView` unchanged otherwise.
- **`index.html`** (modify): nav button + `<section id="profiles">` shell with overview/deep containers.
- **`css/styles.css`** (modify): profile-specific classes (cards, champ-pool rows, lane stat grid, game rows, toggle, freshness stamp, loading/empty/error states), responsive at ≤600px.
- **`sw.js`** (modify): network-first handler branch for `data/players/*.json`; add the 5 files to the precache list; bump `CACHE` to `clashhq-v3`.

## 5. Screens

### 5.1 Profiles overview — 5 cards
Grid of player cards (reuse `.grid.g3`). Each card, from that player's **Solo/Flex** aggregates:
```
┌──────────────────────────────┐
│ [icon]  SHABIR          ADC   │   ← icon = top champ; role = top roleSplit
│ Gold III · Plat III (flex)    │
│ Main: Ashe   62% WR · 13 gms  │   ← top champPool entry (by games), WR colored
│ Form  W W L W L L W L L L      │   ← solo/flex form pips
└──────────────────────────────┘
```
Tap a card → deep page for that player. A small "Updated <relative time>" line sits under the grid (oldest `generatedAt` across the 5).

### 5.2 Deep player page
```
‹ Profiles        SHABIR            [ Solo/Flex | 5-Stack ]   ← toggle, default Solo/Flex

Gold III (Solo) · Platinum III (Flex)        Form  W W L W L L W L L L
Updated 2h ago

CHAMP POOL // real win rate            (sorted by games desc)
 [ico] Khazix    39 gms   49% WR   3.17 KDA   6.54 CS/m   CSΔ@10 +3.0
 [ico] Ashe      13 gms   62% WR   …
 …

LANE / EARLY GAME // averages vs lane opponent
 CS@10        79          CSΔ@10   +4.2          CSΔ@14   +6.0
                          GoldΔ@10 +430          GoldΔ@14 +1.2k
                          (over N games)

ROLE SPLIT
 Jungle 48g 48%  ·  ADC 8g 63%  ·  Mid 3g 33%  ·  Support 1g 0%

GAME-BY-GAME // recent
 W · [ico] Khazix · 8/4/11 (3.0 KDA) · 5.8 CS/m · 57% KP · CSΔ@10 +2
 L · [ico] Ashe   · …
 …
```
- **Toggle** flips the entire page between `soloFlex`/`fiveStack` aggregates AND filters `games[]` by `fiveStack` for the lane panel + game list. Default Solo/Flex.
- **Champ pool, role split, form** read the pre-aggregated object for the active side.
- **Lane panel** = `laneAggregate(activeGames)`. Note: less meaningful for junglers/supports, but shown uniformly with its sample size `N`.
- **Game-by-game** = active games, newest first; WR/diff values colored via `wrColor` / signed-diff coloring.
- WR cells colored with existing `wrColor()`; positive diffs green, negative red.

## 6. States

- **Loading:** skeleton/placeholder text in the overview while the 5 fetches resolve.
- **Error (a player):** that card (or deep page) shows "Couldn't load <player>'s data — check connection." Others unaffected.
- **Error (all, offline first-load, no cache):** overview shows a single "Profiles need to load online once. Connect and reopen." message.
- **Empty toggle side:** if a player has 0 games on the active side, that page shows "No <Solo/Flex|5-stack> games yet." in each panel instead of empty tables.

## 7. Connective tissue

The existing **Roster** tab is the *strategic* roster (roles, comps, jobs). Profiles is the *data-driven individual* view. To connect them without duplication, add a small "View data profile →" link on each Roster player entry that opens that player's deep Profile page. No other change to Roster.

## 8. Testing

- **`test/profiles-core.test.js`** (`node --test`, inline fixture): asserts `laneAggregate` averages correctly and skips missing fields; `recordOf` W/L/winrate; `splitByStack` partitions on the flag; `fmtDiff` formats sign + `k` suffix. Mirrors `test/analysis-core.test.js`.
- **Rendering** verified manually in-browser via `npx serve .`: overview renders 5 cards, deep page renders all panels, toggle flips every panel, mobile (≤600px) reflows without overflow, offline reload still shows last-cached profiles, freshness stamp shows.

## 9. Out of scope (this spec)

- Coaching insights, benchmarks vs role/rank, "work on this" lists (Sub-project C).
- Any server, database, or paid hosting.
- Historical backfill beyond the rolling window the pipeline keeps.
- Hash-based deep links / shareable per-player URLs.

## 10. Risks / open items

- **First load requires being online** (to populate the SW cache). Acceptable for a PWA the team installs once; called out in States.
- **Champ-name → icon mismatch** for brand-new champs is possible but degrades to 3-letter initials via the existing `onerror` fallback — no broken images.
- **Lane stats for non-laners** (jungle/support) are shown uniformly though less meaningful; acceptable for v1, can be role-tuned in C.
