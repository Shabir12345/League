const test = require('node:test');
const assert = require('node:assert');
const C = require('../js/analysis-core.js');

const LOG = [
  { date:'2026-06-06', games:[
    { result:'L', comp:'wombo', lineup:[{role:'ADC',player:'Shabir',champ:'Caitlyn',k:10,d:7,a:5,csm:8.1,kp:47}] },
    { result:'W', comp:'control', lineup:[{role:'ADC',player:'Shabir',champ:'Caitlyn',k:14,d:5,a:14,csm:7.4,kp:61}] },
    { result:'L', comp:'ftb', lineup:[{role:'ADC',player:'Shabir',champ:'Caitlyn',k:4,d:7,a:3,csm:6.0,kp:64}] }
  ]}
];

test('overallRecord counts wins and losses', () => {
  assert.deepStrictEqual(C.overallRecord(LOG), { w:1, l:2, games:3, winrate:1/3 });
});

test('compRecords groups by comp id', () => {
  const r = C.compRecords(LOG);
  assert.deepStrictEqual(r.wombo, { w:0, l:1 });
  assert.deepStrictEqual(r.control, { w:1, l:0 });
});

test('verdictFor applies thresholds', () => {
  assert.strictEqual(C.verdictFor({ w:0, l:0 }), 'Untested');
  assert.strictEqual(C.verdictFor({ w:3, l:0 }), 'Proven');
  assert.strictEqual(C.verdictFor({ w:0, l:3 }), 'Underperforming');
  assert.strictEqual(C.verdictFor({ w:1, l:1 }), 'Testing');
});

test('formGuide returns most-recent-first W/L', () => {
  assert.deepStrictEqual(C.formGuide(LOG, 3), ['L','W','L']);
});

test('playerForm returns latest and trend for a player', () => {
  const pf = C.playerForm(LOG, 'Shabir');
  assert.strictEqual(pf.latest.champ, 'Caitlyn');
  assert.strictEqual(pf.latest.kda, (4+3)/7);
  assert.ok(pf.trend === 'down');
});
