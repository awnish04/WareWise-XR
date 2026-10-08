(function(){
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const modules=[
  {key:'manual',icon:'MH',title:'Manual Handling',desc:'Assess loads, choose controls, physically pick up crates and place them in the receiving bay.',time:'6–8 min'},
  {key:'height',icon:'WAH',title:'Working at Height',desc:'Apply the fall-prevention hierarchy, restore collective edge protection, then access the high-level task.',time:'4–6 min'},
  {key:'hazards',icon:'HP',title:'Hazard Perception',desc:'Explore the 360° warehouse and report ten unsafe conditions before work continues.',time:'6–10 min'},
  {key:'unsafe',icon:'UA',title:'Unsafe Acts',desc:'Spot three worker behaviours that conflict with the fictional site safe system of work.',time:'4–5 min'},
  {key:'why',icon:'5W',title:'5 Whys Root Cause',desc:'Sequence an incident-cause chain from immediate cause to management-system root cause.',time:'4–5 min'},
  {key:'cyber',icon:'CY',title:'Cyber Awareness',desc:'Use the in-world workstation to classify suspicious and legitimate messages.',time:'4–6 min'}
];
let engine,training,simStarted=false,navLoopStarted=false;
const stationLabels=[
  {id:'controlRoomMarker',text:'TRAINING CONTROL ROOM',sub:'Briefing • Cyber • 5 Whys • Duel'},
  {id:'briefTerminal',text:'BRIEFING',sub:'Start / orientation'},
  {id:'cyberTerminal',text:'CYBER AWARENESS',sub:'Inbox challenge'},
  {id:'whyTerminal',text:'5 WHYS',sub:'Root-cause puzzle'},
  {id:'duelTerminal',text:'HAZARD DUEL',sub:'2-player challenge'},
  {id:'harnessLocker',text:'WORK AT HEIGHT',sub:'Control station'},
  {id:'dropZone',text:'RECEIVING BAY',sub:'Place assessed loads'}
];
const ui={
  guide:{label:'Briefing terminal',id:'briefTerminal'},
  updateHUD(state){$('#score').textContent=String(state.score||0).padStart(4,'0');$('#hazards').textContent=`${(state.hazards||[]).length}/10`;$('#ppeLabel').textContent=`Hi-vis ✓ • Boots ✓ • Harness ${state.harness?'✓':'—'}`;renderModules(state)},
  homeProgress(state){const done=Object.values(state.moduleDone||{}).filter(Boolean).length;$('#homeCompletion').textContent=`${Math.round(done/6*100)}%`;renderModules(state)},
  toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(ui._toast);ui._toast=setTimeout(()=>t.classList.remove('show'),2400)},
  hover(o,carried){const p=$('#interactionPrompt'),c=$('#crosshair');if(o&&!carried){const action=(o.kind==='crate'||o.kind==='movable')?'PICK UP':o.kind==='hazard'?'REPORT HAZARD':o.kind==='unsafeAct'?'IDENTIFY UNSAFE ACT':'INTERACT';$('#promptText').textContent=`${action} — ${o.label||'Object'}`;p.classList.add('show');c.classList.add('active')}else{p.classList.remove('show');c.classList.remove('active')}},
  carry(o){const el=$('#carryStatus');if(o){$('#carryLabel').textContent=o.label;el.classList.remove('hidden')}else el.classList.add('hidden')},
  ppe(on){$('#ppeLabel').textContent=`Hi-vis ✓ • Boots ✓ • Harness ${on?'✓':'—'}`},
  setObjective(title,text,progress=0){$('#objectiveTitle').textContent=title;$('#objectiveText').textContent=text;$('#objectiveBar').style.width=`${Math.max(3,Math.min(100,progress*100))}%`;ui.guide=resolveGuide(title)},
  openModal(html){document.exitPointerLock?.();$('#modal').innerHTML=`<div class="close-row"><span class="modal-escape"><kbd>Esc</kbd> close</span><button class="icon-btn" data-close>Close</button></div>${html}`;$('#modalLayer').classList.remove('hidden');$$('[data-close]').forEach(b=>b.onclick=ui.closeModal)},
  closeModal(){ $('#modalLayer').classList.add('hidden'); $('#modal').innerHTML=''; },
  vrState(on){$('#vrBtn').textContent=on?'Exit VR':'VR';ui.toast(on?'Immersive VR session started':'VR session ended')},
  bindQuiz(correct,cb){$$('[data-quiz]').forEach(b=>b.onclick=()=>{const ok=Number(b.dataset.quiz)===correct;b.classList.add(ok?'correct':'wrong');setTimeout(()=>cb(ok),ok?250:350)})},
  bindHeavy(o,right){$$('[data-heavy]').forEach(b=>b.onclick=()=>{if(b.dataset.heavy==='right'){b.classList.add('correct');setTimeout(right,250)}else{b.classList.add('wrong');training.score(-25,'Unsafe load-handling choice')}})},
  bindWhys(check){$('#checkWhys').onclick=check},bindMail(cb){$$('[data-mail]').forEach(b=>b.onclick=()=>cb(b.dataset.mail))},bindDuel(cb){$('#startDuel').onclick=cb},bindNextDuel(cb){$('#nextDuel').onclick=cb}
};
function renderModules(state){const root=$('#moduleGrid');if(!root)return;root.innerHTML=modules.map((m,i)=>{const d=!!state?.moduleDone?.[m.key];return `<article class="module-card" data-module="${i}"><div><div class="module-icon">${m.icon}</div><h3>${m.title}</h3><p>${m.desc}</p></div><div class="module-meta"><span>${m.time}</span><b>${d?'Complete ✓':'Start →'}</b></div></article>`}).join('');$$('[data-module]').forEach(c=>c.onclick=()=>startModule(Number(c.dataset.module)))}
function ensureSim(){
  if(simStarted)return true;
  engine=new WareEngine($('#glCanvas'));
  console.log('[ENSURE_SIM] Engine created, attempting WebGL init...');
  const initSuccess = engine.init();
  console.log('[ENSURE_SIM] Engine.init() returned:', initSuccess);
  if(!initSuccess){
    console.error('[ENSURE_SIM] WebGL initialization failed!');
    console.error('[ENSURE_SIM] Engine.gl:', engine.gl);
    showSim();
    $('#fallback').classList.remove('hidden');
    // Check if Brave and show specific help
    if(window.WAREWISE_COMPAT){
      const compat = window.WAREWISE_COMPAT.get();
      console.log('[ENSURE_SIM] Browser compat check:', compat);
      if(compat.browser === 'Brave' && !compat.webglAvailable){
        $('#braveWebglHelp').classList.remove('hidden');
      }
    }
    return false;
  }
  console.log('[ENSURE_SIM] WebGL initialized successfully!');
  training=new WareTraining(engine,ui);
  engine.start();
  simStarted=true;
  buildWorldLabels();
  if(!navLoopStarted){navLoopStarted=true;requestAnimationFrame(updateNavigationHUD)}
  if(matchMedia('(pointer:coarse)').matches)$('#touchControls').classList.remove('hidden');
  return true;
}
function showSim(){ $('#home').classList.remove('active');$('#sim').classList.add('active') }
function showHome(){document.exitPointerLock?.();$('#sim').classList.remove('active');$('#home').classList.add('active');ui.closeModal()}
function launch(){showSim();if(!ensureSim())return;ui.setObjective(training.state.briefed?'Continue your safety-training shift':'Report to the briefing terminal',training.state.briefed?'Use the minimap, station signs and objective arrow to reach any unfinished module.':'Follow the objective arrow to the blue briefing terminal and press E.',training.state.briefed?.15:.03);setTimeout(()=>$('#glCanvas').focus(),50)}
function startModule(i){launch();if(!training)return;const m=modules[i];const spots={manual:{p:[-11.5,1.68,6.7],y:0,pitch:-.24},height:{p:[14,1.68,-2],y:0},hazards:{p:[0,1.68,4],y:0},unsafe:{p:[7,1.68,-13],y:0},why:{p:[16.0,1.68,10.6],y:Math.PI},cyber:{p:[13.55,1.68,10.6],y:Math.PI}};const s=spots[m.key];engine.camera.position=[...s.p];engine.camera.yaw=s.y;engine.camera.pitch=s.pitch||0;const obj={manual:['Manual handling','Assess the parts crates, then pick up and carry approved loads into the green receiving bay.'],height:['Working at height','Follow the guide to the green work-at-height control station. The ladder remains locked until fall-prevention controls are in place.'],hazards:['Hazard perception','Use the minimap and objective arrow to locate the nearest unresolved highlighted hazard.'],unsafe:['Unsafe acts','Find three highlighted worker behaviours and identify why each is unsafe.'],why:['5 Whys root-cause analysis','Approach the purple 5 WHYS station and press E to build the cause chain.'],cyber:['Cyber awareness','Approach the blue CYBER AWARENESS station and press E to begin inbox triage.']}[m.key];ui.setObjective(obj[0],obj[1],0)}
function help(){launch();if(!training)return;ui.openModal(`<span class="eyebrow">CONTROLS & INTERACTION</span><h2>How to use WareWise XR</h2><p><b>Desktop:</b> click the 3D view to capture the mouse. Use WASD to walk. Mouse movement is direct: move right to turn right, left to turn left, up to look up and down to look down. Aim the crosshair at a highlighted object and press E or left-click.</p><p><b>Navigation:</b> the top-centre arrow points toward the current objective, the minimap shows your position plus training stations and unresolved hazards, and large station names are displayed both as 3D signs and HUD labels. Electronic terminals are grouped inside the south-east Training Control Room.</p><p><b>Objects:</b> glowing parcels, totes, cases and cones can be freely picked up and set down with G. The two lighter assessed parts crates must be carried to the green receiving bay. Press Esc to close an open system prompt or quiz; click the 3D view once to recapture the mouse without re-triggering the terminal.</p><p><b>VR:</b> use the VR button on a WebXR-capable headset/browser. Point a controller at an interactive object and use the primary select trigger. Squeeze drops a carried object. Thumbsticks provide smooth locomotion when exposed by the controller.</p><div class="modal-actions"><button class="primary" data-close>Enter training floor</button></div>`)}
function resolveGuide(title=''){
  if(!engine||!training)return{label:'Briefing terminal',id:'briefTerminal'};
  const t=title.toLowerCase();
  if(engine.carried?.kind==='crate')return{label:'Receiving bay',id:'dropZone'};
  if(t.includes('brief'))return{label:'Briefing terminal',id:'briefTerminal'};
  if(t.includes('manual')){const candidates=['crate1','crate2','crate3'].map(id=>engine.get(id)).filter(o=>o&&!o.delivered&&o.interactive);const o=nearest(candidates);return o?{label:o.label,id:o.id}:{label:'Receiving bay',id:'dropZone'}}
  if(t.includes('hazard')||t.includes('duel')){const unresolved=(training.hazardIds||[]).filter(id=>!training.state.hazards.includes(id)).map(id=>engine.get(id)).filter(o=>o&&o.interactive);const o=nearest(unresolved);if(o)return{label:'Nearest unresolved hazard',id:o.id}}
  if(t.includes('unsafe')){const o=nearest(engine.objects.filter(o=>o.kind==='unsafeAct'&&o.interactive));if(o)return{label:'Nearest unsafe act',id:o.id}}
  if(t.includes('height')||t.includes('sensor')||t.includes('floor')){if(training.atHeight&&training.state.heightDone)return{label:'Ladder descent point',id:'ladderTopInteract'};if(training.atHeight)return{label:'High-level sensor',id:'heightTask'};if(!training.state.heightPlan)return{label:'Work-at-height station',id:'harnessLocker'};return{label:'Authorised ladder',id:'ladderInteract'}}
  if(t.includes('why')||t.includes('root'))return{label:'5 Whys terminal',id:'whyTerminal'};
  if(t.includes('cyber'))return{label:'Cyber awareness terminal',id:'cyberTerminal'};
  if(t.includes('remaining')||t.includes('continue'))return guideToNearestIncomplete();
  return{label:'Briefing terminal',id:'briefTerminal'};
}
function guideToNearestIncomplete(){const d=training.state.moduleDone||{};const ids=[];if(!d.manual)ids.push(['Manual handling','crate1']);if(!d.height)ids.push(['Working at height','harnessLocker']);if(!d.hazards){const hz=(training.hazardIds||[]).find(id=>!training.state.hazards.includes(id));if(hz)ids.push(['Hazard perception',hz])}if(!d.unsafe){const u=engine.objects.find(o=>o.kind==='unsafeAct'&&o.interactive);if(u)ids.push(['Unsafe acts',u.id])}if(!d.why)ids.push(['5 Whys','whyTerminal']);if(!d.cyber)ids.push(['Cyber awareness','cyberTerminal']);const options=ids.map(([label,id])=>({label,id,o:engine.get(id)})).filter(x=>x.o);if(!options.length)return{label:'Briefing terminal',id:'briefTerminal'};const best=options.sort((a,b)=>distanceTo(a.o)-distanceTo(b.o))[0];return{label:best.label,id:best.id}}
function nearest(arr){return arr.sort((a,b)=>distanceTo(a)-distanceTo(b))[0]||null}
function distanceTo(o){if(!o||!engine)return 999;return Math.hypot(o.position[0]-engine.camera.position[0],o.position[2]-engine.camera.position[2])}
function getGuideObject(){if(!engine)return null;if(engine.carried?.kind==='crate')return engine.get('dropZone');const current=ui.guide?.id&&engine.get(ui.guide.id);if(current&&current.visible!==false)return current;ui.guide=resolveGuide($('#objectiveTitle')?.textContent||'');return ui.guide?.id?engine.get(ui.guide.id):null}
function normalizeAngle(a){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a}
function updateNavigationHUD(){requestAnimationFrame(updateNavigationHUD);if(!engine||!simStarted)return;const target=getGuideObject();if(target){const dx=target.position[0]-engine.camera.position[0],dz=target.position[2]-engine.camera.position[2],bearing=Math.atan2(dx,-dz),diff=normalizeAngle(bearing-engine.camera.yaw),dist=Math.hypot(dx,dz);$('#guideArrow').style.transform=`rotate(${diff}rad)`;$('#guideLabel').textContent=ui.guide?.label||target.label;$('#guideDistance').textContent=`${dist.toFixed(1)} m`;}
  drawMinimap(target);updateWorldLabels();
}
function drawMinimap(target){const c=$('#minimapCanvas');if(!c||!engine)return;const ctx=c.getContext('2d'),w=c.width,h=c.height;ctx.clearRect(0,0,w,h);ctx.fillStyle='#091018';ctx.fillRect(0,0,w,h);const map=(x,z)=>[12+(x+20)/40*(w-24),12+(z+39)/54*(h-24)];
  ctx.strokeStyle='#33414d';ctx.lineWidth=2;ctx.strokeRect(11,11,w-22,h-22);
  // Training Control Room in the south-east corner; gap in the west wall is the doorway.
  {const [rx1,ry1]=map(9.7,5.55),[rx2,ry2]=map(19.7,14.7);ctx.fillStyle='#152730';ctx.fillRect(rx1,ry1,rx2-rx1,ry2-ry1);ctx.strokeStyle='#70828f';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(rx1,ry1);ctx.lineTo(rx2,ry1);ctx.lineTo(rx2,ry2);ctx.lineTo(rx1,ry2);ctx.moveTo(rx1,ry1);const [,doorA]=map(9.7,10.8),[,doorB]=map(9.7,13.8);ctx.lineTo(rx1,doorA);ctx.moveTo(rx1,doorB);ctx.lineTo(rx1,ry2);ctx.stroke();}
  // rack blocks
  ctx.fillStyle='#27343e';for(const x of [-15,-6,6,15])for(const z of [-12,-27]){const [mx,my]=map(x,z);ctx.fillRect(mx-9,my-14,18,28)}
  // pedestrian lane
  ctx.strokeStyle='#357aa3';ctx.lineWidth=3;let a=map(-18.2,-36),b=map(-18.2,12);ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();
  const points=[['TR','controlRoomMarker','#9fd4ee'],['MH','crate1','#f6b900'],['H','harnessLocker','#54d18f']];ctx.font='bold 9px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';for(const [txt,id,col] of points){const o=engine.get(id);if(!o)continue;const [x,y]=map(o.position[0],o.position[2]);ctx.fillStyle=col;ctx.beginPath();ctx.arc(x,y,8,0,Math.PI*2);ctx.fill();ctx.fillStyle='#071018';ctx.fillText(txt,x,y+.5)}
  for(const id of training?.hazardIds||[]){if(training.state.hazards.includes(id))continue;const o=engine.get(id);if(!o)continue;const [x,y]=map(o.position[0],o.position[2]);ctx.fillStyle='#ef625c';ctx.beginPath();ctx.arc(x,y,3.2,0,Math.PI*2);ctx.fill()}
  if(target){const [x,y]=map(target.position[0],target.position[2]);ctx.strokeStyle='#ffffff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,11,0,Math.PI*2);ctx.stroke()}
  const [px,py]=map(engine.camera.position[0],engine.camera.position[2]);ctx.save();ctx.translate(px,py);ctx.rotate(engine.camera.yaw);ctx.fillStyle='#ffffff';ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(7,7);ctx.lineTo(0,4);ctx.lineTo(-7,7);ctx.closePath();ctx.fill();ctx.restore();
}
function buildWorldLabels(){const layer=$('#worldLabelLayer');if(!layer)return;layer.innerHTML='';for(const d of stationLabels){const el=document.createElement('div');el.className='world-label';el.dataset.worldId=d.id;el.innerHTML=`<b>${d.text}</b><small>${d.sub}</small>`;layer.appendChild(el)}}
function updateWorldLabels(){if(!engine)return;const w=innerWidth,h=innerHeight,vFov=Math.PI/3,hFov=2*Math.atan(Math.tan(vFov/2)*(w/h));
  const controlIds=new Set(['briefTerminal','cyberTerminal','whyTerminal','duelTerminal']);
  const nearestControl=[...controlIds].map(id=>engine.get(id)).filter(Boolean).sort((a,b)=>distanceTo(a)-distanceTo(b))[0]?.id;
  $$('.world-label').forEach(el=>{const o=engine.get(el.dataset.worldId);if(!o){el.style.display='none';return}if(controlIds.has(o.id)&&o.id!==nearestControl){el.style.display='none';return}const dx=o.position[0]-engine.camera.position[0],dz=o.position[2]-engine.camera.position[2],dy=(o.position[1]+1.6)-engine.camera.position[1],flat=Math.hypot(dx,dz),dist=Math.hypot(flat,dy);if(dist>28){el.style.display='none';return}const bearing=Math.atan2(dx,-dz),yawDiff=normalizeAngle(bearing-engine.camera.yaw),vert=Math.atan2(dy,flat),pitchDiff=vert-engine.camera.pitch;if(Math.abs(yawDiff)>hFov*.57||Math.abs(pitchDiff)>vFov*.58){el.style.display='none';return}const x=w*(.5+yawDiff/hFov),y=h*(.5-pitchDiff/vFov);el.style.display='block';el.style.transform=`translate(-50%,-50%) translate(${x}px,${y}px)`;el.style.opacity=String(Math.max(.45,1-dist/42));el.querySelector('small').textContent=`${stationLabels.find(d=>d.id===el.dataset.worldId)?.sub||''} • ${dist.toFixed(0)} m`;})}
function resetWarehouse(){if(!training)return;if(!confirm('Reset the entire warehouse for a new trainee? This clears score, module progress, moved objects, reported hazards and all completed challenges.'))return;if(engine.xrSession)engine.exitVR();training.resetSession();ui.guide={label:'Briefing terminal',id:'briefTerminal'};buildWorldLabels()}
$('#launchBtn').onclick=launch;$('#launchBtn2').onclick=launch;$('#howBtn').onclick=help;$('#fallbackBack').onclick=showHome;
$('#resetProgressBtn').onclick=async()=>{if(confirm('Reset your current WareWise XR module progress? Your historical best leaderboard score will be kept.')){try{await window.WareWiseBackend?.resetProgress?.();}catch(err){alert(err.message||'Unable to reset progress');return}location.reload()}};
$('#resetWarehouseBtn').onclick=resetWarehouse;
// Esc closes any active system prompt/quiz. The next canvas click only recaptures the mouse;
// it does not fire the terminal interaction again. Capture phase keeps the key away from the 3D engine.
document.addEventListener('keydown',e=>{if(e.code==='Escape'&&!$('#modalLayer').classList.contains('hidden')){e.preventDefault();e.stopImmediatePropagation();ui.closeModal();ui.toast('Prompt closed • click the 3D view to resume')}} ,true);
$('#pauseBtn').onclick=()=>ui.openModal(`<span class="eyebrow">SHIFT MENU</span><h2>Training paused</h2><p>Your progress is synced to your employee account. Use <b>Reset warehouse</b> to restore the current training state before another attempt.</p><div class="modal-actions"><button class="secondary" id="dashBtn">Training home</button><button class="secondary" id="accountBtn">Employee dashboard</button><button class="secondary" id="menuResetBtn">Reset warehouse</button><button class="primary" data-close>Resume</button></div>`);
$('#modalLayer').addEventListener('click',e=>{if(e.target.id==='dashBtn')showHome();if(e.target.id==='accountBtn')window.WareWiseBackend?.goDashboard?.();if(e.target.id==='menuResetBtn')resetWarehouse()});
$('#vrBtn').onclick=async()=>{if(!engine)return;if(engine.xrSession){engine.exitVR();return}try{await engine.enterVR()}catch(err){ui.openModal(`<span class="eyebrow">VR STATUS</span><h2>Immersive VR unavailable</h2><p>${String(err.message||err)}</p><p>Desktop 3D remains fully interactive. For headset testing, serve this project from localhost or HTTPS in a WebXR-capable browser and connect a compatible headset.</p><div class="modal-actions"><button class="primary" data-close>Continue in 3D</button></div>`)} };
$('#touchInteract').onclick=()=>engine?.interact();$('#touchDrop').onclick=()=>engine?.drop();$$('#touchControls [data-key]').forEach(b=>{const k=b.dataset.key;['pointerdown','touchstart'].forEach(ev=>b.addEventListener(ev,e=>{e.preventDefault();if(engine)engine.keys[k]=true}));['pointerup','pointercancel','touchend'].forEach(ev=>b.addEventListener(ev,e=>{e.preventDefault();if(engine)engine.keys[k]=false}))});
window.__WAREWISE_DEBUG__={get engine(){return engine},get training(){return training},ui,startModule,resetWarehouse};
renderModules({moduleDone:{}});
})();
