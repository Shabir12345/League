/* ── Render helpers ── */
function el(h){const d=document.createElement('div');d.innerHTML=h;return d.firstElementChild;}
function icoURL(n){const a=API[n]||n.replace(/[^A-Za-z]/g,'');return`https://cdn.communitydragon.org/latest/champion/${a}/square`;}
function ico(n,cls){const init=n.replace(/[^A-Za-z]/g,'').slice(0,3).toUpperCase();
  return`<span class="champ-ico ${cls||''}"><img src="${icoURL(n)}" alt="${n}" onerror="this.style.display='none';this.parentNode.textContent='${init}'"></span>`;}
function wrColor(w){return w>=55?'var(--good)':w>=48?'var(--mid-wr)':'var(--bad)';}

/* ── Storage helpers ── */
const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
function safe(fn){try{fn()}catch(e){console.warn('CLASH HQ:',e)}}

/* ── Prep constants/vars ── */
const LS='clashhq_prep_v1';
let done={};
safe(()=>{done=JSON.parse(store.get(LS)||'{}')});
function renderPhases(){
  let total=0,d=0;
  document.getElementById('phases').innerHTML=PHASES.map((ph,pi)=>`
   <div class="phase ${pi<2?'open':''}">
     <div class="phase-head"><span class="phase-dot" style="background:${ph.c}"></span>
       <span class="phase-title">${ph.t}</span><span class="phase-when">${ph.w}</span></div>
     <div class="phase-body">${ph.tasks.map((t,ti)=>{const id=pi+'-'+ti;total++;if(done[id])d++;
       return`<div class="task ${done[id]?'done':''}" data-id="${id}"><span class="checkbox">✓</span><span class="task-txt">${t}</span></div>`;}).join('')}</div>
   </div>`).join('');
  document.querySelectorAll('.phase-head').forEach(h=>h.onclick=()=>h.parentNode.classList.toggle('open'));
  document.querySelectorAll('.task').forEach(t=>t.onclick=e=>{e.stopPropagation();const id=t.dataset.id;done[id]=!done[id];store.set(LS,JSON.stringify(done));renderPhases();});
  document.getElementById('progTxt').textContent=d+' / '+total;
  document.getElementById('progFill').style.width=(total?d/total*100:0)+'%';
}

/* ── Draft Lab ── */
const banned=new Set();
const POOL_BY_ROLE={};
COMPS.forEach(c=>c.roles.forEach(rr=>rr.k.forEach(k=>{
  (POOL_BY_ROLE[rr.r]=POOL_BY_ROLE[rr.r]||new Set()).add(k);
})));
const ROLE_ORDER=['Top','Jungle','Mid','ADC','Support'];
function renderBanpool(){
  document.getElementById('banpool').innerHTML=ROLE_ORDER.map(role=>{
    const champs=[...(POOL_BY_ROLE[role]||[])].sort();
    return`<div class="bp-role"><div class="bp-rlabel" style="color:${ROLE_C[role]}">${role}</div>
     <div class="chips">${champs.map(n=>`<div class="chip ${banned.has(n)?'banned':''}" data-c="${n}">${ico(n)}<span class="champ-nm-c">${n}</span></div>`).join('')}</div></div>`;
  }).join('');
  document.querySelectorAll('.chip').forEach(ch=>ch.onclick=()=>{const n=ch.dataset.c;banned.has(n)?banned.delete(n):banned.add(n);update();});
}
function update(){
  renderBanpool();
  document.getElementById('banN').textContent=banned.size;
  const res=COMPS.map(c=>{
    let fallbacks=0,broken=0;
    const picks=c.roles.map(rr=>{
      const avail=rr.k.find(k=>!banned.has(k));
      const isFb=avail&&avail!==rr.k[0];
      if(broken||avail){}
      if(!avail)broken++; else if(isFb)fallbacks++;
      return{role:rr.r,champ:avail,orig:rr.k[0],fb:isFb,dead:!avail};
    });
    let cls=broken?'broken':fallbacks?'fallback':'intact';
    return{c,picks,fallbacks,broken,cls};
  });
  document.getElementById('labResult').innerHTML=res.map(R=>`
   <div class="lc ${R.cls}">
     <div class="lc-badge" style="background:${R.c.color}"><span>${R.c.id[0].toUpperCase()}</span></div>
     <div><div class="lc-name">${R.c.name}</div><div class="lc-sub">${R.c.tag}</div>
       <div class="lc-picks">${R.picks.map(p=>`
         <span class="lc-pick ${p.dead?'dead':p.fb?'fb':''}">${p.champ?ico(p.champ):''}<span class="lc-pk-nm">${p.champ||p.role+' ✕'}</span></span>`).join('')}</div></div>
     <div class="lc-status ${R.cls}">${R.broken?'Broken':R.fallbacks?'Fallbacks':'Intact'}
       <small>${R.broken?R.broken+' role(s) dead':R.fallbacks?R.fallbacks+' backup pick(s)':'all primaries up'}</small></div>
   </div>`).join('');
}
document.getElementById('resetBans').onclick=()=>{banned.clear();update();};
document.querySelectorAll('[data-scn]').forEach(b=>b.onclick=()=>{
  banned.clear();
  const scn=b.dataset.scn;
  const sets={meta:['Malphite','Caitlyn','Rell','Viego','Annie'],engage:['Malphite','Rell','Wukong','Alistar','Annie']};
  (sets[scn]||[]).forEach(n=>banned.add(n));update();
});
safe(update);

/* ── Lineup ── */
document.getElementById('lineup').innerHTML=SEATS.map(s=>`
  <div class="seat"><div class="role" style="color:${ROLE_C[s[0]]}">${s[0]}</div>
  <div class="who">${s[1]}</div><div class="hdl">${s[2]}</div>
  <span class="bar" style="background:${ROLE_C[s[0]]}"></span></div>`).join('');

/* ── Roster ── */
document.getElementById('rosterGrid').innerHTML=PLAYERS.map(p=>`
 <div class="panel player">
   <div class="phead">
     <div class="pavatar" style="background:${ROLE_C[p.roles[0]]}"><span>${p.init}</span></div>
     <div><div class="pname">${p.name}</div><div class="phandle">${p.handle}</div></div>
     <div class="prank"><div class="r" style="color:var(--gold-bright)">${p.rank}</div><div class="l">Solo Queue</div></div>
   </div>
   <div class="roles-mini">${p.roles.map(r=>`<span class="rolepill" style="background:${ROLE_C[r]}">${r}</span>`).join('')}
     <span class="rolepill" style="background:transparent;border:1px solid var(--gold);color:var(--gold)">Clash: ${p.clash}</span></div>
   <div style="font-size:13px;color:var(--txt-dim);margin-top:8px">${p.note}</div>
   <div class="pool">${p.pool.map(c=>`
     <div class="champ-row">${ico(c[0])}<span class="champ-nm">${c[0]}</span>
     <span class="champ-gm">${c[1]}g</span>
     <span class="wrbar"><i style="width:${c[2]}%;background:${wrColor(c[2])}"></i></span>
     <span class="wrnum" style="color:${wrColor(c[2])}">${c[2]}%</span></div>`).join('')}</div>
   <div class="expand-hint">▾ tap for champ pool</div>
   <div class="pf-link" data-pf="${p.name}">View data profile →</div>
 </div>`).join('');
document.querySelectorAll('.player').forEach(p=>p.onclick=()=>p.classList.toggle('open'));
document.querySelectorAll('.pf-link').forEach(l=>l.addEventListener('click',e=>{ e.stopPropagation(); openProfile(l.dataset.pf); }));

/* ── Comps ── */
document.getElementById('compList').innerHTML=COMPS.map(c=>`
 <div class="panel comp">
   <div class="comp-head">
     <div class="comp-badge" style="background:${c.color}"><span>${c.id[0].toUpperCase()}</span></div>
     <div><div class="comp-name">${c.name}</div><div class="comp-id">${c.tag}</div></div>
     <div class="comp-tier tier-${c.tier}">${c.tier}</div>
   </div>
   <div class="comp-roles">${c.roles.map(rr=>`
     <div class="cr"><div class="crole" style="color:${ROLE_C[rr.r]}">${rr.r} · ${rr.p}</div>
       <div class="cpick">${ico(rr.k[0])}<div><div class="cchamp">${rr.k[0]}</div></div></div>
       <div class="cbackup"><b>↳</b> ${rr.k.slice(1).join(', ')||'—'}</div></div>`).join('')}</div>
   <div class="cm-plain">👉 <b>In plain English:</b> ${PLAIN[c.id]}</div>
   <div class="comp-meta">
     <div class="cm-row cm-win"><span class="ic">Win Con</span><span>${c.win}</span></div>
     <div class="cm-row cm-spike"><span class="ic">Power Spike</span><span>${c.spike}</span></div>
     <div class="cm-row cm-lose"><span class="ic">Loses To</span><span>${c.lose}</span></div>
   </div>
 </div>`).join('');

/* ── Meta tier table ── */
document.getElementById('tierBody').innerHTML=TIERS.map(t=>`<tr>
  <td class="role-cell" style="color:${ROLE_C[t[0]]}">${t[0]}</td>
  <td>${t[1].split(', ').map(c=>`<span class="mini-champ">${c}</span>`).join('')}</td>
  <td style="color:var(--txt-dim)">${t[2]}</td>
  <td class="ours">${t[3]}</td></tr>`).join('');

/* ── Start Here: planDo / planDont / jobsGrid / glossary ── */
document.getElementById('planDo').innerHTML=GAMEPLAN_DO.map((s,i)=>`
 <div class="step"><span class="step-n">${i+1}</span><span class="step-txt"><b>${s[0]}.</b> ${s[1]}</span></div>`).join('');
document.getElementById('planDont').innerHTML=GAMEPLAN_DONT.map(t=>`
 <div class="step"><span class="step-x">✕</span><span class="step-txt">${t}</span></div>`).join('');

document.getElementById('jobsGrid').innerHTML=ORDER5.map(name=>{
 const p=PLAYERS.find(x=>x.name===name),j=JOBS[name],col=ROLE_C[p.clash];
 const init=j.main.replace(/[^A-Za-z]/g,'').slice(0,3).toUpperCase();
 return`<div class="panel jobcard"><span class="jc-bar" style="background:${col}"></span>
   <div class="jc-top"><div class="jc-ico"><img src="${icoURL(j.main)}" alt="${j.main}" onerror="this.parentNode.textContent='${init}'"></div>
     <div><div class="jc-name">${name}</div><div class="jc-role" style="color:${col}">${j.role}</div></div></div>
   <div class="jc-main">🎯 Main champ to play: <b>${j.main}</b></div>
   <div class="jc-label">In a fight, your job is:</div>
   <div class="jc-fight">${j.fight}</div>
   <div class="jc-label" style="margin-top:14px">Practice this:</div>
   <div class="jc-practice">${j.practice}</div></div>`;
}).join('');

document.getElementById('glossary').innerHTML=GLOSSARY.map(g=>`
 <div class="gloss"><span class="word">${g[0]}</span><span class="def">${g[1]}</span></div>`).join('');

safe(renderPhases);

/* ── Analysis ── */
function renderAnalysis(){
  if(!DAILY_LOG.length){
    document.getElementById('anBriefing').innerHTML='<div class="panel"><div class="an-headline">No games logged yet.</div></div>';
    return;
  }
  const latest=DAILY_LOG[DAILY_LOG.length-1];
  const day={w:latest.games.filter(g=>g.result==='W').length,l:latest.games.filter(g=>g.result==='L').length};
  document.getElementById('anBriefing').innerHTML=
   `<div class="panel"><div class="sec-title" style="margin-bottom:10px">Latest Briefing <span class="n">// ${latest.date}</span></div>
     <div class="an-record">${day.w}W – ${day.l}L</div>
     <div class="an-headline" style="margin-top:8px">${latest.headline}</div></div>`;

  const o=overallRecord(DAILY_LOG);
  const pips=formGuide(DAILY_LOG,8).map(r=>`<span class="pip ${r}">${r}</span>`).join('');
  const days=dayRecords(DAILY_LOG);
  const maxG=Math.max(1,...days.map(d=>d.w+d.l));
  const bars=days.map(d=>{
    const wh=Math.round(d.w/maxG*70), lh=Math.round(d.l/maxG*70);
    return `<div class="day-bar"><div class="bar2"><i class="bl" style="height:${lh}px"></i><i class="bw" style="height:${wh}px"></i></div>${d.date.slice(5)}</div>`;
  }).join('');
  document.getElementById('anForm').innerHTML=
   `<div class="an-flex">
      <div><div class="wr-big">${Math.round(o.winrate*100)}%</div><div class="pf-stat">${o.w}W – ${o.l}L · ${o.games} games</div></div>
      <div><div class="pf-stat">Recent form</div><div class="form-pips">${pips||'<span class="pf-stat">—</span>'}</div></div>
    </div>
    <div class="day-bars">${bars}</div>`;

  const recs=compRecords(DAILY_LOG);
  document.getElementById('anLedger').innerHTML=COMPS.map(c=>{
    const r=recs[c.id]||{w:0,l:0}; const n=r.w+r.l; const v=verdictFor(r);
    const wpct=n?r.w/n*100:0, lpct=n?r.l/n*100:0;
    return `<div class="ledger-row">
      <div class="comp-badge" style="background:${c.color};width:34px;height:34px;font-size:16px"><span>${c.id[0].toUpperCase()}</span></div>
      <div><div class="lc-name">${c.name} <span class="src-tag">· ${c.source}${c.status==='proposed'?' · proposed':''}</span></div>
        <div class="an-record" style="margin:4px 0">${r.w}W – ${r.l}L</div>
        <div class="ledger-bar"><i class="lw" style="width:${wpct}%"></i><i class="ll" style="width:${lpct}%"></i></div></div>
      <div class="verdict v-${v}">${v}</div></div>`;
  }).join('');

  document.getElementById('anPlayers').innerHTML=ORDER5.map(name=>{
    const pf=playerForm(DAILY_LOG,name);
    if(!pf) return `<div class="panel pf-card"><div class="pf-champ">${name}</div><div class="pf-stat">No games.</div></div>`;
    const L=pf.latest;
    const arrow=pf.trend==='up'?'▲':pf.trend==='down'?'▼':'—';
    return `<div class="panel pf-card">
      <div style="display:flex;align-items:center;gap:10px">${ico(L.champ)}
        <div><div class="pf-champ">${name}</div><div class="pf-stat">${L.champ} · ${L.result}</div></div>
        <div class="trend-${pf.trend}" style="margin-left:auto;font-size:18px">${arrow}</div></div>
      <div class="pf-stat" style="margin-top:10px">${L.k}/${L.d}/${L.a} · ${L.kda.toFixed(1)} KDA${L.csm?` · ${L.csm} CS/m`:''}${L.kp?` · ${L.kp}% KP`:''}</div>
    </div>`;
  }).join('');

  const FLS='clashhq_focus_v1';
  let fdone={}; safe(()=>{fdone=JSON.parse(store.get(FLS)||'{}')});
  document.getElementById('anFocus').innerHTML=[...FOCUS].sort((a,b)=>a.priority-b.priority).map(f=>`
    <div class="task ${fdone[f.id]?'done':''}" data-fid="${f.id}"><span class="checkbox">✓</span>
      <span class="task-txt"><b>${f.title}.</b> <span style="color:var(--txt-faint)">${f.why}</span></span></div>`).join('');
  document.querySelectorAll('[data-fid]').forEach(t=>t.onclick=()=>{const id=t.dataset.fid;fdone[id]=!fdone[id];store.set(FLS,JSON.stringify(fdone));t.classList.toggle('done');});

  document.getElementById('anLog').innerHTML=[...DAILY_LOG].reverse().map((d,i)=>{
    const w=d.games.filter(g=>g.result==='W').length,l=d.games.filter(g=>g.result==='L').length;
    const games=d.games.map(g=>`
      <div class="task" style="cursor:default"><span class="task-txt"><b style="color:${g.result==='W'?'var(--good)':'var(--red)'}">${g.result}</b>
        · ${g.dur} · ${g.lineup.map(p=>p.champ).join(' / ')}
        ${g.note?`<span class="why" style="display:block;font-size:12px;color:var(--txt-faint);margin-top:2px">${g.note}</span>`:''}</span></div>`).join('');
    return `<div class="phase ${i===0?'open':''}"><div class="phase-head"><span class="phase-dot" style="background:var(--gold)"></span>
        <span class="phase-title">${d.date}</span><span class="phase-when">${w}W – ${l}L</span></div>
      <div class="phase-body">${games}</div></div>`;
  }).join('');
  document.querySelectorAll('#anLog .phase-head').forEach(h=>h.onclick=()=>h.parentNode.classList.toggle('open'));
}
safe(renderAnalysis);

/* ── Profiles ── */
const PROFILE_FILES = { Harendra:'harendra', Geeth:'geeth', Steven:'steven', Shabir:'shabir', Eshantha:'eshantha' };
let PROFILES = null;            // { Harendra:{json}|null, ... } once a load attempt finishes
let profilesLoading = false;
let profileState = { player:null, side:'soloFlex' };  // side: 'soloFlex' | 'fiveStack'

function relTime(ts){
  const s = Math.floor((Date.now()-ts)/1000);
  if(s<60) return 'just now';
  const m = Math.floor(s/60); if(m<60) return m+'m ago';
  const h = Math.floor(m/60); if(h<24) return h+'h ago';
  return Math.floor(h/24)+'d ago';
}
function diffColor(v){ return v>0?'var(--good)':v<0?'var(--bad)':'var(--txt-dim)'; }

function loadProfiles(){
  if(PROFILES || profilesLoading){ renderProfiles(); return; }
  profilesLoading = true;
  renderProfiles();               // show loading state
  Promise.allSettled(ORDER5.map(name =>
    fetch(`data/players/${PROFILE_FILES[name]}.json`)
      .then(r => { if(!r.ok) throw new Error(r.status); return r.json(); })
  )).then(results => {
    PROFILES = {};
    ORDER5.forEach((name,i) => { PROFILES[name] = results[i].status==='fulfilled' ? results[i].value : null; });
    profilesLoading = false;
    renderProfiles();
  });
}

function renderProfiles(){
  const root = document.getElementById('profiles');
  if(!PROFILES && profilesLoading){
    root.innerHTML = `<div class="sec-title">Player Profiles</div><div class="panel"><div class="an-headline">Loading live player data…</div></div>`;
    return;
  }
  if(!PROFILES) return;           // tab never opened yet
  if(profileState.player) renderPlayerPage(profileState.player);
  else renderProfilesOverview();
}

function renderProfilesOverview(){
  const loaded = ORDER5.filter(n => PROFILES[n]);
  if(!loaded.length){
    document.getElementById('profiles').innerHTML =
      `<div class="sec-title">Player Profiles</div>
       <div class="panel"><div class="an-headline">Profiles need to load online once. Connect to the internet and reopen this tab.</div></div>`;
    return;
  }
  const oldest = Math.min(...loaded.map(n => new Date(PROFILES[n].generatedAt).getTime()));
  const cards = ORDER5.map(name => {
    const d = PROFILES[name];
    if(!d) return `<div class="panel pf-ov err">${name} — couldn't load data. Check connection.</div>`;
    const top  = (d.soloFlex.champPool||[])[0];
    const role = (d.soloFlex.roleSplits||[])[0];
    const pips = (d.soloFlex.form||[]).map(r => `<span class="pip ${r}">${r}</span>`).join('');
    return `<div class="panel pf-ov" data-player="${name}">
      <div class="pf-ov-head">
        ${top?ico(top.champ):''}
        <div><div class="pf-ov-name">${name}</div>
          <div class="pf-ov-rank">${d.rank.solo||'Unranked'}${d.rank.flex?` · ${d.rank.flex} (flex)`:''}</div></div>
        ${role?`<div class="pf-ov-role" style="color:${ROLE_C[role.role]||'var(--gold)'}">${role.role}</div>`:''}
      </div>
      ${top?`<div class="pf-ov-main">Main: <b>${top.champ}</b> · <span style="color:${wrColor(top.wr)}">${top.wr}% WR</span> · ${top.games} gms</div>`:''}
      <div class="form-pips">${pips}</div>
    </div>`;
  }).join('');
  document.getElementById('profiles').innerHTML =
    `<div class="sec-title">Player Profiles <span class="n">// tap a player · live from Riot</span></div>
     <div class="grid g3">${cards}</div>
     <div class="pf-updated">Updated ${relTime(oldest)}</div>`;
  document.querySelectorAll('#profiles [data-player]').forEach(c => c.onclick = () => {
    profileState.player = c.dataset.player; profileState.side = 'soloFlex';
    renderProfiles(); window.scrollTo({ top:0, behavior:'smooth' });
  });
}

function renderPlayerPage(name){
  const root = document.getElementById('profiles');
  const d = PROFILES[name];
  const backHTML = `<div class="pf-back" id="pfBack">‹ Profiles</div>`;
  if(!d){
    root.innerHTML = backHTML + `<div class="panel"><div class="an-headline">Couldn't load ${name}'s data. Check your connection and reopen.</div></div>`;
    document.getElementById('pfBack').onclick = backToOverview;
    return;
  }
  const side  = profileState.side;                 // 'soloFlex' | 'fiveStack'
  const agg   = d[side] || { champPool:[], roleSplits:[], form:[] };
  const games = (d.games||[]).filter(g => side==='fiveStack' ? g.fiveStack : !g.fiveStack);
  const pool  = [...(agg.champPool||[])].sort((a,b)=>b.games-a.games);
  const empty = !pool.length && !games.length;

  const pips = (agg.form||[]).map(r => `<span class="pip ${r}">${r}</span>`).join('') || '<span class="pf-empty">—</span>';

  const poolHTML = pool.length ? pool.map(c => `
    <div class="pf-cp-row">${ico(c.champ)}<span class="pf-cp-nm">${c.champ}</span>
      <span class="pf-cp-g">${c.games}g</span>
      <span class="pf-cp-wr" style="color:${wrColor(c.wr)}">${c.wr}%</span>
      <span class="pf-cp-kda">${c.kda} KDA</span>
      <span class="pf-cp-cs">${c.csm} CS/m</span>
      <span class="pf-cp-d" style="color:${diffColor(c.csDiff10)}">${fmtDiff(c.csDiff10,{dec:1})} CSΔ10</span></div>`).join('')
    : `<div class="pf-empty">No ${side==='fiveStack'?'5-stack':'solo/flex'} champ data yet.</div>`;

  const la = laneAggregate(games);
  const laneCell = (k, v) => `<div class="lane-cell"><div class="lane-k">${k}</div><div class="lane-v">${v}</div></div>`;
  const laneHTML = games.length ? `<div class="pf-lane">
      ${laneCell('CS @10', la.csAt10!=null?la.csAt10.toFixed(0):'—')}
      ${laneCell('CSΔ @10', `<span style="color:${diffColor(la.csDiff10)}">${fmtDiff(la.csDiff10,{dec:1})}</span>`)}
      ${laneCell('CSΔ @14', `<span style="color:${diffColor(la.csDiff14)}">${fmtDiff(la.csDiff14,{dec:1})}</span>`)}
      ${laneCell('GoldΔ @10', `<span style="color:${diffColor(la.goldDiff10)}">${fmtDiff(la.goldDiff10,{k:true})}</span>`)}
      ${laneCell('GoldΔ @14', `<span style="color:${diffColor(la.goldDiff14)}">${fmtDiff(la.goldDiff14,{k:true})}</span>`)}
    </div><div class="pf-lane-n">Averages over ${la.n} game${la.n===1?'':'s'} vs lane opponent.</div>`
    : `<div class="pf-empty">No ${side==='fiveStack'?'5-stack':'solo/flex'} games to measure.</div>`;

  const rolesHTML = (agg.roleSplits||[]).length
    ? `<div class="pf-roles">${agg.roleSplits.map(r=>`${r.role} ${r.games}g <span style="color:${wrColor(r.wr)}">${r.wr}%</span>`).join('  ·  ')}</div>`
    : `<div class="pf-empty">No role data yet.</div>`;

  const gamesHTML = games.length ? games.slice(0,20).map(g => `
    <div class="pf-gm">
      <b class="${g.win?'gm-w':'gm-l'}">${g.win?'W':'L'}</b>
      ${ico(g.champ)}<span class="pf-gm-nm">${g.champ}</span>
      <span class="pf-gm-kda">${g.k}/${g.d}/${g.a}</span>
      <span class="pf-gm-cs">${g.csm} cs/m</span>
      <span class="pf-gm-kp">${g.kp}% KP</span>
      <span class="pf-gm-d" style="color:${diffColor(g.csDiff10)}">${fmtDiff(g.csDiff10,{dec:0})} csΔ10</span>
    </div>`).join('')
    : `<div class="pf-empty">No ${side==='fiveStack'?'5-stack':'solo/flex'} games yet.</div>`;

  root.innerHTML = backHTML + `
    <div class="pf-hero">
      <div class="pf-hero-name">${name}</div>
      <div class="pf-toggle">
        <button class="pf-tg ${side==='soloFlex'?'on':''}" data-side="soloFlex">Solo/Flex</button>
        <button class="pf-tg ${side==='fiveStack'?'on':''}" data-side="fiveStack">5-Stack</button>
      </div>
    </div>
    <div class="pf-subline">
      <span>${d.rank.solo||'Unranked'} (Solo)${d.rank.flex?` · ${d.rank.flex} (Flex)`:''}</span>
      <span class="form-pips" style="margin:0">${pips}</span>
      <span style="color:var(--txt-faint)">Updated ${relTime(new Date(d.generatedAt).getTime())}</span>
    </div>
    ${empty ? `<div class="panel"><div class="pf-empty">No ${side==='fiveStack'?'5-stack':'solo/flex'} games for ${name} yet.</div></div>` : `
    <div class="sec-title" style="margin-top:6px">Champ Pool <span class="n">// real win rate</span></div>
    <div class="panel" style="margin-bottom:8px">${poolHTML}</div>
    <div class="sec-title" style="margin-top:22px">Lane / Early Game <span class="n">// vs lane opponent</span></div>
    <div class="panel" style="margin-bottom:8px">${laneHTML}</div>
    <div class="sec-title" style="margin-top:22px">Role Split</div>
    <div class="panel" style="margin-bottom:8px">${rolesHTML}</div>
    <div class="sec-title" style="margin-top:22px">Game-by-Game <span class="n">// recent</span></div>
    <div class="panel">${gamesHTML}</div>`}
  `;

  document.getElementById('pfBack').onclick = backToOverview;
  document.querySelectorAll('#profiles .pf-tg').forEach(b => b.onclick = () => {
    profileState.side = b.dataset.side; renderProfiles();
  });
}

function backToOverview(){ profileState.player = null; renderProfiles(); window.scrollTo({ top:0, behavior:'smooth' }); }

function openProfile(name){
  profileState.player = name; profileState.side = 'soloFlex';
  showView('profiles'); loadProfiles();
}
