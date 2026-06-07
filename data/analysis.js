/* Daily Analysis data — edited each day after scanning dpm.lol.
   Records, winrate, verdicts, form are all DERIVED from DAILY_LOG by js/analysis-core.js.
   Supports show vision score on dpm (not CS/m), so their csm is left 0 (the UI hides it). */
const DAILY_LOG = [
  {
    date: '2026-06-06',
    headline: '1–2 on comp tests. The one win was the grouped Viego/Orianna/Caitlyn fight (61% KP, Rell MVP); both losses came from low KP or losing the early game.',
    games: [
      { dur:'32:34', queue:'Flex', result:'L', comp:'wombo',
        note:'Wombo (Malphite/Wukong/Annie engage). Low team KP (38–47%) — fought spread out, the engage never connected.',
        lineup:[
          {role:'Top',player:'Harendra',champ:'Malphite',k:8,d:6,a:4,csm:6.0,kp:38},
          {role:'Jungle',player:'Geeth',champ:'Wukong',k:7,d:5,a:10,csm:5.2,kp:53},
          {role:'Mid',player:'Steven',champ:'Annie',k:6,d:6,a:7,csm:3.7,kp:41},
          {role:'ADC',player:'Shabir',champ:'Caitlyn',k:10,d:7,a:5,csm:8.1,kp:47},
          {role:'Support',player:'Eshantha',champ:'Rell',k:1,d:8,a:20,csm:0,kp:66}
        ]},
      { dur:'33:48', queue:'Flex', result:'W', comp:'control',
        note:'Control hybrid (Shen top + Rell engage, Viego/Orianna/Caitlyn core). Grouped 5-man fights, three fed carries, 61% KP. Rell MVP.',
        lineup:[
          {role:'Top',player:'Harendra',champ:'Shen',k:5,d:5,a:12,csm:4.5,kp:37},
          {role:'Jungle',player:'Geeth',champ:'Viego',k:13,d:3,a:9,csm:6.8,kp:48},
          {role:'Mid',player:'Steven',champ:'Orianna',k:12,d:1,a:14,csm:6.1,kp:57},
          {role:'ADC',player:'Shabir',champ:'Caitlyn',k:14,d:5,a:14,csm:7.4,kp:61},
          {role:'Support',player:'Eshantha',champ:'Rell',k:2,d:5,a:32,csm:0,kp:74}
        ]},
      { dur:'24:26', queue:'Flex', result:'L', comp:'ftb',
        note:'Front-to-Back (Sion/Alistar double tank). 24-min stomp — lost the early game, the scaling teamfight comp never came online.',
        lineup:[
          {role:'Top',player:'Harendra',champ:'Sion',k:1,d:7,a:3,csm:8.3,kp:36},
          {role:'Jungle',player:'Geeth',champ:'Viego',k:4,d:7,a:6,csm:5.7,kp:91},
          {role:'Mid',player:'Steven',champ:'Orianna',k:1,d:3,a:3,csm:7.1,kp:36},
          {role:'ADC',player:'Shabir',champ:'Caitlyn',k:4,d:7,a:3,csm:6.0,kp:64},
          {role:'Support',player:'Eshantha',champ:'Alistar',k:1,d:8,a:8,csm:0,kp:82}
        ]}
    ]
  }
];

const FOCUS = [
  { id:'kp', priority:1, status:'open', title:'Group by ~14 min and fight as 5',
    why:'Both losses had low kill participation; the win had 61% KP. Stop fighting spread out.' },
  { id:'early', priority:2, status:'open', title:'Stabilise the early game',
    why:'The 24-min loss was decided before our teamfight spike — don’t fall behind pre-14.' },
  { id:'engagesup', priority:3, status:'open', title:'Default to Rell over Alistar as primary engage',
    why:'The win ran Rell (MVP); the harder loss ran Alistar and the early game wasn’t rescued.' },
  { id:'mid', priority:4, status:'open', title:'Prefer Orianna over Annie mid',
    why:'Orianna (12/1/14) was on the winning side; Shockwave is a more reliable teamfight button for us than Annie all-in.' }
];
