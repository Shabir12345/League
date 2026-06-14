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

  // Pass 1 — resolve every PUUID fresh from the Riot ID each run.
  // PUUIDs are encrypted per API key: a cached one from a previous key 400s
  // ("Exception decrypting"). Match IDs are NOT key-encrypted, so existing
  // history still merges correctly against the freshly-resolved PUUID.
  const state = {};
  for (const pl of cfg.players) {
    const existing = loadExisting(pl.file);
    const acct = await riot.getAccountByRiotId(pl.gameName, pl.tagLine, key);
    state[pl.name] = { pl, existing: existing || { games: [] }, puuid: acct.puuid };
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
