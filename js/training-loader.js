(async function(){
'use strict';
const defaultState=()=>({score:0,hazards:[],manualDelivered:0,harness:false,heightPlan:false,heightDone:false,whyDone:false,cyberDone:false,unsafeDone:false,unsafeActs:[],briefed:false,moduleDone:{manual:false,height:false,hazards:false,unsafe:false,why:false,cyber:false},highScores:[]});
const loadScript=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error(`Unable to load ${src}`));document.body.appendChild(s)});
async function api(url,opt={}){const r=await fetch(url,{headers:{'Content-Type':'application/json',...(opt.headers||{})},...opt});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Request failed');return d}
function badge(text,kind=''){let el=document.querySelector('.server-sync-badge');if(!el){el=document.createElement('div');el.className='server-sync-badge';document.body.appendChild(el)}el.className=`server-sync-badge ${kind}`;el.textContent=text;clearTimeout(badge.t);badge.t=setTimeout(()=>el.remove(),1600)}
try{
  const me=await api('/api/auth/me?role=employee');
  console.log('[TRAINING-LOADER] Auth check:', me);
  if(!me.authenticated){
    console.error('[TRAINING-LOADER] Not authenticated');
    location.href='/trainee-dashboard';
    return;
  }
  if(me.user?.role!=='employee'){
    console.error('[TRAINING-LOADER] Wrong role:', me.user?.role);
    location.href='/trainee-dashboard';
    return;
  }
  if(me.user?.status!=='approved'){
    console.error('[TRAINING-LOADER] Not approved, status:', me.user?.status);
    location.href='/trainee-dashboard';
    return;
  }
  const user=me.user;const name=document.getElementById('trainingUserName');if(name)name.textContent=user.name;
  const server=await api('/api/training/me');
  try{localStorage.setItem('warewiseXRState',JSON.stringify(server.progress||defaultState()))}catch(_){}
  try{await api('/api/training/start',{method:'POST'})}catch(_){}
  let timer=null,pending=null,working=false;
  async function flush(){if(working||!pending)return;working=true;const state=pending;pending=null;try{await api('/api/training/progress',{method:'POST',body:JSON.stringify({state})});badge('Progress synced','ok')}catch(err){console.error(err);badge('Progress sync failed','error')}finally{working=false;if(pending)timer=setTimeout(flush,250)}}
  window.WareWiseBackend={
    user,
    syncProgress(state,immediate=false){pending=JSON.parse(JSON.stringify(state||defaultState()));clearTimeout(timer);timer=setTimeout(flush,immediate?0:450)},
    async resetProgress(){const state=defaultState();try{localStorage.setItem('warewiseXRState',JSON.stringify(state))}catch(_){}await api('/api/training/progress',{method:'POST',body:JSON.stringify({state})});return state},
    async logout(){try{await api('/api/auth/logout',{method:'POST',body:JSON.stringify({role:'employee'})})}finally{try{localStorage.removeItem('warewiseXRState')}catch(_){}location.href='/'}},
    goDashboard(){location.href='/employee'}
  };
  for(const src of ['js/math3d.js','js/engine.js','js/training.js','js/app.js'])await loadScript(src);
  document.getElementById('employeeDashBtn')?.addEventListener('click',()=>location.href='/employee');
  window.addEventListener('beforeunload',()=>{try{const state=window.__WAREWISE_DEBUG__?.training?.state;if(state&&navigator.sendBeacon){navigator.sendBeacon('/api/training/progress',new Blob([JSON.stringify({state})],{type:'application/json'}));}}catch(_){}});
}catch(err){console.error(err);document.body.innerHTML=`<div style="font-family:system-ui;background:#08111a;color:#eef4f7;min-height:100vh;display:grid;place-items:center;padding:30px"><div style="max-width:520px"><h1>Training could not start</h1><p style="color:#9aabba">${String(err.message||err)}</p><p><a href="/employee" style="color:#f6b900">Return to employee dashboard</a></p></div></div>`}
})();
