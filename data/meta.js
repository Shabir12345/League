const TIERS=[
 ['Top','Malphite, Sion, Garen, Renekton','Kayle, Yone, K\'Sante','Malphite, Shen, Sion, Maokai'],
 ['Jungle','Nocturne, Briar, Master Yi, Viego','Wukong, Vi, Lee Sin, Shyvana','Viego, Briar, Nocturne, Kha\'Zix, Shen, Maokai'],
 ['Mid','Yasuo, Zed, Galio, Annie','Orianna, Fizz, Xerath, Veigar','Annie, LeBlanc, Lux, Orianna, Galio'],
 ['ADC','Caitlyn, Jinx, Ashe','Ezreal, Smolder, Senna, Kai\'Sa','Caitlyn, Jinx, Kalista'],
 ['Support','Rell, Leona, Seraphine, Morgana','Taric, Thresh, Nautilus, Braum','Rell, Alistar, Morgana, Seraphine']
];

const PHASES=[
 {t:'Phase 1 — Lock #1 Champs',w:'Jun 5–9',c:'#3fb950',tasks:['<b>Harendra</b> → Malphite (the keystone — top priority)','<b>Shabir</b> → Caitlyn','<b>Eshantha</b> → Rell','<b>Steven</b> → Annie','<b>Geeth</b> → Viego + start Wukong','First 5-man flex game on voice']},
 {t:'Phase 2 — Add #2 + Rehearse Engage',w:'Jun 10–14',c:'#e6c34a',tasks:['Add #2: Sion / Ashe / Alistar / Orianna / Vi','Scrim <b>Comp A (Wombo)</b> ×2','Practice the engage chain + calling one target','Engage from fog/flanks drills']},
 {t:'Phase 3 — Comps + Mock Drafts',w:'Jun 15–18',c:'#f0b232',tasks:['Scrim <b>Comp B (Pick)</b>','Scrim <b>Comp C (Front-to-Back)</b>','2 mock drafts with the Draft Lab','Decide the final 3 comps we trust']},
 {t:'Phase 4 — Taper + Prep',w:'Jun 19',c:'#4b9cff',tasks:['One light mock draft — no new champs','Everyone confirms #1 + #2 per role','Re-check meta for a new patch','Logistics: all 5 available + comms working']},
 {t:'🏆 Clash Day',w:'Jun 20',c:'#c8aa6e',tasks:['Scout opponents → call comp + bans','Open the Draft Lab during every draft','Default bans: Malphite / Master Yi / Smolder','Group mid-game, fight on our terms, don\'t throw']}
];

const GAMEPLAN_DO=[
 ['Stick together','Once it\'s mid-game (~15 min), walk around as a <b>group of 5</b>. Never wander off alone.'],
 ['Start fights together','<b>Harendra and Eshantha go in FIRST.</b> The second they engage, everyone else jumps in too — instantly.'],
 ['Kill ONE person','Everyone attacks the <b>same enemy</b> — usually their ADC or mid. Call the name out loud on voice.'],
 ['Take the prize','After you win the fight, <b>take Baron, Dragon, or towers.</b> That\'s what actually wins — then close the game.']
];
const GAMEPLAN_DONT=[
 'Don\'t fight 1v1 or 2v2 — <b>wait for the team.</b>',
 'Don\'t chase kills into the enemy base. You\'ll die.',
 'Don\'t split up to push different lanes (for now).',
 'Don\'t throw a lead — <b>when ahead, play safe</b> and take objectives.'
];
const JOBS={
 Harendra:{role:'Top Lane · TANK',main:'Malphite',
   fight:'You go <b>IN FIRST.</b> Walk up and press <b>R (ult)</b> onto as many enemies as you can to start the fight. You\'re the tank — you soak damage, you\'re not here for kills.',
   practice:'Play <b>Malphite, Sion, and Shen.</b> <b>Maokai</b> is a fine 4th engage-tank option (R is a teamfight-wide root). Drop the other 30 champs.'},
 Geeth:{role:'Jungle · SHOTCALLER',main:'Viego',
   fight:'Gank lanes, take <b>Dragon/Baron</b>, and clean up fights (finish off low-HP enemies). You\'re the best player — <b>make the calls.</b>',
   practice:'<b>Viego</b> is your main. Also learn <b>Wukong</b> for a strong fight-starting ult. <b>Shen</b> (83%) and <b>Maokai</b> (67%) are ready-made tank/engage junglers you already win on.'},
 Steven:{role:'Mid Lane',main:'Annie',
   fight:'Keep your stun ready (<b>Annie\'s shield turns white</b> at 4 stacks). When the fight starts, <b>Flash in + ult Tibbers</b> to stun the whole enemy team.',
   practice:'<b>Annie</b> first, then Orianna and Galio. Don\'t play Yasuo in Clash.'},
 Shabir:{role:'ADC · Bot Lane',main:'Caitlyn',
   fight:'Stand at the <b>BACK</b> and shoot from far away. <b>Never walk in first.</b> Let the tanks start the fight, then you deal the damage safely.',
   practice:'Play <b>Caitlyn</b> until she feels easy. Add Ashe as backup.'},
 Eshantha:{role:'Support · FIGHT STARTER',main:'Rell',
   fight:'You + Harendra <b>start the fights.</b> Jump in and lock enemies down with your engage. Then <b>protect Shabir</b> if enemies try to kill him.',
   practice:'<b>Rell</b> is #1, then Alistar. Both are easy to start fights with.'}
};
const GLOSSARY=[
 ['Engage','Starting the fight by jumping in. Tanks & support do this first.'],
 ['Peel','Protecting your ADC by blocking/stunning enemies that jump on them.'],
 ['Carry','The player who deals the most damage (ADC or mid). Keep them alive.'],
 ['Frontline','The tanks who stand in front and take the damage.'],
 ['Poke','Chipping the enemy\'s health from far away before a fight starts.'],
 ['CC','Stuns, slows, knock-ups — anything that stops an enemy from moving.'],
 ['Objective','Dragon, Baron, Towers. The stuff that actually wins the game.'],
 ['Spike','The moment your champ suddenly gets strong (a key item or level).'],
 ['Wave / minions','The little soldiers. Killing them = gold (called "farm" / "CS").'],
 ['Splitpush','One person pushing a side lane alone. We mostly DON\'T do this.']
];
