// pipeline/config.js — single source of truth for the data pipeline.
module.exports = {
  regional: 'europe',        // Account-V1 + Match-V5 routing
  platform: 'euw1',          // League-V4 routing
  rankedQueues: [420, 440],  // 420 = Ranked Solo/Duo, 440 = Ranked Flex
  firstRunCount: 30,         // games per queue to pull when a player has no file yet
  incrementalCount: 20,      // recent ids to check each subsequent run
  windowCap: 60,             // max games retained per player file
  players: [
    { name: 'Shabir',   file: 'shabir.json',   gameName: 'TribuIation',    tagLine: 'EUW' },
    { name: 'Harendra', file: 'harendra.json', gameName: 'Merkedi',        tagLine: 'Neru' },
    { name: 'Steven',   file: 'steven.json',   gameName: 'OrionVII',       tagLine: 'EUW' },
    { name: 'Eshantha', file: 'eshantha.json', gameName: 'Quiet Rapture',  tagLine: 'SKT' },
    { name: 'Geeth',    file: 'geeth.json',    gameName: 'Synister',       tagLine: 'ezclp' }
  ]
};
