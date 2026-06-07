// Pure, dependency-free. Works as a browser global AND a Node module.
(function (root) {
  const flatGames = log => log.flatMap(d => d.games.map(g => ({ ...g, date: d.date })));

  function overallRecord(log) {
    const g = flatGames(log);
    const w = g.filter(x => x.result === 'W').length;
    const l = g.filter(x => x.result === 'L').length;
    const games = w + l;
    return { w, l, games, winrate: games ? w / games : 0 };
  }

  function compRecords(log) {
    const out = {};
    flatGames(log).forEach(x => {
      const r = (out[x.comp] = out[x.comp] || { w: 0, l: 0 });
      if (x.result === 'W') r.w++; else if (x.result === 'L') r.l++;
    });
    return out;
  }

  function verdictFor(rec) {
    const w = rec ? rec.w : 0, l = rec ? rec.l : 0, n = w + l;
    if (n === 0) return 'Untested';
    if (n < 3) return 'Testing';
    const wr = w / n;
    if (wr >= 0.6) return 'Proven';
    if (wr < 0.4) return 'Underperforming';
    return 'Testing';
  }

  function formGuide(log, n) {
    return flatGames(log).map(x => x.result).reverse().slice(0, n);
  }

  function dayRecords(log) {
    return log.map(d => ({
      date: d.date,
      w: d.games.filter(g => g.result === 'W').length,
      l: d.games.filter(g => g.result === 'L').length
    }));
  }

  const kdaOf = r => (r.k + r.a) / Math.max(r.d, 1);

  function playerForm(log, player) {
    const outings = flatGames(log)
      .map(g => ({ g, row: g.lineup.find(p => p.player === player) }))
      .filter(x => x.row)
      .map(x => ({ ...x.row, result: x.g.result, date: x.g.date }));
    if (!outings.length) return null;
    const latest = outings[outings.length - 1];
    const prior = outings.length > 1 ? outings[outings.length - 2] : null;
    const lk = kdaOf(latest);
    const trend = !prior ? 'flat' : lk > kdaOf(prior) + 0.2 ? 'up'
                : lk < kdaOf(prior) - 0.2 ? 'down' : 'flat';
    return { latest: { ...latest, kda: lk }, prior, trend, count: outings.length };
  }

  const api = { overallRecord, compRecords, verdictFor, formGuide, dayRecords, playerForm, kdaOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof window !== 'undefined' ? window : globalThis);
