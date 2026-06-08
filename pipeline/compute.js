// pipeline/compute.js — pure, dependency-free stat functions (Node CommonJS).
const ROLE_MAP = { TOP: 'Top', JUNGLE: 'Jungle', MIDDLE: 'Mid', BOTTOM: 'ADC', UTILITY: 'Support' };

function participantFor(match, puuid) {
  return match.info.participants.find(p => p.puuid === puuid);
}
function roleOf(teamPosition) {
  return ROLE_MAP[teamPosition] || teamPosition || 'Unknown';
}
function laneOpponent(match, me) {
  // Only meaningful on Summoner's Rift; an '' teamPosition (e.g. ARAM) would
  // match the first enemy. The pipeline filters to SR ranked queues upstream.
  if (!me.teamPosition) return null;
  return match.info.participants.find(
    p => p.teamId !== me.teamId && p.teamPosition === me.teamPosition
  ) || null;
}

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

const round2 = n => Math.round(n * 100) / 100;

function gameStats(match, timeline, puuid) {
  const me = participantFor(match, puuid);
  if (!me) throw new Error(`puuid ${puuid} not in match ${match.metadata.matchId}`);
  const info = match.info;
  const mins = Math.max(info.gameDuration / 60, 1); // guard remakes (gameDuration 0)
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
    vision: me.visionScore || 0,
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

function isFiveStack(match, rosterPuuids) {
  const ours = match.info.participants.filter(p => rosterPuuids.includes(p.puuid));
  if (ours.length < 5) return false;
  const teams = new Set(ours.map(p => p.teamId));
  return teams.size === 1; // all roster members present share one team
}

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

module.exports = {
  participantFor, roleOf, laneOpponent,
  statAtMinute,
  gameStats,
  isFiveStack,
  aggregateChampPool, aggregateRoleSplits, form
};
