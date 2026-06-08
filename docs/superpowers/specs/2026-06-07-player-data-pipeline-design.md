# Player Profiles — Sub-project A: Data Pipeline (Design)

**Date:** 2026-06-07
**Status:** Approved design, ready for implementation plan
**Scope of this spec:** Sub-project A only (the Riot data pipeline). Sub-projects B (Profile UI) and C (Coaching layer) are described as context but get their own spec → plan → implementation cycles.

---

## 1. Goal

Give each of the 5 Clash players a detailed, data-driven profile to **improve them as individuals** — tracking the champions they play, real win rates, and per-stage performance, with coaching on what's going well and what to work on.

The data behind those profiles must be **live and per-stage** (gold/CS/XP per minute, lane diffs), pulled automatically from the official Riot API, while keeping Clash HQ a **static, offline, $0 PWA**.

## 2. The whole feature (decomposition + build order)

This is three projects, built and shipped one at a time:

- **A — Data pipeline (this spec, build first):** Node script + daily GitHub Action that resolves each player's PUUID, pulls Solo/Flex matches + per-minute timelines, computes stats, auto-detects 5-stack games, and commits per-player JSON to the repo. Riot key lives in a GitHub Actions secret.
- **B — Profile UI (next):** A new **Profiles** tab — 5 player cards → deep per-player page with a Solo/Flex ↔ 5-Stack toggle, champ pool with real WR, per-stage panel, game-by-game history, form trend. Reads A's JSON, cached by the service worker for offline.
- **C — Coaching / insight layer (last):** Rule-based insights vs. role/rank benchmarks, auto strengths/watch-outs, and a prioritized "work on this" list per player.

**Order: A → B → C.**

## 3. Decisions locked during brainstorming

| Decision | Choice | Why |
|---|---|---|
| Data depth | Live, per-stage from Riot API | User wants real per-stage analysis, not just aggregates |
| Architecture | **GitHub Action cron → JSON committed to repo → PWA reads static JSON** | Keeps frontend static/offline/$0; Riot key stays server-side in an Actions secret; nothing to maintain |
| Game scope | **Both Solo/Flex AND 5-stack, kept separate** | Solo/flex = individual skill; 5-stack = team play. Goal is individual improvement |
| Data privacy | **Public repo is fine** | Match stats are already public on dpm.lol/op.gg; only derived stats are committed. The Riot key stays secret regardless |
| History depth | **Last ~30 games, append daily** | Fast first run, small files, enough sample for trends |

## 4. Sub-project A — detailed design

### 4.1 File layout
```
pipeline/
  config.js        # the 5 Riot IDs + region routing (single source of truth)
  riot.js          # thin Riot API client (fetch + rate-limit handling)
  compute.js       # PURE stat functions (unit-tested, like analysis-core.js)
  run.js           # orchestrator: resolve → fetch → compute → write JSON
  SETUP.md         # click-by-click Riot key + GitHub secret guide (user deliverable)
.github/workflows/
  refresh-data.yml # daily cron + manual workflow_dispatch
data/players/
  shabir.json … geeth.json   # one file per player (what the UI reads)
test/
  compute.test.js  # fixtures of a real match+timeline → asserts the math
```

### 4.2 Player identity
The pipeline resolves each Riot ID to a permanent PUUID once and caches it in the player's JSON.

| Player | Riot ID |
|---|---|
| Shabir | `TribuIation#EUW` |
| Harendra | `Merkedi#Neru` |
| Steven | `OrionVII#EUW` |
| Eshantha | `Quiet Rapture#SKT` |
| Geeth | `Synister#ezclp` |

Routing: Account-V1 + Match-V5 use the **`europe`** regional cluster; League-V4 uses the **`euw1`** platform. The `#Neru / #SKT / #ezclp` suffixes are custom Riot ID taglines, not region codes.

### 4.3 What it fetches (per player, per run)
- **PUUID** (once, cached) — Account-V1 `by-riot-id`
- **Rank** Solo + Flex — League-V4 `by-puuid`
- **Recent ranked match IDs** — Match-V5 `by-puuid/ids` filtered to queues **420 (Solo)** + **440 (Flex)**
- For each *new* match only (matches are immutable, never re-fetched): **match detail** + **per-minute timeline** — Match-V5

### 4.4 What it computes (`compute.js`, pure functions)
- **Per game:** champ, role, W/L, K/D/A, KDA, CS, CS/m, KP%, vision score, damage share, gold/m, and timeline-derived **CS@10/@14, gold@10/@14, and diffs vs. the direct lane opponent** (CS diff@10, gold diff@10).
- **Per champion:** games, true WR, avg KDA, avg CS/m, avg CS-diff@10.
- **Per role split**, **recent form** (last N results).
- **Auto 5-stack flag:** a match where all 5 roster PUUIDs are on the same team → replaces the current manual duration cross-referencing.

### 4.5 Output schema (`data/players/<player>.json`)
```jsonc
{
  "player": "Shabir",
  "puuid": "…cached…",
  "generatedAt": "2026-06-08T04:00:00Z",
  "rank": { "solo": "Gold III", "flex": "Platinum II" },
  "soloFlex": {
    "champPool":  [ { "champ":"Khazix","games":101,"wr":49,"kda":2.1,"csm":5.6,"csDiff10":-3.2 } ],
    "roleSplits": [ { "role":"Jungle","games":178,"wr":48 } ],
    "games":      [ { "matchId":"…","queue":420,"champ":"Khazix","role":"Jungle","win":true,
                      "k":8,"d":4,"a":11,"csm":5.8,"kp":57,"csDiff10":-2,"goldDiff10":-150,
                      "csDiff14":1,"goldDiff14":120,"vision":18,"dmgShare":0.24,"date":"…" } ],
    "form":       ["W","L","W","W","L"]
  },
  "fiveStack": { "games": [ /* same shape, only all-5 games */ ] }
}
```
History **accumulates**: each run appends only new matches, capped to a rolling window so files stay small. Champ-pool / role aggregates are recomputed from the retained games each run.

### 4.6 Scheduling & safety
- **Daily cron** + manual **"Run now"** button (`workflow_dispatch`).
- Riot key = **encrypted GitHub Actions secret** (`RIOT_API_KEY`); never committed, never shipped to the client.
- **429** → respect `Retry-After`, back off and retry. **One player or match failing** → log + skip, still commit the rest (partial success). **401 (expired key)** → fail loudly in the Action log.
- Commits only when data changed → triggers the normal GitHub Pages redeploy.
- Riot attribution notice added per Riot API ToS ("isn't endorsed by Riot Games…").

### 4.7 Riot key — the user-facing setup
Because the user is not deeply technical, `pipeline/SETUP.md` is a first-class deliverable: a numbered, click-by-click guide covering (1) creating a Riot developer account, (2) getting a key — dev key for first test, then applying for the free **Personal/production key** for hands-off daily runs, (3) adding it as a GitHub Actions secret named `RIOT_API_KEY`, (4) clicking "Run now" to verify. A maintainer runs the pipeline locally once with a dev key during build to confirm it works end-to-end.

### 4.8 Testing
`compute.js` is pure → unit-tested against a saved match+timeline fixture (mirrors `test/analysis-core.test.js`). `riot.js` is network I/O → not unit-tested; verified by a manual dev-key run during setup.

## 5. Out of scope (this spec)
- The Profiles UI (Sub-project B).
- The coaching/insight/benchmark layer (Sub-project C).
- Any always-on server, database, or paid hosting.
- Backfilling full-season history.

## 6. Risks / open items
- **Production key approval:** the free dev key expires every 24h; daily automation needs the Personal/production key, which requires a short Riot app approval. Start that application early; until then the pipeline runs on-demand with a dev key.
- **Rate limits:** dev keys are limited (20 req/s, 100 req/2min). With 5 players × ~30 matches first run (detail + timeline), the first run must throttle; daily incremental runs are tiny.
- **Riot ID changes:** if a player changes their Riot ID, re-resolve the PUUID (PUUID itself is stable, so cached PUUID still works).
