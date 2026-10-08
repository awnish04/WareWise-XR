(function(){
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let role='employee', mode='signin';
const msg=$('#authMessage'), signin=$('#signinForm'), request=$('#requestForm'), modeSwitch=$('#modeSwitch');
function setMessage(text='',kind=''){msg.textContent=text;msg.className='form-message '+kind}
function render(){
  $$('[data-role]').forEach(b=>b.classList.toggle('active',b.dataset.role===role));
  $$('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  const admin=role==='admin';
  modeSwitch.classList.toggle('hidden',admin);
  if(admin) mode='signin';
  signin.classList.toggle('hidden',mode!=='signin');request.classList.toggle('hidden',mode!=='request'||admin);
  $('#authTitle').textContent=admin?'Administrator sign in':mode==='request'?'Request employee access':'Welcome back';
  $('#authIntro').textContent=admin?'Review employee access requests and training activity.':mode==='request'?'Create an employee account request. A training administrator must approve it before the warehouse opens.':'Use your WareWise employee account to continue.';
  $('#authNote').textContent=admin?'Administrator access is restricted to training-management accounts on this local installation.':'Authentication alone does not unlock the warehouse. A new employee account must be approved by an administrator before training access becomes available.';
  setMessage();
}
$$('[data-role]').forEach(b=>b.onclick=()=>{role=b.dataset.role;render()});
$$('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;render()});
async function api(url,options={}){const r=await fetch(url,{headers:{'Content-Type':'application/json',...(options.headers||{})},...options});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Request failed');return data}
signin.addEventListener('submit',async e=>{e.preventDefault();setMessage('Signing in…');signin.classList.add('loading');try{const data=await api('/api/auth/login',{method:'POST',body:JSON.stringify({email:$('#loginEmail').value,password:$('#loginPassword').value,role})});location.href=data.redirect||'/trainee-dashboard'}catch(err){setMessage(err.message,'error')}finally{signin.classList.remove('loading')}});
request.addEventListener('submit',async e=>{e.preventDefault();setMessage('Submitting request…');request.classList.add('loading');try{const data=await api('/api/access/request',{method:'POST',body:JSON.stringify({name:$('#requestName').value,email:$('#requestEmail').value,department:$('#requestDepartment').value,password:$('#requestPassword').value})});setMessage(data.message,'success');$('#loginEmail').value=$('#requestEmail').value;setTimeout(()=>{mode='signin';render();setMessage('Request saved. Sign in to check approval status.','success')},900)}catch(err){setMessage(err.message,'error')}finally{request.classList.remove('loading')}});
render();
})();
