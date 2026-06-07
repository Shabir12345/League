# Clash HQ — App + Daily Analysis · Design Spec

**Date:** 2026-06-07
**Author:** Claude (with Shabir)
**Status:** Draft for review

---

## 1. Overview

Clash HQ is the 5-man EUW team's strategy hub (currently a single `index.html`).
This spec covers two changes:

1. **Add a daily Analysis system** — a tab that tracks results over time, surfaces
   trends and improvements, and tells the team what to focus on next.
2. **Elevate from a single HTML file to a real, hosted web app** — an installable
   PWA served at a public weblink (GitHub Pages), mobile-first, with clean UI/UX,
   that the team can open and rely on every day.

**Next Clash:** Saturday June 20, 2026.

## 2. Guiding principle — *opinions propose, results decide*

The app is **data-first**. dpm.lol match history is the source of truth.

Anyone can *propose* a comp or a strategy (Claude's data-driven comps, Eshantha's
PDF archetypes, a new idea on the day). Proposals are tracked as **candidates**.
What promotes a candidate to "trusted" is its **win/loss record in the ledger**, not
who suggested it. This is the deliberate, neutral way we handle the known bias in the
teammate-compiled PDFs: we don't arbitrate whose theory is right — we log what
actually happens and let results settle it.

Concretely:
- **Roster & player stats** = actual dpm.lol data only (not self-reported pools).
- **Comps** = both data-driven and proposed, each tagged with `source` and a live `record`.
- **Verdicts** (Proven / Testing / Underperforming) are computed from the ledger.

## 3. Architecture

**Type:** Static, installable **PWA**. No backend, no database, no accounts, no cost.

**Hosting:** GitHub Pages → public HTTPS weblink (e.g. `https://<user>.github.io/clash-hq/`).
Installable to phone home screen; also fully usable in a normal browser tab. Updates
go live when we `git push`.

**Why static + PWA (not a backend app):** the data is maintained by Claude (scan
dpm.lol → judge → edit data files → commit). The team consumes it. A backend with
live data entry would add hosting cost, accounts, and maintenance for no real benefit
at this scale. PWA gives the "real app" feel (install, offline, instant load) for free.

**File structure (refactor the single file into):**
```
/index.html              # app shell + nav + view containers only
/css/styles.css          # all styles (lifted from current <style>)
/js/app.js               # nav, view switching, countdown, PWA registration
/js/render.js            # render functions for each view
/data/roster.js          # PLAYERS, SEATS  (dpm.lol truth)
/data/comps.js           # COMPS (data-driven + proposed candidates)
/data/meta.js            # TIERS, bans, phases, glossary, game plan
/data/analysis.js        # DAILY_LOG, FOCUS  ← the file Claude edits most
/manifest.webmanifest    # PWA manifest
/sw.js                   # service worker (offline cache)
/icons/                  # PWA icons (192, 512, maskable)
```

**Data in JS, not fetched JSON:** data files declare plain globals
(`const DAILY_LOG = [...]`) loaded via `<script>` tags. This avoids `fetch`/CORS,
works identically hosted or opened locally, and keeps Claude's daily edits to a single
readable file. No build step, no framework.

## 4. Data model

```js
// data/analysis.js
const DAILY_LOG = [
  {
    date: '2026-06-06',
    headline: '1–2 on comp tests. The win was the grouped Viego/Orianna/Caitlyn fight.',
    games: [
      {
        dur: '32:34', queue: 'Flex', result: 'L', comp: 'wombo',
        lineup: [
          { role:'Top', player:'Harendra', champ:'Malphite', k:8,d:6,a:4, csm:6.0, kp:38 },
          { role:'Jungle', player:'Geeth', champ:'Wukong', k:0,d:0,a:0, csm:0, kp:0 },
          { role:'Mid', player:'Steven', champ:'Annie', k:0,d:0,a:0, csm:0, kp:0 },
          { role:'ADC', player:'Shabir', champ:'Caitlyn', k:10,d:7,a:5, csm:8.1, kp:47 },
          { role:'Support', player:'Eshantha', champ:'Rell', k:0,d:0,a:0, csm:0, kp:0 }
        ],
        note: 'Low team KP — fought spread out, engage never connected.'
      }
      // ...G2 win, G3 loss
    ]
  }
];

const FOCUS = [
  { id:'kp', priority:1, title:'Group by ~14 min — fight as 5',
    why:'Both losses had low kill participation; the win had 61% KP.', status:'open' },
  // ...
];
```

```js
// data/comps.js — each comp gains:
{
  id:'wombo', name:'Wombo', source:'claude',        // 'claude' | 'eshantha' | 'team'
  status:'testing',                                  // derived label override allowed
  // ...existing roles/win/spike/lose...
}
```
`record` (W–L) and `verdict` are **computed** from `DAILY_LOG`, not stored, so they
can never drift from the log.

## 5. The Analysis tab

New nav tab **📊 Analysis**, placed after **War Room**. Six stacked sections:

1. **Latest Briefing** — newest day: date, record (e.g. `1W–2L`), Claude's 1–2 line read.
2. **Form & Winrate** — overall 5-stack record + winrate %, a form guide (`W L L`…),
   and per-day bars. (Upgrade to a real sparkline once ≥2 weeks of data exist — CSS
   bars until then; no charting library.)
3. **Comp Ledger** — every comp with a W–L bar and computed verdict
   (`Proven` / `Testing` / `Underperforming`). Proposed comps show `· proposed` and
   their source. This is where "results decide" is visible.
4. **Player Form** — 5 cards (Top→Sup): last champ, K/D/A, CS/min, KP, ▲/▼ vs prior outing.
5. **Focus Now** — ranked, checkable shortlist of what to fix next, each with a one-line
   "why". Checkable state persists in `localStorage` (same pattern as the Prep tab).
6. **Daily Log** — collapsible per-day history (Prep-phase pattern); expands to the full
   game-by-game lineup + stats.

## 6. Comps integration (teammate PDF)

Add Eshantha's five archetypes as **candidate comps** (`source:'eshantha'`,
`status:'proposed'`): Wombo (already exists — merge/keep both labeled), Protect the
President (peel Geeth MF), Aggressive Snowball / Lane Kingdom, Zone Control, Poke.
They appear in the Comps tab and the Draft Lab, and carry an empty record until played.
Their champ picks may include champs absent from dpm history — that's fine; they read
as untested until the ledger fills in.

## 7. Roster reconciliation

Roster stays on **actual dpm.lol pools** (current data). Self-reported PDF pools are
**not** merged into the truth. If useful later, a small "claimed vs played" note can be
added, but it's out of scope for v1 to avoid manufacturing drama.

## 8. PWA specifics

- `manifest.webmanifest`: name "Clash HQ", short_name "Clash HQ", theme `#080b14`,
  background `#080b14`, display `standalone`, icons 192/512 + maskable.
- `sw.js`: cache-first for the app shell + assets so it opens offline and instantly;
  network-then-cache for navigation. Bump a `CACHE_VERSION` on each deploy.
- Register the SW from `app.js` with a guard (no-op if unsupported).
- Add `<meta name="theme-color">`, apple-touch-icon, and viewport already present.

## 9. Hosting / deploy

- Push the repo to GitHub; enable **Pages** on the default branch (root).
- Result: a shareable HTTPS weblink the team bookmarks / installs. No local file needed.
- Each future update = edit `data/analysis.js` → commit → push → live in ~1 min.

## 10. Daily update workflow (how Claude maintains it)

1. Scan the five dpm.lol profiles for that day's 5-stack games.
2. Reconstruct each game's lineup + per-player stats + result.
3. Append a `DAILY_LOG` entry with a headline + per-game notes.
4. Update `FOCUS` (re-rank, close resolved items, add new ones).
5. Commit + push. Ledger/verdicts/trends recompute automatically.

## 11. Seed data (backfill)

Seed `DAILY_LOG` with the **verified June 6 comp test** (3 Flex games; the off-comp
Normal warmup is excluded):
- 32:34 **L** — Malphite / Wukong / Annie / Caitlyn / Rell  *(Wombo)*
- 33:48 **W** — Shen / Viego / Orianna / Caitlyn / Rell  *(control hybrid)*
- 24:26 **L** — Sion / Viego / Orianna / Caitlyn / Alistar  *(Front-to-Back)*

Lineups are confirmed. Exact per-player KDAs are re-pulled cleanly during
implementation. Earlier 5-stack days can be backfilled later on request.

## 12. Visual / UX

- Reuse the existing "War Room" theme (gold/teal, clip-path panels, role colors) so the
  Analysis tab looks native. Add only a few small classes (W-L bars, form pips, trend arrows).
- Mobile-first: the existing swipeable nav already handles small screens; verify the new
  tab and tables fit. Touch targets ≥44px.
- Keep copy plain-English (the site already explains jargon) so all five players can use it.

## 13. Out of scope (YAGNI for v1)

- Backend, accounts, live in-browser data entry.
- Automated dpm.lol scraping inside the app (Claude does this manually on request).
- Charting libraries / Riot Match-V5 API (revisit only if we start guessing *why* a game
  was lost — then a Riot API key adds gold@14 / damage share / vision / objective data).
- "Claimed vs played" pool reconciliation UI.

## 14. Build phases

1. **Refactor** single file → structured static app (css/js/data split). No behavior change.
2. **PWA** — manifest, service worker, icons, install support.
3. **Analysis tab** — data model + six sections, seeded with June 6.
4. **Comps integration** — add Eshantha's archetypes as candidates; wire records/verdicts.
5. **Deploy** — push to GitHub, enable Pages, verify the weblink + install on a phone.
6. **Polish** — mobile QA, copy pass, accessibility check.
