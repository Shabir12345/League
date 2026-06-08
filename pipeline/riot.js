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
