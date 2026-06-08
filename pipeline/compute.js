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

module.exports = { participantFor, roleOf, laneOpponent, statAtMinute };
