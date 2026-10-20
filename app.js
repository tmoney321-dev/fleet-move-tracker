'use strict';
const TYPES=['crane','excavator','dump truck','semi','other'];
const KEY='fleetTracker.v1';
let db=load();
function load(){try{const d=JSON.parse(localStorage.getItem(KEY));if(d&&d.units)return d}catch(e){}return seed()}
function save(){localStorage.setItem(KEY,JSON.stringify(db));banner()}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function seed(){const L=['Main Yard','North Yard','Job: I-45 Bridge','Job: Hwy 59 Widening'];
 const d={units:[],locations:L.map(n=>({id:uid(),name:n,sample:true})),moves:[]};
 [['SAMPLE-C101','crane','Liebherr LTM 1100 all-terrain crane',L[0]],['SAMPLE-E205','excavator','CAT 349 excavator',L[2]],['SAMPLE-D310','dump truck','Volvo A40G articulated dump',L[3]],['SAMPLE-S12','semi','Peterbilt 389 w/ lowboy',L[0]],['SAMPLE-S14','semi','Kenworth W900',L[1]]]
 .forEach(([n,t,ds,l])=>d.units.push({id:uid(),num:n,type:t,desc:ds,loc:l,retired:false,sample:true}));
 const e=d.units[1];d.moves.push({id:uid(),unitId:e.id,unitNum:e.num,from:L[0],to:L[2],at:new Date(Date.now()-864e5*3).toISOString(),hauledBy:'SAMPLE-S12',driver:'Sample Driver',note:'Sample move',sample:true});
 localStorage.setItem(KEY,JSON.stringify(d));return d}
const $=s=>document.querySelector(s),app=$('#app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=iso=>iso?new Date(iso).toLocaleString([], {month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}):'—';
const localDT=d=>{const z=new Date(d.getTime()-d.getTimezoneOffset()*6e4);return z.toISOString().slice(0,16)};
function toast(m){const t=document.createElement('div');t.className='toast';t.textContent=m;document.body.append(t);setTimeout(()=>t.remove(),2200)}
function banner(){$('#banner').hidden=!db.units.some(u=>u.sample)&&!db.moves.some(m=>m.sample)&&!db.locations.some(l=>l.sample)}
$('#clearSample').onclick=()=>{if(!confirm('Remove all sample units, locations and moves?'))return;
 const used=new Set(db.units.filter(u=>!u.sample).map(u=>u.loc));db.units=db.units.filter(u=>!u.sample);db.moves=db.moves.filter(m=>!m.sample);
 db.locations=db.locations.filter(l=>!l.sample||used.has(l.name));db.locations.forEach(l=>delete l.sample);save();render();toast('Sample data cleared')};
const unit=id=>db.units.find(u=>u.id===id);
const lastMove=id=>db.moves.filter(m=>m.unitId===id).sort((a,b)=>b.at.localeCompare(a.at))[0];
function ensureLoc(n){n=(n||'').trim();if(n&&!db.locations.some(l=>l.name.toLowerCase()===n.toLowerCase()))db.locations.push({id:uid(),name:n});return n}
const locOpts=(sel,blank)=>(blank?`<option value="">${blank}</option>`:'')+db.locations.map(l=>l.name).sort().map(n=>`<option ${n===sel?'selected':''}>${esc(n)}</option>`).join('');
const typeOpts=(sel,blank)=>(blank?`<option value="">${blank}</option>`:'')+TYPES.map(t=>`<option ${t===sel?'selected':''}>${t}</option>`).join('');
let tab='fleet',ff={q:'',type:'',loc:'',ret:false},lf={unit:'',from:'',to:''};
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>go(b.dataset.tab));
function go(t,arg){tab=t;document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));render(arg);scrollTo(0,0)}
function render(arg){banner();({fleet:rFleet,move:rMove,log:rLog,data:rData,unit:rUnit})[tab](arg)}
/* FLEET */
function rFleet(){app.innerHTML=`<div class="bar"><input id="q" type="search" placeholder="Search unit # or description" value="${esc(ff.q)}">
<select id="ft">${typeOpts(ff.type,'All types')}</select><select id="fl">${locOpts(ff.loc,'All locations')}</select><button id="addU">+ Unit</button></div>
<label style="font-weight:400"><input type="checkbox" id="fr" style="width:auto;min-height:auto" ${ff.ret?'checked':''}> Show retired</label><div id="list"></div>`;
 $('#q').oninput=e=>{ff.q=e.target.value;list()};$('#ft').onchange=e=>{ff.type=e.target.value;list()};$('#fl').onchange=e=>{ff.loc=e.target.value;list()};$('#fr').onchange=e=>{ff.ret=e.target.checked;list()};
 $('#addU').onclick=()=>editUnit();list()}
function list(){const q=ff.q.toLowerCase();const us=db.units.filter(u=>(ff.ret||!u.retired)&&(!ff.type||u.type===ff.type)&&(!ff.loc||u.loc===ff.loc)&&(!q||(u.num+' '+u.desc).toLowerCase().includes(q)))
 .sort((a,b)=>a.num.localeCompare(b.num,undefined,{numeric:true}));
 $('#list').innerHTML=`<div class="s" style="margin:8px 0">${us.length} unit(s)</div>`+us.map(u=>{const m=lastMove(u.id);return `<div class="card tap" data-id="${u.id}"><div class="m"><span class="u">${esc(u.num)}</span><span class="tag">${u.type}</span>${u.sample?'<span class="tag sample">SAMPLE</span>':''}${u.retired?'<span class="tag ret">RETIRED</span>':''}<div class="s">${esc(u.desc)}</div></div><div class="loc">${esc(u.loc||'—')}<div class="s">Last move: ${m?fmt(m.at):'—'}</div></div></div>`}).join('')||'<p>No units. Tap "+ Unit" or import on the Data tab.</p>';
 document.querySelectorAll('#list .card').forEach(c=>c.onclick=()=>go('unit',c.dataset.id))}
function rUnit(id){const u=unit(id);if(!u)return go('fleet');const ms=db.moves.filter(m=>m.unitId===id).sort((a,b)=>b.at.localeCompare(a.at));
 app.innerHTML=`<button class="sec" id="back">‹ Fleet</button><h2>${esc(u.num)} <span class="tag">${u.type}</span>${u.retired?'<span class="tag ret">RETIRED</span>':''}</h2>
<div class="s">${esc(u.desc)}</div><p>Current location: <b>${esc(u.loc||'—')}</b></p>
<div class="row"><button id="mv">Log move</button><button class="sec" id="ed">Edit</button><button class="${u.retired?'sec':'danger'}" id="rt">${u.retired?'Un-retire':'Retire'}</button></div>
<h2 style="margin-top:24px">Move history (${ms.length})</h2>${ms.map(moveCard).join('')||'<p class="s">No moves yet.</p>'}`;
 $('#back').onclick=()=>go('fleet');$('#mv').onclick=()=>go('move',id);$('#ed').onclick=()=>editUnit(u);
 $('#rt').onclick=()=>{if(!u.retired&&!confirm('Retire '+u.num+'? History is kept.'))return;u.retired=!u.retired;save();render(id)};bindMoveCards(()=>render(id))}
function editUnit(u){const n=!u;u=u||{type:'crane',loc:''};
 $('#dlgBody').innerHTML=`<h2>${n?'Add unit':'Edit '+esc(u.num)}</h2><label>Unit number</label><input id="un" value="${esc(u.num||'')}">
<label>Type</label><select id="ut">${typeOpts(u.type)}</select><label>Description</label><input id="ud" value="${esc(u.desc||'')}">
<label>Current location</label><input id="ul" list="locs" value="${esc(u.loc)}" placeholder="Pick or type new"><datalist id="locs">${locOpts()}</datalist>
<div class="row"><button id="us">Save</button><button class="sec" id="uc">Cancel</button></div>`;
 const d=$('#dlg');d.showModal();$('#uc').onclick=()=>d.close();
 $('#us').onclick=()=>{const num=$('#un').value.trim();if(!num)return alert('Unit number required');
  if(db.units.some(x=>x.num.toLowerCase()===num.toLowerCase()&&x.id!==u.id))return alert('Unit '+num+' already exists');
  Object.assign(u,{num,type:$('#ut').value,desc:$('#ud').value.trim(),loc:ensureLoc($('#ul').value)});
  if(n){u.id=uid();u.retired=false;db.units.push(u)}else delete u.sample;save();d.close();render(tab==='unit'?u.id:undefined);toast('Unit saved')}}
/* MOVE */
function rMove(pre){let sel=pre?unit(pre):null;
 app.innerHTML=`<h2>Log a move</h2><label>Unit</label><input id="mq" type="search" placeholder="Search unit #" value="${sel?esc(sel.num):''}"><div class="pick" id="mp"></div>
<div class="grid2"><div><label>From</label><select id="mf">${locOpts('', '—')}</select></div><div><label>To</label><select id="mt">${locOpts('','Choose destination')}<option value="__new">+ New location…</option></select></div>
<div><label>Date / time</label><input id="md" type="datetime-local" value="${localDT(new Date())}"></div>
<div><label>Hauled by (semi, optional)</label><select id="mh"><option value="">—</option>${db.units.filter(u=>u.type==='semi'&&!u.retired).map(u=>`<option>${esc(u.num)}</option>`).join('')}</select></div>
<div><label>Driver (optional)</label><input id="mdr" list="drv"><datalist id="drv">${[...new Set(db.moves.map(m=>m.driver).filter(Boolean))].map(x=>`<option>${esc(x)}</option>`).join('')}</datalist></div></div>
<label>Note</label><textarea id="mn"></textarea><div class="row"><button id="ms" style="flex:1">Save move</button></div>`;
 const pick=()=>{const q=$('#mq').value.toLowerCase();const us=db.units.filter(u=>!u.retired&&(!q||(u.num+' '+u.desc).toLowerCase().includes(q))).slice(0,40);
  $('#mp').innerHTML=us.map(u=>`<div data-id="${u.id}" class="${sel&&sel.id===u.id?'sel':''}"><b>${esc(u.num)}</b> · ${u.type} · <span class="s">${esc(u.loc||'—')}</span></div>`).join('')||'<div>No match</div>';
  $('#mp').querySelectorAll('[data-id]').forEach(x=>x.onclick=()=>{sel=unit(x.dataset.id);$('#mq').value=sel.num;setFrom();pick()})};
 const setFrom=()=>{if(sel&&sel.loc){ensureLoc(sel.loc);$('#mf').innerHTML=locOpts(sel.loc,'—')}};
 $('#mq').oninput=()=>{sel=null;pick()};pick();setFrom();
 $('#mt').onchange=e=>{if(e.target.value!=='__new')return;const n=prompt('New location name (yard or job site)');if(n){ensureLoc(n);save();$('#mt').innerHTML=locOpts(n.trim(),'Choose destination')+'<option value="__new">+ New location…</option>'}else e.target.value=''};
 $('#ms').onclick=()=>{if(!sel)return alert('Pick a unit');const to=$('#mt').value;if(!to||to==='__new')return alert('Choose a destination');
  const m={id:uid(),unitId:sel.id,unitNum:sel.num,from:$('#mf').value,to,at:new Date($('#md').value||Date.now()).toISOString(),hauledBy:$('#mh').value,driver:$('#mdr').value.trim(),note:$('#mn').value.trim()};
  db.moves.push(m);const lm=lastMove(sel.id);sel.loc=lm.to;save();toast(`${sel.num} → ${to}`);go('unit',sel.id)}}
function moveCard(m){return `<div class="card" data-mid="${m.id}"><div class="m"><span class="u">${esc(m.unitNum)}</span>${m.sample?'<span class="tag sample">SAMPLE</span>':''}
<div>${esc(m.from||'—')} → <b>${esc(m.to)}</b></div><div class="s">${[m.hauledBy&&'Hauled by '+esc(m.hauledBy),m.driver&&'Driver: '+esc(m.driver),m.note&&esc(m.note)].filter(Boolean).join(' · ')}</div></div>
<div class="loc">${fmt(m.at)}<div><button class="sec del" style="min-height:44px;margin-top:6px">Delete</button></div></div></div>`}
function bindMoveCards(after){document.querySelectorAll('[data-mid] .del').forEach(b=>b.onclick=e=>{e.stopPropagation();const id=b.closest('[data-mid]').dataset.mid;const m=db.moves.find(x=>x.id===id);
 if(!confirm('Delete this move?'))return;db.moves=db.moves.filter(x=>x.id!==id);const u=unit(m.unitId),lm=u&&lastMove(u.id);if(u&&lm)u.loc=lm.to;else if(u&&m.from)u.loc=m.from;save();after()})}
/* LOG */
function filteredMoves(){return db.moves.filter(m=>(!lf.unit||m.unitNum.toLowerCase().includes(lf.unit.toLowerCase()))&&(!lf.from||m.at>=new Date(lf.from+'T00:00').toISOString())&&(!lf.to||m.at<=new Date(lf.to+'T23:59:59').toISOString())).sort((a,b)=>b.at.localeCompare(a.at))}
function rLog(){app.innerHTML=`<div class="bar"><input id="lu" type="search" placeholder="Filter by unit #" value="${esc(lf.unit)}"><input id="lfrom" type="date" value="${lf.from}"><input id="lto" type="date" value="${lf.to}"><button id="lx">Export CSV</button></div><div id="ll"></div>`;
 const f=()=>{const ms=filteredMoves();$('#ll').innerHTML=`<div class="s" style="margin:8px 0">${ms.length} move(s)</div>`+ms.map(moveCard).join('');bindMoveCards(f)};
 $('#lu').oninput=e=>{lf.unit=e.target.value;f()};$('#lfrom').onchange=e=>{lf.from=e.target.value;f()};$('#lto').onchange=e=>{lf.to=e.target.value;f()};$('#lx').onclick=()=>exportMoves(filteredMoves());f()}
/* DATA */
const csvCell=v=>{v=String(v??'');return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
const toCSV=rows=>rows.map(r=>r.map(csvCell).join(',')).join('\r\n');
function download(name,text,type){const b=new Blob([text],{type});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),5000)}
const stamp=()=>localDT(new Date()).slice(0,10);
function exportMoves(ms){download(`fleet-moves-${stamp()}.csv`,toCSV([['Date/Time','Unit','From','To','Hauled By','Driver','Note'],...ms.map(m=>[new Date(m.at).toLocaleString(),m.unitNum,m.from,m.to,m.hauledBy,m.driver,m.note])]),'text/csv')}
function exportUnits(){download(`fleet-units-${stamp()}.csv`,toCSV([['Unit','Type','Description','Location','Last Move','Retired'],...db.units.map(u=>{const m=lastMove(u.id);return [u.num,u.type,u.desc,u.loc,m?new Date(m.at).toLocaleString():'',u.retired?'yes':'']})]),'text/csv')}
function parseCSV(t){const rows=[];let r=[],c='',q=false;for(let i=0;i<t.length;i++){const ch=t[i];if(q){if(ch==='"'){if(t[i+1]==='"'){c+='"';i++}else q=false}else c+=ch}
 else if(ch==='"')q=true;else if(ch===','||ch==='\t'){r.push(c);c=''}else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&t[i+1]==='\n')i++;r.push(c);rows.push(r);r=[];c=''}else c+=ch}
 r.push(c);rows.push(r);return rows.map(r=>r.map(x=>x.trim())).filter(r=>r.some(Boolean))}
function normType(t){t=(t||'').toLowerCase();if(t.includes('crane'))return 'crane';if(t.includes('exc'))return 'excavator';if(t.includes('dump'))return 'dump truck';if(t.includes('semi')||t.includes('tractor')||t.includes('truck'))return 'semi';return 'other'}
function rData(){const L=db.locations.map(l=>l.name).sort();
 app.innerHTML=`<h2>Bulk import units</h2><p class="s">Paste one unit per line: <b>unit number, type, description, location</b> (CSV or tab-separated from Excel; only the unit number is required). A header row is skipped. Existing unit numbers are updated.</p>
<textarea id="imp" placeholder="214, crane, Grove GMK5250L, Main Yard&#10;E-31, excavator, CAT 336, Job: I-45"></textarea>
<div class="row"><button id="doImp">Import</button><label class="btn sec" style="display:inline-flex;align-items:center;margin:0;font-weight:400;color:#1b1f24;background:#dde3ea">Choose CSV file<input type="file" id="impF" accept=".csv,.txt,text/csv" hidden></label></div>
<h2 style="margin-top:28px">Export</h2><div class="row"><button id="xm">Moves CSV</button><button id="xu">Units CSV</button></div>
<h2 style="margin-top:28px">Backup &amp; restore</h2><p class="s">Data lives only on this iPad. Make a JSON backup regularly and save it to Files / iCloud Drive / email.</p>
<div class="row"><button id="bk">Download JSON backup</button><label class="btn sec" style="display:inline-flex;align-items:center;margin:0;font-weight:400;color:#1b1f24;background:#dde3ea">Restore from backup…<input type="file" id="rs" accept=".json,application/json" hidden></label></div>
<h2 style="margin-top:28px">Locations (${L.length})</h2><div class="row"><input id="nl" placeholder="New yard or job site" style="flex:1"><button id="al">Add</button></div>
${db.locations.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(l=>`<div class="card"><div class="m">${esc(l.name)}${l.sample?'<span class="tag sample">SAMPLE</span>':''}</div><div class="s">${db.units.filter(u=>u.loc===l.name&&!u.retired).length} units</div><button class="sec dl" data-l="${l.id}" style="min-height:44px">Remove</button></div>`).join('')}
<p class="s" style="margin-top:28px">${db.units.length} units · ${db.moves.length} moves · stored on this device</p>
<div class="row"><button class="danger" id="wipe">Erase ALL data</button></div>`;
 const runImp=t=>{let rows=parseCSV(t);if(rows[0]&&/unit/i.test(rows[0][0]))rows=rows.slice(1);let a=0,up=0;
  rows.forEach(([num,type,desc,loc])=>{if(!num)return;const ex=db.units.find(u=>u.num.toLowerCase()===num.toLowerCase());const o={num,type:normType(type),desc:desc||'',loc:ensureLoc(loc)};
   if(ex){Object.assign(ex,{type:type?o.type:ex.type,desc:desc||ex.desc,loc:o.loc||ex.loc});delete ex.sample;up++}else{db.units.push({id:uid(),...o,retired:false});a++}});
  save();toast(`Imported: ${a} added, ${up} updated`);render()};
 $('#doImp').onclick=()=>runImp($('#imp').value);$('#impF').onchange=e=>e.target.files[0]&&e.target.files[0].text().then(runImp);
 $('#xm').onclick=()=>exportMoves(db.moves.slice().sort((a,b)=>b.at.localeCompare(a.at)));$('#xu').onclick=exportUnits;
 $('#bk').onclick=()=>download(`fleet-backup-${stamp()}.json`,JSON.stringify({app:'fleet-tracker',version:1,exported:new Date().toISOString(),...db},null,1),'application/json');
 $('#rs').onchange=e=>{const f=e.target.files[0];if(!f)return;f.text().then(t=>{try{const d=JSON.parse(t);if(!Array.isArray(d.units)||!Array.isArray(d.moves))throw 0;
  if(!confirm(`Replace all data with backup (${d.units.length} units, ${d.moves.length} moves)?`))return;db={units:d.units,moves:d.moves,locations:d.locations||[]};save();toast('Restored');render()}catch(x){alert('Not a valid backup file')}})};
 $('#al').onclick=()=>{if(ensureLoc($('#nl').value)){save();render()}};
 document.querySelectorAll('.dl').forEach(b=>b.onclick=()=>{const l=db.locations.find(x=>x.id===b.dataset.l);if(db.units.some(u=>u.loc===l.name))return alert('Units are still at this location.');db.locations=db.locations.filter(x=>x!==l);save();render()});
 $('#wipe').onclick=()=>{if(prompt('Type ERASE to delete everything on this device')!=='ERASE')return;db={units:[],moves:[],locations:[]};save();render()}}
if(navigator.storage&&navigator.storage.persist)navigator.storage.persist();
if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js'));
render();
