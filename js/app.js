/* ── Navigation ── */
function showView(v){
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.v===v));
  document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x.id===v));
  window.scrollTo({top:0,behavior:'smooth'});
}
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{
  showView(t.dataset.v);
  if(t.dataset.v==='profiles') loadProfiles();
}));

/* ── Countdown ── */
const TARGET=new Date('2026-06-20T18:00:00').getTime();
function tick(){
  const diff=TARGET-Date.now();
  if(diff<0){document.getElementById('cd-d').textContent='LIVE';return;}
  const dd=Math.floor(diff/864e5),hh=Math.floor(diff%864e5/36e5),mm=Math.floor(diff%36e5/6e4),ss=Math.floor(diff%6e4/1e3);
  document.getElementById('cd-d').textContent=dd;
  document.getElementById('cd-h').textContent=String(hh).padStart(2,'0');
  document.getElementById('cd-m').textContent=String(mm).padStart(2,'0');
  document.getElementById('cd-s').textContent=String(ss).padStart(2,'0');
}
tick();setInterval(tick,1000);

/* ── PWA: register service worker ── */
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('sw.js').catch(e=>console.warn('SW:',e));
  });
}
