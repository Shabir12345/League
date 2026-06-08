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

module.exports = { participantFor, roleOf, laneOpponent, statAtMinute, gameStats };
