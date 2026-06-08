// Minimal but valid Match-V5 detail + timeline for unit tests.
// Team 100 = ours (OURS mid, MATE adc). Team 200 = enemy (OPP mid, OPP2 adc).
const PUUIDS = { OURS: 'puuid-ours', MATE: 'puuid-mate', OPP: 'puuid-opp', OPP2: 'puuid-opp2' };

const match = {
  metadata: { matchId: 'EUW1_TEST1' },
  info: {
    queueId: 420,
    gameCreation: 1717800000000,
    gameDuration: 1800, // 30:00
    participants: [
      { puuid: PUUIDS.OURS, participantId: 1, teamId: 100, teamPosition: 'MIDDLE',
        championName: 'Ahri', win: true, kills: 8, deaths: 4, assists: 5,
        totalMinionsKilled: 180, neutralMinionsKilled: 20, visionScore: 18,
        totalDamageDealtToChampions: 25000, goldEarned: 13000 },
      { puuid: PUUIDS.MATE, participantId: 2, teamId: 100, teamPosition: 'BOTTOM',
        championName: 'Jinx', win: true, kills: 7, deaths: 2, assists: 10,
        totalMinionsKilled: 220, neutralMinionsKilled: 0, visionScore: 12,
        totalDamageDealtToChampions: 15000, goldEarned: 14000 },
      { puuid: PUUIDS.OPP, participantId: 6, teamId: 200, teamPosition: 'MIDDLE',
        championName: 'Zed', win: false, kills: 3, deaths: 6, assists: 2,
        totalMinionsKilled: 170, neutralMinionsKilled: 0, visionScore: 14,
        totalDamageDealtToChampions: 18000, goldEarned: 11000 },
      { puuid: PUUIDS.OPP2, participantId: 7, teamId: 200, teamPosition: 'BOTTOM',
        championName: 'Ezreal', win: false, kills: 4, deaths: 5, assists: 3,
        totalMinionsKilled: 200, neutralMinionsKilled: 0, visionScore: 10,
        totalDamageDealtToChampions: 16000, goldEarned: 12000 }
    ]
  }
};

// Build 15 frames (indices 0..14). Only 10 and 14 carry the numbers the tests check.
function frame(idx, data) {
  return { timestamp: idx * 60000, participantFrames: data || {} };
}
const timeline = {
  info: {
    frames: Array.from({ length: 15 }, (_, i) => {
      if (i === 10) return frame(10, {
        '1': { minionsKilled: 70, jungleMinionsKilled: 5, totalGold: 5000, xp: 6000 },
        '6': { minionsKilled: 65, jungleMinionsKilled: 0, totalGold: 4800, xp: 5800 }
      });
      if (i === 14) return frame(14, {
        '1': { minionsKilled: 110, jungleMinionsKilled: 8, totalGold: 7000, xp: 9000 },
        '6': { minionsKilled: 100, jungleMinionsKilled: 0, totalGold: 6900, xp: 8800 }
      });
      return frame(i);
    })
  }
};

module.exports = { match, timeline, PUUIDS };
