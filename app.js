'use strict';
const BASE_TYPES=['crane','excavator','dozer','loader','backhoe','dump truck','semi','water truck','roller','motor grader','mixer/stabilizer','broom','skid steer','light tower','compressor/generator/pump','forklift/lift','screed','trailer','pickup/service truck','UTV/ATV/cart','tractor/mower','other'];
const TYPES=()=>[...new Set([...BASE_TYPES,...db.units.map(u=>u.type)])];
const EXTRA=[['year','Year'],['serial','Serial / VIN'],['plate','License plate'],['company','Company'],['subCompany','Sub company'],['owner','Owner / lienholder'],['warranty','Warranty'],['airtag','AirTag #']];
const KEY='fleetTracker.v1';
let db=load();
function load(){try{const d=JSON.parse(localStorage.getItem(KEY));if(d&&d.units)return d}catch(e){}return {units:[],locations:[],moves:[]}}
async function fetchMaster(){const r=await fetch('units.json');if(!r.ok)throw new Error('units.json '+r.status);const j=await r.json();const list=Array.isArray(j)?j:j.units;(j.dealers||[]).forEach(n=>{const nm=ensureLoc(n),l=db.locations.find(x=>x.name===nm);if(l)l.dealer=true});return list}
function mergeMaster(list){let a=0,u=0;list.forEach(m=>{const ex=db.units.find(x=>x.num.toLowerCase()===m.num.toLowerCase());const f={...m};delete f.row;if(f.loc)f.loc=ensureLoc(f.loc);
 if(ex){const keepLoc=ex.loc&&db.moves.some(x=>x.unitId===ex.id);['hours','dueService','regExp','lastService','section'].forEach(k=>delete ex[k]);Object.keys(f).forEach(k=>{if(k==='loc'&&keepLoc)return;if(f[k]!=='')ex[k]=f[k]});u++}else{db.units.push({id:uid(),retired:false,...f});a++}if(f.loc)ensureLoc(f.loc)});save();return {a,u}}
async function firstRun(){if(db.units.length)return;try{const r=mergeMaster(await fetchMaster());toast(`Loaded master list: ${r.a} units`);render()}catch(e){console.warn(e)}}
function save(){if(typeof Sync!=="undefined")Sync.stamp(db);localStorage.setItem(KEY,JSON.stringify(db));banner();if(typeof Sync!=="undefined")Sync.soon()}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
const $=s=>document.querySelector(s),app=$('#app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=iso=>iso?new Date(iso).toLocaleString([], {month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}):'—';
const localDT=d=>{const z=new Date(d.getTime()-d.getTimezoneOffset()*6e4);return z.toISOString().slice(0,16)};
function toast(m){const t=document.createElement('div');t.className='toast';t.textContent=m;document.body.append(t);setTimeout(()=>t.remove(),2200)}
function banner(){$('#banner').hidden=!db.units.some(u=>u.sample)&&!db.moves.some(m=>m.sample)}
$('#clearSample').onclick=()=>{if(!confirm('Remove all sample units, locations and moves?'))return;
 const used=new Set(db.units.filter(u=>!u.sample).map(u=>u.loc));db.units=db.units.filter(u=>!u.sample);db.moves=db.moves.filter(m=>!m.sample);
 db.locations=db.locations.filter(l=>!l.sample||used.has(l.name));db.locations.forEach(l=>delete l.sample);save();render();toast('Sample data cleared')};
const hay=u=>[u.num,u.desc,u.type,u.loc,...EXTRA.map(([k])=>u[k])].join(' ').toLowerCase();
const unit=id=>db.units.find(u=>u.id===id);
const lastMove=id=>db.moves.filter(m=>m.unitId===id).sort((a,b)=>b.at.localeCompare(a.at))[0];
function ensureLoc(n){n=(n||'').trim();if(!n)return n;const ex=db.locations.find(l=>l.name.toLowerCase()===n.toLowerCase());if(ex){delete ex.archived;return ex.name}db.locations.push({id:uid(),name:n});return n}
const locOpts=(sel,blank)=>(blank?`<option value="">${blank}</option>`:'')+db.locations.filter(l=>!l.archived||l.name===sel).map(l=>l.name).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).map(n=>`<option ${n===sel?'selected':''}>${esc(n)}</option>`).join('');
const typeOpts=(sel,blank)=>(blank?`<option value="">${blank}</option>`:'')+TYPES().map(t=>`<option ${t===sel?'selected':''}>${t}</option>`).join('');
const locNames=()=>db.locations.filter(l=>!l.archived).map(l=>l.name).sort(Combo.numCmp);
const distinct=k=>[...new Set(db.units.map(u=>String(u[k]||'').trim()).filter(Boolean))].sort(Combo.numCmp);
const drivers=()=>[...new Set(db.moves.map(m=>m.driver).filter(Boolean))].sort(Combo.numCmp);
const semis=()=>[...new Set([...db.units.filter(u=>u.type==='semi'&&!u.retired).map(u=>u.num),...db.moves.map(m=>m.hauledBy).filter(Boolean)])].sort(Combo.numCmp);
let tab='fleet',ff={q:'',type:'',loc:'',ret:false},lf={unit:'',from:'',to:'',st:'all'};
const done=m=>m.status==='completed',pendN=ms=>ms.filter(m=>!done(m)).length;
/* order: PENDING first, then COMPLETED; newest move date/time first inside each group */
const sortMoves=ms=>ms.slice().sort((a,b)=>(done(a)-done(b))||String(b.at).localeCompare(String(a.at))||String(b.id).localeCompare(String(a.id)));
/* list html: cards in sorted order, with a quiet 'Pending (N)' / 'Completed (N)' heading per group */
function moveList(ms,heads=true){ms=sortMoves(ms);if(!heads)return ms.map(moveCard).join('');const p=ms.filter(m=>!done(m)),c=ms.filter(done);
 return (p.length?`<div class="grp grp-pend">Pending (${p.length})</div>`+p.map(moveCard).join(''):'')+(c.length?`<div class="grp grp-done">Completed (${c.length})</div>`+c.map(moveCard).join(''):'')}
/* run a re-render after a status change: keep scroll where it is and slide the other cards into place */
function flipRender(run,movedId){const y=scrollY,vh=innerHeight,first={};
 document.querySelectorAll('[data-mid]').forEach(c=>first[c.dataset.mid]=c.getBoundingClientRect().top);
 run();if(Math.abs(scrollY-y)>0)scrollTo(0,y);
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 document.querySelectorAll('[data-mid]').forEach(c=>{const id=c.dataset.mid,t=c.getBoundingClientRect().top;
  if(id===movedId){c.classList.add('mv-land');return}
  const o=first[id];if(o==null)return;const d=o-t;if(Math.abs(d)<2||(o<-200&&t<-200)||(o>vh+200&&t>vh+200))return;
  c.style.transition='none';c.style.transform=`translateY(${d}px)`;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{c.style.transition='transform .3s ease';c.style.transform='';setTimeout(()=>{c.style.transition=''},350)}))})}
/* change a move's status: save now, fade the card out, then re-render in the new order */
function changeStatus(btn,apply,after){const card=btn.closest('[data-mid]'),id=card.dataset.mid;if(card.dataset.busy)return;card.dataset.busy=1;apply();
 const go=()=>{if(!document.contains(card))return;flipRender(after,id)};
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)go();else{card.classList.add('mv-out');setTimeout(go,170)}}
function pendBadge(){const b=document.querySelector('nav [data-tab=log]');if(!b)return;let c=b.querySelector('.pc');if(!c){c=document.createElement('b');c.className='pc';b.append(c)}const n=pendN(db.moves);c.textContent=n;c.hidden=!n;c.title=n+' pending move(s)'}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>go(b.dataset.tab));
function go(t,arg){curArg=undefined;if((t==='users')&&!Sync.isAdmin())t='fleet';tab=t;document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));render(arg);scrollTo(0,0)}
let curArg;function render(arg){if(arg!==undefined)curArg=arg;else arg=curArg;banner();pendBadge();({fleet:rFleet,move:rMove,log:rLog,data:rData,unit:rUnit,users:rUsers})[tab](arg)}
/* FLEET */
function rFleet(){app.innerHTML=`<div class="bar"><input id="q" type="search" placeholder="Search unit #, description, serial/VIN, plate…" value="${esc(ff.q)}">
<select id="ft">${typeOpts(ff.type,'All types')}</select><select id="fl">${locOpts(ff.loc,'All locations')}</select><button id="addU">+ Unit</button></div>
<label style="font-weight:400"><input type="checkbox" id="fr" style="width:auto;min-height:auto" ${ff.ret?'checked':''}> Show retired</label><div id="list"></div>`;
 $('#q').oninput=e=>{ff.q=e.target.value;list()};$('#ft').onchange=e=>{ff.type=e.target.value;list()};$('#fl').onchange=e=>{ff.loc=e.target.value;list()};$('#fr').onchange=e=>{ff.ret=e.target.checked;list()};
 $('#addU').onclick=()=>editUnit();list()}
function list(){const q=ff.q.toLowerCase();const us=db.units.filter(u=>(ff.ret||!u.retired)&&(!ff.type||u.type===ff.type)&&(!ff.loc||u.loc===ff.loc)&&(!q||hay(u).includes(q)))
 .sort((a,b)=>a.num.localeCompare(b.num,undefined,{numeric:true}));
 $('#list').innerHTML=`<div class="s" style="margin:8px 0">${us.length} unit(s)</div>`+us.map(u=>{const m=lastMove(u.id);return `<div class="card tap" data-id="${u.id}"><div class="m"><span class="u">${esc(u.num)}</span><span class="tag">${u.type}</span>${u.sample?'<span class="tag sample">SAMPLE</span>':''}${u.retired?'<span class="tag ret">RETIRED</span>':''}<div class="s">${esc(u.desc)}</div></div><div class="loc">${esc(u.loc||'—')}<div class="s">Last move: ${m?fmt(m.at):'—'}</div></div></div>`}).join('')||'<p>No units. Tap "+ Unit" or import on the Data tab.</p>';
 document.querySelectorAll('#list .card').forEach(c=>c.onclick=()=>go('unit',c.dataset.id))}
function rUnit(id){const u=unit(id);if(!u)return go('fleet');const ms=sortMoves(db.moves.filter(m=>m.unitId===id));
 app.innerHTML=`<button class="sec" id="back">‹ Fleet</button><h2>${esc(u.num)} <span class="tag">${u.type}</span>${u.retired?'<span class="tag ret">RETIRED</span>':''}</h2>
<div class="s">${esc(u.desc)}</div><p>Current location: <b>${esc(u.loc||'—')}</b>${db.locations.some(l=>l.name===u.loc&&l.dealer)?' <span class="tag sample">DEALER/REPAIR</span>':''}</p>
<dl class="facts">${EXTRA.filter(([k])=>u[k]).map(([k,l])=>`<dt>${l}</dt><dd>${esc(u[k])}</dd>`).join('')}</dl>
<div class="row"><button id="mv">Log move</button><button class="sec" id="ed">Edit</button><button class="${u.retired?'sec':'danger'}" id="rt">${u.retired?'Un-retire':'Retire'}</button></div>
<h2 style="margin-top:24px">Move history (${ms.length})${pendN(ms)?` <span class="badge pend">${pendN(ms)} pending</span>`:''}</h2>${moveList(ms)||'<p class="s">No moves yet.</p>'}`;
 $('#back').onclick=()=>go('fleet');$('#mv').onclick=()=>go('move',id);$('#ed').onclick=()=>editUnit(u);
 $('#rt').onclick=()=>{if(!u.retired&&!confirm('Retire '+u.num+'? History is kept.'))return;u.retired=!u.retired;save();render(id)};bindMoveCards(()=>render(id))}
function editUnit(u){const n=!u;u=u||{type:'crane',loc:''};
 $('#dlgBody').innerHTML=`<h2>${n?'Add unit':'Edit '+esc(u.num)}</h2><label>Unit number</label><input id="un" value="${esc(u.num||'')}">
<label>Type</label><select id="ut">${typeOpts(u.type)}</select><label>Description</label><input id="ud" value="${esc(u.desc||'')}">
${EXTRA.map(([k,l])=>`<label>${l}</label><input data-x="${k}" value="${esc(u[k]||'')}">`).join('')}<label>Current location</label><input id="ul" value="${esc(u.loc)}" placeholder="Pick or type new">
<div class="row"><button id="us">Save</button><button class="sec" id="uc">Cancel</button></div>`;
 const d=$('#dlg');Combo.attach($('#ul'),locNames,{add:'Add new location'});['company','subCompany','owner','warranty'].forEach(k=>Combo.attach(document.querySelector(`#dlgBody [data-x=${k}]`),()=>distinct(k),{add:'Use'}));d.showModal();$('#uc').onclick=()=>d.close();
 $('#us').onclick=()=>{const num=$('#un').value.trim();if(!num)return alert('Unit number required');
  if(db.units.some(x=>x.num.toLowerCase()===num.toLowerCase()&&x.id!==u.id))return alert('Unit '+num+' already exists');
  Object.assign(u,{num,type:$('#ut').value,desc:$('#ud').value.trim(),loc:ensureLoc($('#ul').value)});document.querySelectorAll('#dlgBody [data-x]').forEach(i=>u[i.dataset.x]=i.value.trim());
  if(n){u.id=uid();u.retired=false;db.units.push(u)}else{delete u.sample;db.moves.forEach(m=>{if(m.unitId===u.id)m.unitNum=u.num})}save();d.close();render(tab==='unit'?u.id:undefined);toast('Unit saved')}}
/* MOVE */
function rMove(pre){let sel=pre?unit(pre):null;
 app.innerHTML=`<h2>Log a move</h2><label>Unit</label><select id="mu"><option value="">Search unit # or tap to choose…</option>${db.units.filter(u=>!u.retired||(sel&&sel.id===u.id)).slice().sort((a,b)=>a.num.localeCompare(b.num,undefined,{numeric:true})).map(u=>`<option value="${u.id}" data-short="${esc(u.num)}" data-s="${esc(hay(u))}" ${sel&&sel.id===u.id?'selected':''}>${esc(u.num)} · ${esc(u.type)} · ${esc(u.loc||'—')}</option>`).join('')}</select>
<div class="grid2"><div><label>From</label><select id="mf">${locOpts('', '—')}</select></div><div><label>To</label><select id="mt">${locOpts('','Choose destination')}${Sync.isAdmin()?'<option value="__new">+ New location…</option>':''}</select></div>
<div><label>Date / time</label><input id="md" type="datetime-local" value="${localDT(new Date())}"></div>
<div><label>Hauled by (semi, optional)</label><select id="mh"><option value="">—</option>${db.units.filter(u=>u.type==='semi'&&!u.retired).map(u=>`<option>${esc(u.num)}</option>`).join('')}</select></div>
<div><label>Driver (optional)</label><input id="mdr"></div></div>
<label>Note</label><textarea id="mn"></textarea>
<label class="donechk"><input type="checkbox" id="mdone"> Move is already completed (unit has arrived)</label><div class="row"><button id="ms" style="flex:1">Save move</button></div>`;
 const setFrom=()=>{if(sel&&sel.loc){ensureLoc(sel.loc);$('#mf').innerHTML=locOpts(sel.loc,'—')}};
 $('#mu').onchange=()=>{sel=unit($('#mu').value)||null;setFrom()};setFrom();
 Combo.attach($('#mdr'),drivers,{add:'Use'});
 $('#mt').onchange=e=>{if(e.target.value!=='__new')return;const n=prompt('New location name (yard or job site)');if(n){ensureLoc(n);save();$('#mt').innerHTML=locOpts(n.trim(),'Choose destination')+'<option value="__new">+ New location…</option>'}else e.target.value=''};
 $('#ms').onclick=()=>{if(!sel)return alert('Pick a unit');const to=$('#mt').value;if(!to||to==='__new')return alert('Choose a destination');
  const m={id:uid(),unitId:sel.id,unitNum:sel.num,from:$('#mf').value,to,at:new Date($('#md').value||Date.now()).toISOString(),hauledBy:$('#mh').value,driver:$('#mdr').value.trim(),note:$('#mn').value.trim(),status:'pending'};
  if($('#mdone').checked)Object.assign(m,{status:'completed',completedAt:new Date().toISOString(),completedBy:who()});
  db.moves.push(m);const lm=lastMove(sel.id);sel.loc=lm.to;save();toast(`${sel.num} → ${to}`);go('unit',sel.id)}}
const who=()=>Sync.name||Sync.email||'me';
function moveCard(m){const ok=done(m);return `<div class="card mv ${ok?'mv-done':'mv-pend'}" data-mid="${m.id}"><div class="m"><span class="u">${esc(m.unitNum)}</span>${ok?'<span class="badge done">Completed ✓</span>':'<span class="badge pend">Pending</span>'}${m.sample?'<span class="tag sample">SAMPLE</span>':''}
<div>${esc(m.from||'—')} → <b>${esc(m.to)}</b></div><div class="s">${[m.hauledBy&&'Hauled by '+esc(m.hauledBy),m.driver&&'Driver: '+esc(m.driver),m.note&&esc(m.note)].filter(Boolean).join(' · ')}</div>
<div class="vst">${ok?`Completed${m.completedBy?' by <b>'+esc(m.completedBy)+'</b>':''}${m.completedAt?' · '+fmt(m.completedAt):''}`:'Not yet confirmed as completed'}</div></div>
<div class="loc">${fmt(m.at)}<div class="mvb"><button class="sec edm">Edit</button>${ok?'<button class="sec mundo">Undo</button>':'<button class="mdone">Done ✓</button>'}<button class="sec del">Delete</button></div></div></div>`}
function relocate(id){const u=unit(id),lm=u&&lastMove(id);if(lm)u.loc=lm.to}
function editMove(m,after){
 $('#dlgBody').innerHTML=`<h2>Edit move</h2><label>Unit</label><select id="eu">${db.units.slice().sort((a,b)=>a.num.localeCompare(b.num,undefined,{numeric:true})).map(u=>`<option value="${u.id}" ${u.id===m.unitId?'selected':''}>${esc(u.num)} · ${esc(u.desc)}</option>`).join('')}</select>
<div class="grid2"><div><label>From</label><input id="ef" value="${esc(m.from)}"></div><div><label>To</label><input id="et" value="${esc(m.to)}"></div>
<div><label>Date / time</label><input id="ed2" type="datetime-local" value="${localDT(new Date(m.at))}"></div><div><label>Hauled by</label><input id="eh" value="${esc(m.hauledBy)}"></div>
<div><label>Driver</label><input id="edr" value="${esc(m.driver)}"></div></div><label>Note</label><textarea id="en">${esc(m.note)}</textarea>
<div class="row"><button id="es">Save</button><button class="sec" id="ec">Cancel</button></div>`;
 const d=$('#dlg');[$('#ef'),$('#et')].forEach(i=>Combo.attach(i,locNames,{add:'Add new location'}));Combo.attach($('#eh'),semis,{add:'Use'});Combo.attach($('#edr'),drivers,{add:'Use'});d.showModal();$('#ec').onclick=()=>d.close();
 $('#es').onclick=()=>{const to=ensureLoc($('#et').value);if(!to)return alert('Destination required');const old=m.unitId;const u=unit($('#eu').value);
  Object.assign(m,{unitId:u.id,unitNum:u.num,from:ensureLoc($('#ef').value),to,at:new Date($('#ed2').value||m.at).toISOString(),hauledBy:$('#eh').value.trim(),driver:$('#edr').value.trim(),note:$('#en').value.trim()});
  delete m.sample;relocate(old);relocate(u.id);save();d.close();after();toast('Move updated')}}
function bindMoveCards(after){const mv=b=>db.moves.find(x=>x.id===b.closest('[data-mid]').dataset.mid);
 document.querySelectorAll('[data-mid] .mdone').forEach(b=>b.onclick=e=>{e.stopPropagation();const m=mv(b);changeStatus(b,()=>{Object.assign(m,{status:'completed',completedAt:new Date().toISOString(),completedBy:who()});save();toast(m.unitNum+' marked completed')},after)});
 document.querySelectorAll('[data-mid] .mundo').forEach(b=>b.onclick=e=>{e.stopPropagation();const m=mv(b);if(!confirm(`Undo completion of ${m.unitNum} → ${m.to}? It will show as Pending again.`))return;changeStatus(b,()=>{m.status='pending';delete m.completedAt;delete m.completedBy;save();toast('Marked pending')},after)});
 document.querySelectorAll('[data-mid] .edm').forEach(b=>b.onclick=e=>{e.stopPropagation();editMove(db.moves.find(x=>x.id===b.closest('[data-mid]').dataset.mid),after)});document.querySelectorAll('[data-mid] .del').forEach(b=>b.onclick=e=>{e.stopPropagation();const id=b.closest('[data-mid]').dataset.mid;const m=db.moves.find(x=>x.id===id);
 if(!confirm('Delete this move?'))return;db.moves=db.moves.filter(x=>x.id!==id);const u=unit(m.unitId),lm=u&&lastMove(u.id);if(u&&lm)u.loc=lm.to;else if(u&&m.from)u.loc=m.from;save();after()})}
/* LOG */
function filteredMoves(){const r=db.moves.filter(m=>(!lf.unit||m.unitNum.toLowerCase().includes(lf.unit.toLowerCase()))&&(!lf.from||m.at>=new Date(lf.from+'T00:00').toISOString())&&(!lf.to||m.at<=new Date(lf.to+'T23:59:59').toISOString())&&(lf.st==='all'||(lf.st==='completed')===done(m)));return sortMoves(r)}
function rLog(){app.innerHTML=`<div class="bar"><input id="lu" type="search" placeholder="Filter by unit #" value="${esc(lf.unit)}"><input id="lfrom" type="date" value="${lf.from}"><input id="lto" type="date" value="${lf.to}"><button id="lx">Export CSV</button></div><div class="seg" id="lst" role="tablist"></div><div id="ll"></div>`;
 const f=()=>{const all=db.moves.length,p=pendN(db.moves);$('#lst').innerHTML=[['pending','Pending',p],['completed','Completed',all-p],['all','All',all]].map(([v,l,n])=>`<button data-st="${v}" class="${lf.st===v?'on':''} st-${v}">${l} <b>${n}</b></button>`).join('');$('#lst').querySelectorAll('button').forEach(b=>b.onclick=()=>{lf.st=b.dataset.st;f()});pendBadge();const ms=filteredMoves();$('#ll').innerHTML=`<div class="s" style="margin:8px 0">${ms.length} move(s)</div>`+moveList(ms,lf.st==='all');bindMoveCards(f)};
 Combo.attach($('#lu'),()=>[...new Set([...db.units.map(u=>u.num),...db.moves.map(m=>m.unitNum)])].sort(Combo.numCmp));
 $('#lu').oninput=e=>{lf.unit=e.target.value;f()};$('#lfrom').onchange=e=>{lf.from=e.target.value;f()};$('#lto').onchange=e=>{lf.to=e.target.value;f()};$('#lx').onclick=()=>exportMoves(filteredMoves());f()}
/* DATA */
const csvCell=v=>{v=String(v??'');return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
const toCSV=rows=>rows.map(r=>r.map(csvCell).join(',')).join('\r\n');
function download(name,text,type){const b=new Blob([text],{type});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),5000)}
const stamp=()=>localDT(new Date()).slice(0,10);
function exportMoves(ms){download(`fleet-moves-${stamp()}.csv`,toCSV([['Date/Time','Unit','From','To','Hauled By','Driver','Note','Status','Completed At','Completed By'],...ms.map(m=>[new Date(m.at).toLocaleString(),m.unitNum,m.from,m.to,m.hauledBy,m.driver,m.note,done(m)?'completed':'pending',m.completedAt?new Date(m.completedAt).toLocaleString():'',m.completedBy||''])]),'text/csv')}
function exportUnits(){download(`fleet-units-${stamp()}.csv`,toCSV([['Unit','Type','Description','Location','Last Move','Retired',...EXTRA.map(x=>x[1])],...db.units.map(u=>{const m=lastMove(u.id);return [u.num,u.type,u.desc,u.loc,m?new Date(m.at).toLocaleString():'',u.retired?'yes':'',...EXTRA.map(([k])=>u[k]||'')]})]),'text/csv')}
function parseCSV(t){const rows=[];let r=[],c='',q=false;for(let i=0;i<t.length;i++){const ch=t[i];if(q){if(ch==='"'){if(t[i+1]==='"'){c+='"';i++}else q=false}else c+=ch}
 else if(ch==='"')q=true;else if(ch===','||ch==='\t'){r.push(c);c=''}else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&t[i+1]==='\n')i++;r.push(c);rows.push(r);r=[];c=''}else c+=ch}
 r.push(c);rows.push(r);return rows.map(r=>r.map(x=>x.trim())).filter(r=>r.some(Boolean))}
function normType(t){t=(t||'').toLowerCase();if(t.includes('crane'))return 'crane';if(t.includes('exc'))return 'excavator';if(t.includes('dump'))return 'dump truck';if(t.includes('semi')||t.includes('tractor')||t.includes('truck'))return 'semi';return 'other'}
let showArch=false;
function archiveLoc(l){const us=db.units.filter(u=>u.loc===l.name&&!u.retired);
 if(!us.length){if(!confirm(`Archive "${l.name}"? It stays in move history but is hidden from pickers.`))return;l.archived=true;save();render();return}
 $('#dlgBody').innerHTML=`<h2>Archive ${esc(l.name)}</h2><p>${us.length} unit(s) are still here: <b>${us.map(u=>esc(u.num)).join(', ')}</b></p><label>Where did they go?</label>
<select id="aw">${db.locations.filter(x=>!x.archived&&x!==l).map(x=>x.name).sort().map(n=>`<option>${esc(n)}</option>`).join('')}${Sync.isAdmin()?'<option value="__new">+ New location…</option>':''}</select>
<label style="font-weight:400"><input type="checkbox" id="alog" checked style="width:auto;min-height:auto"> Log a move for each unit (dated now)</label>
<div class="row"><button id="ago">Move units &amp; archive</button><button class="sec" id="acx">Cancel</button></div>`;
 const d=$('#dlg');d.showModal();$('#acx').onclick=()=>d.close();
 $('#ago').onclick=()=>{let to=$('#aw').value;if(to==='__new'){to=ensureLoc(prompt('New location name')||'');if(!to)return}const now=new Date().toISOString();
  us.forEach(u=>{if($('#alog').checked)db.moves.push({id:uid(),unitId:u.id,unitNum:u.num,from:l.name,to,at:now,hauledBy:'',driver:'',note:`Location "${l.name}" archived`});u.loc=to});
  l.archived=true;save();d.close();render();toast(`${us.length} unit(s) moved to ${to}; ${l.name} archived`)}}
async function rUsers(){app.innerHTML='<h2>Users</h2><p class="s">Loading…</p>';
 const {data,error}=await Sync.sb.from('profiles').select('id,email,name,role,created_at').order('created_at');
 if(error){app.innerHTML=`<h2>Users</h2><p>Could not load users (${esc(error.message)}). Users can only be managed while online.</p>`;return}
 app.innerHTML=`<h2>Users</h2><p class="s">To add someone: have them open this site, tap <b>Create account</b>, then approve them here. <b>Admin</b> = full edit + manage users. <b>User</b> = view fleet + log moves. <b>Pending</b> = no access.</p>`+
 data.map(p=>`<div class="card"><div class="m"><span class="u" style="font-size:18px">${esc(p.name||p.email)}</span>${p.role==='pending'?'<span class="tag sample">NEEDS APPROVAL</span>':''}<div class="s">${esc(p.email)}</div></div>
 <select data-plain data-uid="${p.id}" style="width:auto">${['admin','user','pending'].map(r=>`<option ${r===p.role?'selected':''}>${r}</option>`).join('')}</select></div>`).join('');
 document.querySelectorAll('[data-uid]').forEach(s=>s.onchange=async()=>{if(s.dataset.uid===data.find(p=>p.email===Sync.email)?.id&&s.value!=='admin'&&!confirm('Remove your own admin access?'))return rUsers();
  const {error}=await Sync.sb.from('profiles').update({role:s.value}).eq('id',s.dataset.uid);toast(error?'Failed: '+error.message:'Role updated');rUsers()})}
function rData(){const L=db.locations.map(l=>l.name).sort();
 app.innerHTML=`<h2>Account</h2><p class="s">Signed in as <b>${esc(Sync.email||'')}</b> · role <b>${esc(Sync.role||'')}</b></p><div class="row"><button class="sec" id="cpw">Change password</button><button class="sec" id="sout">Sign out</button><button class="sec" id="snow">Sync now</button></div>
<div class="adm"><h2 style="margin-top:28px">Bulk import units</h2><p class="s">Paste one unit per line: <b>unit number, type, description, location</b> (CSV or tab-separated from Excel; only the unit number is required). A header row is skipped. Existing unit numbers are updated.</p>
<textarea id="imp" placeholder="214, crane, Grove GMK5250L, Main Yard&#10;E-31, excavator, CAT 336, Job: I-45"></textarea>
<div class="row"><button id="doImp">Import</button><label class="btn sec" style="display:inline-flex;align-items:center;margin:0;font-weight:400;color:#1b1f24;background:#dde3ea">Choose CSV file<input type="file" id="impF" accept=".csv,.txt,text/csv" hidden></label></div>
<h2 style="margin-top:28px">Master equipment list</h2><p class="s">Adds any missing units from the bundled company list and refreshes their details by unit number. Locations of units you have logged moves for are kept.</p><div class="row"><button id="lm">Load master equipment list</button></div>
</div><h2 style="margin-top:28px">Export</h2><div class="row"><button id="xm">Moves CSV</button><button id="xu">Units CSV</button></div>
<div class="adm"><h2 style="margin-top:28px">Backup &amp; restore</h2><p class="s">Data syncs to the cloud. A JSON backup is an extra safety copy. Restoring replaces the cloud data for everyone.</p>
<div class="row"><button id="bk">Download JSON backup</button><label class="btn sec" style="display:inline-flex;align-items:center;margin:0;font-weight:400;color:#1b1f24;background:#dde3ea">Restore from backup…<input type="file" id="rs" accept=".json,application/json" hidden></label></div>
<h2 style="margin-top:28px">Locations (${db.locations.filter(l=>!l.archived).length} active)</h2><div class="row"><input id="nl" placeholder="New yard or job site" style="flex:1"><button id="al">Add</button></div>
${db.locations.slice().sort((a,b)=>(!!a.archived-!!b.archived)||a.name.localeCompare(b.name,undefined,{numeric:true})).filter(l=>!l.archived||showArch).map(l=>`<div class="card"><div class="m">${esc(l.name)}${l.dealer?'<span class="tag sample">DEALER/REPAIR</span>':''}${l.archived?'<span class="tag ret">ARCHIVED</span>':''}</div><div class="s">${db.units.filter(u=>u.loc===l.name&&!u.retired).length} units</div><button class="sec dk" data-l="${l.id}" style="min-height:44px">${l.dealer?'Unmark':'Dealer'}</button><button class="sec rn" data-l="${l.id}" style="min-height:44px">Rename</button>${l.archived?`<button class="sec ua" data-l="${l.id}" style="min-height:44px">Restore</button>`:`<button class="sec ar" data-l="${l.id}" style="min-height:44px">Archive</button>`}</div>`).join('')}
<div class="row"><button class="sec" id="sa">${showArch?'Hide':'Show'} archived (${db.locations.filter(l=>l.archived).length})</button></div>
</div><p class="s" style="margin-top:28px">${db.units.length} units · ${db.moves.length} moves · stored on this device</p>
`;
 const runImp=t=>{let rows=parseCSV(t);if(rows[0]&&/unit/i.test(rows[0][0]))rows=rows.slice(1);let a=0,up=0;
  rows.forEach(([num,type,desc,loc])=>{if(!num)return;const ex=db.units.find(u=>u.num.toLowerCase()===num.toLowerCase());const o={num,type:normType(type),desc:desc||'',loc:ensureLoc(loc)};
   if(ex){Object.assign(ex,{type:type?o.type:ex.type,desc:desc||ex.desc,loc:o.loc||ex.loc});delete ex.sample;up++}else{db.units.push({id:uid(),...o,retired:false});a++}});
  save();toast(`Imported: ${a} added, ${up} updated`);render()};
 $('#doImp').onclick=()=>runImp($('#imp').value);$('#impF').onchange=e=>e.target.files[0]&&e.target.files[0].text().then(runImp);
 $('#xm').onclick=()=>exportMoves(sortMoves(db.moves));$('#xu').onclick=exportUnits;$('#sout').onclick=()=>Sync.signOut();$('#snow').onclick=()=>Sync.run();
 $('#cpw').onclick=async()=>{const p=prompt('New password (8+ characters)');if(!p)return;const {error}=await Sync.sb.auth.updateUser({password:p});alert(error?'Failed: '+error.message:'Password changed')};
 $('#lm').onclick=async()=>{try{const r=mergeMaster(await fetchMaster());toast(`Master list: ${r.a} added, ${r.u} updated`);render()}catch(e){alert('Could not load master list: '+e.message)}};
 $('#bk').onclick=()=>download(`fleet-backup-${stamp()}.json`,JSON.stringify({app:'fleet-tracker',version:1,exported:new Date().toISOString(),...db},null,1),'application/json');
 $('#rs').onchange=e=>{const f=e.target.files[0];if(!f)return;f.text().then(t=>{try{const d=JSON.parse(t);if(!Array.isArray(d.units)||!Array.isArray(d.moves))throw 0;
  if(!confirm(`Replace all data with backup (${d.units.length} units, ${d.moves.length} moves)?`))return;db={units:d.units,moves:d.moves,locations:d.locations||[]};save();toast('Restored');render()}catch(x){alert('Not a valid backup file')}})};
 $('#al').onclick=()=>{if(ensureLoc($('#nl').value)){save();render()}};
 document.querySelectorAll('.rn').forEach(b=>b.onclick=()=>{const l=db.locations.find(x=>x.id===b.dataset.l);const n=(prompt('Rename location',l.name)||'').trim();if(!n||n===l.name)return;
  const dup=db.locations.find(x=>x!==l&&x.name.toLowerCase()===n.toLowerCase());const old=l.name;if(dup&&!confirm(`"${dup.name}" already exists. Merge "${old}" into it?`))return;const nn=dup?dup.name:n;
  db.units.forEach(u=>{if(u.loc===old)u.loc=nn});db.moves.forEach(m=>{if(m.from===old)m.from=nn;if(m.to===old)m.to=nn});if(dup)db.locations=db.locations.filter(x=>x!==l);else l.name=nn;save();render();toast('Location renamed')});
 document.querySelectorAll('.dk').forEach(b=>b.onclick=()=>{const l=db.locations.find(x=>x.id===b.dataset.l);l.dealer=!l.dealer;save();render()});
 $('#sa').onclick=()=>{showArch=!showArch;render()};
 document.querySelectorAll('.ua').forEach(b=>b.onclick=()=>{delete db.locations.find(x=>x.id===b.dataset.l).archived;save();render()});
 document.querySelectorAll('.ar').forEach(b=>b.onclick=()=>archiveLoc(db.locations.find(x=>x.id===b.dataset.l)));}
if(navigator.storage&&navigator.storage.persist)navigator.storage.persist();
if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js'));


function setHH(){document.documentElement.style.setProperty('--hh',(getComputedStyle(document.querySelector('header')).position==='sticky'?document.querySelector('header').offsetHeight:0)+'px')}
addEventListener('resize',setHH);addEventListener('orientationchange',setHH);setHH();
document.addEventListener('focusin',e=>{if(e.target.matches('input,textarea,select')&&matchMedia('(max-width:760px)').matches)setTimeout(()=>e.target.scrollIntoView({block:'center',behavior:'smooth'}),350)});
