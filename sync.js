'use strict';
/* Cloud sync (Supabase). Offline-first: local copy is the source for the UI; changes are detected by diffing
   against the last known server version, pushed when online, last-write-wins per record on data.updatedAt. */
const SB_URL='https://wcifumouhngajyeorkte.supabase.co';
const SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjaWZ1bW91aG5nYWp5ZW9ya3RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MTUxODgsImV4cCI6MjEwODE5MTE4OH0.j_hsai4iqPp7YiqmJWWIuCX7ogL0yKGjKaFOcRn0fsw'; // public anon key; access is enforced by row-level security
const Sync=(()=>{
 const SK='fleetSync.v1',KINDS=['locations','units','moves'];
 let st=JSON.parse(localStorage.getItem(SK)||'null')||{synced:{},cursor:{},role:null,email:null,name:null};
 const keep=()=>localStorage.setItem(SK,JSON.stringify(st));
 const sb=window.supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true,storageKey:'fleet-auth'}});
 const remapped=new Set();let busy=false,timer=null,lastErr='',session=null;
 const snap=r=>{const o={...r};delete o.updatedAt;return JSON.stringify(o)};
 const key=(k,id)=>k+':'+id;
 const isAdmin=()=>st.role==='admin';
 const SF=['status','completedAt','completedBy','updatedAt'],strip=j=>{const o=JSON.parse(j);SF.forEach(f=>delete o[f]);return JSON.stringify(o)};
 /* users may push brand-new moves, or a status-only change (mark completed) on an existing move */
 const statusOnly=(r,kk)=>kk in st.synced&&strip(st.synced[kk])===strip(snap(r));
 const can=(k,r,kk)=>isAdmin()||k==='moves'&&(!(kk in st.synced)||statusOnly(r,kk));
 function stamp(db){const now=new Date().toISOString();KINDS.forEach(k=>db[k].forEach(r=>{if(st.synced[key(k,r.id)]!==snap(r))r.updatedAt=now}))}
 function pending(db){let n=0;const live=new Set();KINDS.forEach(k=>db[k].forEach(r=>{live.add(key(k,r.id));if(st.synced[key(k,r.id)]!==snap(r)&&can(k,r,key(k,r.id)))n++}));
  if(isAdmin())Object.keys(st.synced).forEach(x=>{if(!live.has(x))n++});return n}
 function status(){const el=document.getElementById('sync');if(!el)return;const p=pending(db);
  el.textContent=!session?'Not signed in':busy?'Syncing…':!navigator.onLine?`Offline${p?' · '+p+' to sync':''}`:lastErr?'Sync error – tap':p?p+' to sync':'Synced ✓';
  el.className=lastErr?'err':(!navigator.onLine||p)?'warn':''}
 async function pullKind(k){let changed=false;for(;;){let q=sb.from(k).select('id,data,deleted,updated_at').order('updated_at').limit(1000);
   if(st.cursor[k])q=q.gt('updated_at',st.cursor[k]);const {data,error}=await q;if(error)throw error;
   data.forEach(row=>{changed=true;apply(k,row);st.cursor[k]=row.updated_at});if(data.length<1000)break}return changed}
 function apply(k,row){const arr=db[k],i=arr.findIndex(r=>r.id===row.id),kk=key(k,row.id);
  if(i<0&&!row.deleted){ // first sync on a device with its own local copy: match units by number, locations by name
   const dupIdx=k==='units'?arr.findIndex(r=>!(key(k,r.id) in st.synced)&&r.num.toLowerCase()===String(row.data.num).toLowerCase())
     :k==='locations'?arr.findIndex(r=>!(key(k,r.id) in st.synced)&&r.name.toLowerCase()===String(row.data.name).toLowerCase()):-1;
   if(dupIdx>=0){const old=arr[dupIdx];if(k==='units'){db.moves.forEach(m=>{if(m.unitId===old.id)m.unitId=row.id});remapped.add(row.id)}arr.splice(dupIdx,1)}}
  const j=arr.findIndex(r=>r.id===row.id),local=j>=0?arr[j]:null,dirty=local&&st.synced[kk]!==snap(local);
  const remote={...row.data,id:row.id};
  if(row.deleted){if(j>=0&&!(dirty&&isAdmin()&&(local.updatedAt||'')>(remote.updatedAt||'')))arr.splice(j,1);delete st.synced[kk];return}
  if(dirty&&can(k,local,kk)&&(local.updatedAt||'')>(remote.updatedAt||'')){st.synced[kk]=snap(remote);return}
  if(j>=0)arr[j]=remote;else arr.push(remote);st.synced[kk]=snap(remote)}
 async function push(){const live=new Set();
  for(const k of KINDS){const rows=[];
   for(const r of db[k]){const kk=key(k,r.id);live.add(kk);if(st.synced[kk]===snap(r))continue;
    if(isAdmin())rows.push({id:r.id,data:r,deleted:false});
    else if(k==='moves'&&!(kk in st.synced)){const m={...r};const {error}=await sb.rpc('log_move',{p:m});if(error)throw error;st.synced[kk]=snap(r)}
    else if(statusOnly(r,kk)){const {data:ok,error}=await sb.rpc('set_move_status',{p_id:r.id,p_status:r.status||'pending',p_at:r.updatedAt||new Date().toISOString()});if(error)throw error;st.synced[kk]=snap(r);
     if(!ok){const {data:row}=await sb.from('moves').select('id,data,deleted,updated_at').eq('id',r.id).maybeSingle();if(row&&!row.deleted){const rem={...row.data,id:row.id},j=db.moves.findIndex(x=>x.id===r.id);if(j>=0)db.moves[j]=rem;st.synced[kk]=snap(rem)}}}}
   if(isAdmin())Object.keys(st.synced).forEach(kk=>{if(kk.startsWith(k+':')&&!live.has(kk))rows.push({id:kk.slice(k.length+1),data:{updatedAt:new Date().toISOString()},deleted:true})});
   for(let i=0;i<rows.length;i+=200){const ch=rows.slice(i,i+200);const {error}=await sb.rpc('sync_push',{kind:k,rows:ch});if(error)throw error;
    ch.forEach(x=>{const kk=key(k,x.id);if(x.deleted)delete st.synced[kk];else st.synced[kk]=snap(x.data)})}}}
 async function run(){if(busy||!session||!navigator.onLine){status();return}busy=true;status();
  try{await loadRole();if(st.role==='admin'||st.role==='user'){let ch=false;for(const k of KINDS)ch=await pullKind(k)||ch;if(ch&&!document.querySelector('dialog[open]')&&!(document.activeElement?.matches('input,textarea,select')&&document.activeElement.closest('main,dialog')))render();if(remapped.size&&isAdmin()){remapped.forEach(id=>{const u=db.units.find(x=>x.id===id),lm=db.moves.filter(m=>m.unitId===id).sort((a,b)=>b.at.localeCompare(a.at))[0];if(u&&lm&&lm.to!==u.loc)u.loc=lm.to});remapped.clear();stamp(db)}
    await push();for(const k of KINDS)ch=await pullKind(k)||ch;
    localStorage.setItem(KEY,JSON.stringify(db));if(ch&&!document.querySelector('dialog[open]')&&!(document.activeElement?.matches('input,textarea,select')&&document.activeElement.closest('main,dialog')))render()}lastErr=''}
  catch(e){lastErr=e.message||String(e);console.warn('sync',e)}finally{busy=false;keep();status();if(!lastErr&&session&&navigator.onLine&&pending(db)>0)setTimeout(run,300)}}
 async function loadRole(){const {data,error}=await sb.from('profiles').select('role,name,email').eq('id',session.user.id).maybeSingle();if(error)throw error;
  const r=data?data.role:'pending';if(r!==st.role){st.role=r;keep();applyRole()}st.name=data&&data.name;st.email=session.user.email}
 function applyRole(){document.body.classList.toggle('role-admin',st.role==='admin');document.body.classList.toggle('role-user',st.role!=='admin');gate()}
 function gate(){const lg=document.getElementById('login');if(!lg)return;
  if(!session&&!st.role){lg.hidden=false;lg.innerHTML=loginHTML();bindLogin();return}
  if(st.role!=='admin'&&st.role!=='user'){lg.hidden=false;lg.innerHTML=`<div class="lbox"><h2>Waiting for approval</h2><p>Signed in as <b>${esc(st.email||'')}</b>. An admin needs to approve your account (Users tab) before you can see the fleet.</p><div class="row"><button id="lchk">Check again</button><button class="sec" id="lout">Sign out</button></div></div>`;
   document.getElementById('lchk').onclick=()=>run().then(gate);document.getElementById('lout').onclick=signOut;return}
  if(!lg.hidden){lg.hidden=true;document.activeElement?.blur();render()}}
 function loginHTML(){return `<div class="lbox"><h1>Fleet Moves</h1><p class="s">Sign in to sync across your devices.</p>
<label>Email</label><input id="lem" type="email" autocomplete="username" autocapitalize="off">
<label>Password</label><input id="lpw" type="password" autocomplete="current-password">
<div id="lnm" hidden><label>Your name</label><input id="lname" autocomplete="name"></div>
<p id="lmsg" class="s"></p><div class="row"><button id="lin" style="flex:1">Sign in</button><button class="sec" id="lnew">Create account</button></div></div>`}
 function bindLogin(){const $=id=>document.getElementById(id),msg=t=>$('lmsg').textContent=t;
  $('lin').onclick=async()=>{msg('Signing in…');const {error}=await sb.auth.signInWithPassword({email:$('lem').value.trim(),password:$('lpw').value});if(error)msg(error.message)};
  $('lnew').onclick=async()=>{if($('lnm').hidden){$('lnm').hidden=false;$('lin').hidden=true;$('lnew').textContent='Create account';msg('Choose a password (8+ characters). An admin must approve new accounts.');return}
   const {error}=await sb.auth.signUp({email:$('lem').value.trim(),password:$('lpw').value,options:{data:{name:$('lname').value.trim()}}});if(error)msg(error.message)}}
 async function signOut(){if(!confirm('Sign out? Unsynced changes on this device will be lost.'))return;await sb.auth.signOut();st={synced:{},cursor:{},role:null};keep();
  db={units:[],locations:[],moves:[]};localStorage.setItem(KEY,JSON.stringify(db));location.reload()}
 sb.auth.onAuthStateChange((ev,s)=>{const prev=session&&session.user.id;session=s;
  if(s&&prev!==s.user.id){if(st.email&&st.email!==s.user.email){st={synced:{},cursor:{},role:null};db={units:[],locations:[],moves:[]}}st.email=s.user.email;keep();run().then(()=>{gate();render()})}
  if(!s&&ev==='SIGNED_OUT'){gate()}status()});
 addEventListener('online',()=>run());document.addEventListener('visibilitychange',()=>{if(!document.hidden)run()});setInterval(run,45000);
 document.addEventListener('click',e=>{if(e.target.id==='sync')run()});
 return {sb,stamp,run,status,isAdmin,applyRole,gate,signOut,soon(){clearTimeout(timer);timer=setTimeout(run,1200);status()},get role(){return st.role},get name(){return st.name},get email(){return st.email}};
})();
Sync.applyRole();render();
