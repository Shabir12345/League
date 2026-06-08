// Pure, dependency-free. Works as a browser global AND a Node module (mirrors analysis-core.js).
(function (root) {
  const LANE_FIELDS = ['csAt10', 'csDiff10', 'csDiff14', 'goldDiff10', 'goldDiff14'];

  function laneAggregate(games) {
    const out = { n: games.length };
    LANE_FIELDS.forEach(f => {
      const vals = games.map(g => g[f]).filter(v => typeof v === 'number' && !isNaN(v));
      out[f] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    });
    return out;
  }

  function recordOf(games) {
    const w = games.filter(g => g.win).length;
    const l = games.filter(g => !g.win).length;
    const n = w + l;
    return { w, l, games: n, winrate: n ? w / n : 0 };
  }

  function splitByStack(games) {
    return { solo: games.filter(g => !g.fiveStack), five: games.filter(g => g.fiveStack) };
  }

  function fmtDiff(v, opts) {
    opts = opts || {};
    if (v == null || isNaN(v)) return '—';
    const sign = v > 0 ? '+' : v < 0 ? '-' : '';
    const abs = Math.abs(v);
    let body;
    if (opts.k && abs >= 1000) body = (abs / 1000).toFixed(1) + 'k';
    else if (opts.dec != null) body = abs.toFixed(opts.dec);
    else body = String(Math.round(abs));
    return sign + body;
  }

  const api = { laneAggregate, recordOf, splitByStack, fmtDiff };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api); // expose as globals in the browser
})(typeof window !== 'undefined' ? window : globalThis);
