import {validateBridge1State} from './blueprint.js';
import {mountCurveControls,editCurveHandle,changeCurveType,toggleExtraPoint} from './curve-editor.js';
import {polygon} from './geometry.js';
import {curve} from './curves.js';
import {solve} from './optimizer.js';
import {createRoof3D} from './view3d.js';
import {placeRoof,placementDirection} from './layout.js';
import {bridgeDefaults,bridgeBeamLimits,upperFromLower,upperY,bridgeModel,gridWidth} from './bridge1.js';
// Bridge 1: the Curves tab's curve generator twice (lower and upper curve) plus four side beams.
// Each curve uses the same controls, handle editing, worker and block solver as the Curves tab.
const $=s=>document.querySelector(s),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),storageKey='minecraft-bridge1-design-v1';
let state=bridgeDefaults(),locks={lower:false,upper:false},part='lower',mode3d=false,depth=12,mono=false,zoom=1,pan=[0,0],drag=null,frozenView=null,selected=-1,ready=false,saveTimer=0,sceneCache=null;
const params=name=>name==='lower'?state.lower:state.upper.params;
function setParams(name,p){if(name==='lower')state.lower=p;else state.upper.params=p;}
const beamColor='#dedede',partNames={lower:'Lower curve',upper:'Upper curve'};
// ---- Fitting: one worker job per curve, exactly as the Curves tab runs it ----
function fitter(name){
 const f={roof:null,pending:false,worker:null,timer:0,watchdog:0,request:0};
 f.run=()=>{
  clearTimeout(f.timer);clearTimeout(f.watchdog);f.worker?.terminate();f.worker=null;
  const id=++f.request,input={...params(name),layout:'straight',onlyBlocks:$('#baseline').checked};f.pending=true;syncBusy();render();
  const stop=()=>{clearTimeout(f.watchdog);f.worker?.terminate();f.worker=null;};
  const finish=data=>{if(id!==f.request)return;stop();f.roof=data.roof;f.pending=false;selected=-1;syncBusy();render();scheduleSave();};
  const fail=message=>{if(id!==f.request)return;stop();f.pending=false;syncBusy();$('#busy').textContent=message;$('#busy').hidden=false;};
  let fallingBack=false;const fallback=()=>{if(id!==f.request||fallingBack)return;fallingBack=true;stop();setTimeout(()=>{if(id!==f.request)return;try{finish({roof:solve(curve(input),{onlyBlocks:input.onlyBlocks})});}catch(e){fail(e.message);}},0);};
  f.timer=setTimeout(()=>{let url;try{if(globalThis.CURVE_WORKER_SOURCE){url=URL.createObjectURL(new Blob([globalThis.CURVE_WORKER_SOURCE],{type:'text/javascript'}));f.worker=new Worker(url);}else f.worker=new Worker('./worker.js',{type:'module'});f.worker.onmessage=({data})=>data.error?fail(data.error):finish(data);f.worker.onerror=e=>{e.preventDefault();fallback();};f.worker.onmessageerror=fallback;f.watchdog=setTimeout(fallback,8000);f.worker.postMessage(input);}catch{fallback();}finally{if(url)URL.revokeObjectURL(url);}},drag?130:60);
 };
 return f;
}
const fits={lower:fitter('lower'),upper:fitter('upper')};
const busy=()=>fits.lower.pending||fits.upper.pending;
function syncBusy(){const b=busy();$('#busy').hidden=!b;if(b)$('#busy').textContent='Finding the best fit…';$('#export').disabled=b;}
// ---- Model ----
const currentModel=()=>bridgeModel({lower:state.lower,upper:state.upper,beams:state.beams,lowerRoof:fits.lower.roof,upperRoof:fits.upper.roof});
function scene(m){const key=JSON.stringify([state,depth]);if(sceneCache&&sceneCache.key===key&&sceneCache.lower===fits.lower.roof&&sceneCache.upper===fits.upper.roof)return sceneCache.model;const model=placeRoof({blocks:m.elements},depth);sceneCache={key,lower:fits.lower.roof,upper:fits.upper.roof,model};return model;}
const shape=e=>e.type==='block'?'Full block':e.type==='slab'?`${e.flip?'Upper':'Lower'} slab`:`${e.flip?'Inverted':'Upright'} stair · full half ${placementDirection(e)}`;
const partName=e=>e.part==='beam'?{'left-outer':'Left outer beam','left-inner':'Left inner beam','right-inner':'Right inner beam','right-outer':'Right outer beam'}[e.beam]:partNames[e.part];
const describe=e=>`${partName(e)} · (${e.x}, ${e.y}) · ${shape(e)}`;
const three=createRoof3D($('#preview3d'),(e,z)=>{$('#selected').textContent=describe(e)+` · z ${z}`;});
function counts(blocks){$('#blocks').textContent=blocks.filter(e=>e.type==='block').length;$('#stairs').textContent=blocks.filter(e=>e.type==='left'||e.type==='right').length;$('#slabs').textContent=blocks.filter(e=>e.type==='slab').length;$('#beam-count').textContent=blocks.filter(e=>e.part==='beam').length;}
// ---- Drawing ----
function render(){
 const box=$('#viewport').getBoundingClientRect();if(box.width<=0||box.height<=0)return;const m=currentModel();
 if(mode3d){const placed=scene(m);counts(placed.blocks);three.update(placed,depth,{mono,grid:$('#grid').checked,pending:busy(),...(mono?{}:{groupColors:{beam:beamColor}})});$('#dimensions').textContent=`${placed.maxX-placed.minX} × ${placed.maxZ-placed.minZ} footprint`;return;}
 counts(m.elements);draw2D(m,box);
}
function draw2D(m,box){
 const svg=$('#preview'),u=state.upper,lc=m.lowerCurve,uc=m.upperCurve;
 const lines={lower:[lc.points,lc.inner].map(pts=>pts.map(([x,y])=>[x+m.lowerShift,y])),upper:[uc.points,uc.inner].map(pts=>pts.map(([x,y])=>[x+m.upperShift,upperY(y,u)]))};
 let {minX,maxX,minY,maxY}=m.bounds;for(const pts of [...lines.lower,...lines.upper])for(const [x,y]of pts){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
 const aspect=box.width/box.height,baseW=Math.max(maxX-minX+6,(maxY-minY+6)*aspect),baseH=baseW/aspect;
 const view=frozenView??[(minX+maxX)/2-baseW/(2*zoom)-pan[0],-(maxY+minY)/2-baseH/(2*zoom)-pan[1],baseW/zoom,baseH/zoom];svg.setAttribute('viewBox',view.join(' '));const unit=view[2]/box.width;
 let html='<defs><pattern id="grid-pattern" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M 1 0 H 0 V 1" fill="none" stroke="#3e3e3e" stroke-width=".024"/></pattern></defs>';
 if($('#grid').checked)html+='<rect x="-2000" y="-2000" width="4000" height="4000" fill="url(#grid-pattern)"/>';
 const fill=e=>mono?'#a9a9a9':e.part==='beam'?beamColor:e.type==='block'?'#b0b0b0':e.type==='slab'?'#bababa':'#818181';
 for(const name of ['lower','beam','upper']){
  html+=`<g transform="scale(1 -1)" opacity="${fits[name]?.pending?.4:1}">`;
  m.elements.forEach((e,i)=>{if(e.part!==name)return;html+=`<polygon class="tile ${selected===i?'selected':''}" data-index="${i}" points="${polygon(e).map(a=>a.join(',')).join(' ')}" fill="${fill(e)}" stroke="#343434" stroke-width=".025"><title>${describe(e)}</title></polygon>`;});
  html+='</g>';
 }
 if($('#reference').checked)for(const name of ['lower','upper'])for(const [pts,dash]of [[lines[name][0],''],[lines[name][1],'5 4']])html+=`<polyline points="${pts.map(([x,y])=>`${x},${-y}`).join(' ')}" fill="none" stroke="${name==='lower'?'#aeaeae':'#c9c9c9'}" stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-dasharray="${dash}" pointer-events="none"/>`;
 for(const [name,c,shift]of [['lower',lc,m.lowerShift],['upper',uc,m.upperShift]])if(locks[name])html+=`<line x1="${shift+c.w/2}" x2="${shift+c.w/2}" y1="${view[1]}" y2="${view[1]+view[3]}" stroke="#c5c5c5" stroke-opacity=".45" stroke-dasharray="4 5" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
 // Handles: the curve whose settings are open is drawn at full strength.
 if($('#handles').checked)for(const [name,c,shift,map]of [['lower',lc,m.lowerShift,y=>y],['upper',uc,m.upperShift,y=>upperY(y,u)]])c.handles.forEach(([x,y],i)=>{const hx=x+shift,hy=map(y),label=`${partNames[name]}: ${['left endpoint','bend position and rise','right endpoint','extra bend'][i]}`;
  html+=`<g class="handle" data-curve="${name}" data-handle="${i}" role="slider" tabindex="0" aria-label="${label}" aria-valuenow="${hy.toFixed(1)}" aria-valuetext="x ${hx.toFixed(1)}, y ${hy.toFixed(1)}" opacity="${part===name?1:.55}"><circle cx="${hx}" cy="${-hy}" r="${(matchMedia('(pointer:coarse)').matches?22:13)*unit}" fill="transparent"/><circle cx="${hx}" cy="${-hy}" r="${5.5*unit}" fill="#d2d2d2" stroke="#272727" stroke-width="2" vector-effect="non-scaling-stroke"/><title>${label} · ${i===1?'Hold Shift to centre':'Drag to shape'}</title></g>`;});
 const focused=document.activeElement?.closest?.('[data-handle]'),keep=focused&&[focused.dataset.curve,focused.dataset.handle];svg.innerHTML=html;
 if(keep)svg.querySelector(`[data-curve="${keep[0]}"][data-handle="${keep[1]}"]`)?.focus({preventScroll:true});
 $('#dimensions').textContent=`${gridWidth(lc)} wide · ${m.bounds.maxY-m.bounds.minY} high`;$('#drag-hint').hidden=!$('#handles').checked;
}
// ---- Curve settings (shared Curves tab controls) ----
function mountCurve(name){const p=params(name);$(`#${name}-type`).value=p.type;$(`#${name}-extra`).textContent=p.extraEnabled?'Remove point':'Add point';$(`#${name}-thickness`).value=p.thickness;const lock=$(`#${name}-lock`);lock.setAttribute('aria-pressed',String(locks[name]));lock.textContent=locks[name]?'Unlock centre':'Lock centre';
 mountCurveControls($(`#${name}-controls`),p,(key,value)=>{params(name)[key]=value;fits[name].run();},{prefix:name+'-',centerLocked:locks[name]});}
function mountUpperPlacement(){$('#upper-level').value=state.upper.level;$('#upper-mirrored').checked=state.upper.mirrored;}
// The upper curve is drawn upside down when mirrored, so its handles move with the pointer: vertical drags are inverted.
// Both curves sit centred on the bridge, so dragging an end widens both sides and the dragged end follows the pointer.
function setHandle(name,index,dx,dy,original,originalCurve,center=false){
 const flip=name==='upper'&&state.upper.mirrored?-1:1,sideways=index===0||index===2?2:1;
 setParams(name,editCurveHandle(original,index,dx*sideways,dy*flip,{originalCurve,center:center||locks[name]}));mountCurve(name);fits[name].run();
}
for(const name of ['lower','upper']){
 $(`#${name}-type`).onchange=e=>{setParams(name,changeCurveType(params(name),e.target.value));zoom=1;pan=[0,0];mountCurve(name);fits[name].run();};
 $(`#${name}-extra`).onclick=()=>{setParams(name,toggleExtraPoint(params(name)));mountCurve(name);fits[name].run();};
 $(`#${name}-thickness`).oninput=e=>{if(e.target.value===''||!Number.isFinite(+e.target.value))return;params(name).thickness=clamp(+e.target.value,1,6);fits[name].run();};
 $(`#${name}-thickness`).onchange=e=>{e.target.value=params(name).thickness;};
 $(`#${name}-lock`).onclick=()=>{locks[name]=!locks[name];if(locks[name]){$('#handles').checked=true;const p={...params(name)};setHandle(name,1,0,0,p,curve(p),true);}else{mountCurve(name);render();}scheduleSave();};
}
$('#upper-level').oninput=e=>{if(e.target.value===''||!Number.isFinite(+e.target.value))return;state.upper.level=clamp(Math.round(+e.target.value),-256,256);render();scheduleSave();};
$('#upper-level').onchange=()=>mountUpperPlacement();
$('#upper-mirrored').onchange=e=>{state.upper.mirrored=e.target.checked;render();scheduleSave();};
// One-off copy: the upper curve becomes the lower curve's mirror image again, then stays independent.
$('#upper-mirror').onclick=()=>{state.upper=upperFromLower(state.lower);locks.upper=locks.lower;mountCurve('upper');mountUpperPlacement();fits.upper.run();};
// ---- Beam settings ----
const beamLabels={height:'Height',thickness:'Thickness',tilt:'Tilt °',spacing:'Spacing',position:'Position'};
const beamTitles={height:'Beam height in blocks',thickness:'Beam width in blocks',tilt:'Lean towards the centre, in degrees from vertical',spacing:'Gap between the two beams of a pair, in blocks',position:"Distance of the pair's centre from the end of the lower curve; positive moves it inwards"};
function mountBeams(){
 const b=state.beams,box=$('#beam-controls'),specs=Object.entries(bridgeBeamLimits);$('#beams-linked').checked=b.linked;
 const attrs=(lo,hi,step)=>`min="${lo}" max="${hi}" step="${step}"`;
 box.innerHTML=b.linked?specs.map(([k,[lo,hi,step]])=>`<div class="control" title="${beamTitles[k]}"><div class="control-head"><label for="beam-${k}-range">${beamLabels[k]}</label><input id="beam-${k}-number" data-key="${k}" data-side="both" type="number" ${attrs(lo,hi,step)} value="${b.left[k]}" aria-label="${beamLabels[k]}"></div><input id="beam-${k}-range" data-key="${k}" data-side="both" type="range" ${attrs(lo,hi,step)} value="${b.left[k]}" aria-label="${beamLabels[k]}"></div>`).join('')
  :`<div class="pair head"><span></span><span>Left</span><span>Right</span></div>`+specs.map(([k,[lo,hi,step]])=>`<div class="pair" title="${beamTitles[k]}"><label for="beam-${k}-left">${beamLabels[k]}</label>${['left','right'].map(side=>`<input id="beam-${k}-${side}" data-key="${k}" data-side="${side}" type="number" ${attrs(lo,hi,step)} value="${b[side][k]}" aria-label="${beamLabels[k]} ${side}">`).join('')}</div>`).join('');
 for(const input of box.querySelectorAll('input')){
  const {key,side}=input.dataset,[lo,hi]=bridgeBeamLimits[key];
  input.oninput=()=>{if(input.value===''||!Number.isFinite(+input.value))return;const v=clamp(Math.round(+input.value),lo,hi);for(const s of side==='both'?['left','right']:[side])b[s][key]=v;if(side==='both')for(const other of box.querySelectorAll(`[data-key="${key}"]`))if(other!==input)other.value=v;sceneCache=null;render();scheduleSave();};
  input.onchange=()=>{input.value=b[side==='both'?'left':side][key];};
 }
}
$('#beams-linked').onchange=e=>{state.beams.linked=e.target.checked;if(e.target.checked)state.beams.right={...state.beams.left};mountBeams();render();scheduleSave();};
// ---- Panel ----
function showPart(name){part=name;for(const n of ['lower','beams','upper']){$(`#${n}-panel`).hidden=n!==name;$(`#part-${n}`).setAttribute('aria-pressed',String(n===name));}render();}
for(const n of ['lower','beams','upper'])$(`#part-${n}`).onclick=()=>{showPart(n);scheduleSave();};
$('#open-controls').onclick=()=>document.body.classList.add('editing');
for(const id of ['#close-controls','#sheet-shade'])$(id).onclick=()=>document.body.classList.remove('editing');
document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.body.classList.remove('editing');const menu=$('.display-settings');if(menu.open){menu.open=false;menu.querySelector('summary').focus();}}});
document.addEventListener('pointerdown',e=>{const menu=$('.display-settings');if(menu.open&&!menu.contains(e.target))menu.open=false;});
// ---- 2D interaction (as in the Curves tab) ----
const svg=$('#preview'),world=e=>new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());
svg.onpointerdown=e=>{if(e.button!==0)return;const h=e.target.closest('[data-handle]'),name=h?.dataset.curve??null;
 drag={x:e.clientX,y:e.clientY,point:world(e),pan:[...pan],target:e.target,curve:name,handle:h?+h.dataset.handle:null,original:name?{...params(name)}:null,c:name?curve(params(name)):null,dx:0,dy:0,moved:false};
 const vb=svg.viewBox.baseVal;frozenView=[vb.x,vb.y,vb.width,vb.height];svg.setPointerCapture(e.pointerId);if(name&&part!==name)showPart(name);
 if(drag.handle===1&&e.shiftKey)setHandle(name,1,0,0,drag.original,drag.c,true);e.preventDefault();};
svg.onpointermove=e=>{if(!drag)return;drag.moved||=Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>3;
 if(drag.handle!==null){const pt=world(e);drag.dx=pt.x-drag.point.x;drag.dy=drag.point.y-pt.y;setHandle(drag.curve,drag.handle,drag.dx,drag.dy,drag.original,drag.c,e.shiftKey);}
 else{const scale=frozenView[2]/svg.clientWidth,dx=(e.clientX-drag.x)*scale,dy=(e.clientY-drag.y)*scale;pan=[drag.pan[0]+dx,drag.pan[1]+dy];const vb=svg.viewBox.baseVal;svg.setAttribute('viewBox',`${frozenView[0]-dx} ${frozenView[1]-dy} ${vb.width} ${vb.height}`);}};
svg.onpointerup=e=>{if(!drag)return;if(!drag.moved&&drag.handle===null&&drag.target.dataset.index!==undefined){selected=+drag.target.dataset.index;const el=currentModel().elements[selected];if(el){$('#selected').textContent=describe(el);if(el.part!=='beam'&&part!==el.part)showPart(el.part);else if(el.part==='beam'&&part!=='beams')showPart('beams');}}
 const moved=drag.handle!==null;frozenView=null;drag=null;render();if(moved)scheduleSave();if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);};
svg.onpointercancel=()=>{drag=null;frozenView=null;render();};
for(const event of ['keydown','keyup'])document.addEventListener(event,e=>{if(e.key==='Shift'&&drag?.handle===1){e.preventDefault();setHandle(drag.curve,1,drag.dx,drag.dy,drag.original,drag.c,e.shiftKey);}});
svg.onkeydown=e=>{const h=e.target.closest('[data-handle]');if(!h||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const name=h.dataset.curve,i=+h.dataset.handle,d=e.shiftKey?1:.5,p={...params(name)};if(part!==name)showPart(name);setHandle(name,i,e.key==='ArrowLeft'?-d:e.key==='ArrowRight'?d:0,e.key==='ArrowUp'?d:e.key==='ArrowDown'?-d:0,p,curve(p));scheduleSave();};
svg.addEventListener('wheel',e=>{e.preventDefault();zoom=clamp(zoom*Math.exp(-e.deltaY*.001),.5,12);render();},{passive:false});
// ---- View, display and actions ----
function setView(value){mode3d=value;document.body.classList.toggle('mode3d',value);$('#preview').toggleAttribute('hidden',value);$('#preview3d').hidden=!value;$('#depth-control').hidden=!value;$('#camera-controls').hidden=!value;$('#view-2d').setAttribute('aria-pressed',String(!value));$('#view-3d').setAttribute('aria-pressed',String(value));$('#handles').disabled=value;$('#reference').disabled=value;$('#selected').textContent=value?'3D bridge · counts include depth':'2D elevation · counts for one layer';render();}
$('#view-2d').onclick=()=>{setView(false);scheduleSave();};$('#view-3d').onclick=()=>{setView(true);scheduleSave();};
$('#depth').oninput=e=>{if(e.target.value===''||!Number.isFinite(+e.target.value))return;depth=clamp(Math.round(+e.target.value),1,32);render();scheduleSave();};$('#depth').onchange=()=>$('#depth').value=depth;
for(const preset of ['outside','inside','top'])$('#'+preset).onclick=()=>three.preset(preset);
for(const id of ['reference','grid','handles'])$('#'+id).onchange=()=>{render();scheduleSave();};
$('#baseline').onchange=()=>{fits.lower.run();fits.upper.run();};
function setMono(on){mono=on;$('#mono').setAttribute('aria-pressed',String(mono));document.body.classList.toggle('mono',mono);}
$('#mono').onclick=()=>{setMono(!mono);render();scheduleSave();};
$('#plus').onclick=()=>{if(mode3d){three.zoom(1.3);return;}zoom=clamp(zoom*1.3,.5,12);render();};$('#minus').onclick=()=>{if(mode3d){three.zoom(1/1.3);return;}zoom=clamp(zoom/1.3,.5,12);render();};$('#fit').onclick=()=>{if(mode3d){three.fit();return;}zoom=1;pan=[0,0];render();};
$('#export').onclick=()=>{if(busy())return;const m=currentModel(),placed=mode3d?scene(m):placeRoof({blocks:m.elements},1),rows=['x,y,z,element,placement,full_half_direction,part'];
 for(const e of placed.blocks)rows.push(`${e.x},${e.y},${e.z},${['left','right'].includes(e.type)?'stair':e.type},${e.type==='block'?'full':e.type==='slab'?(e.flip?'top':'bottom'):(e.flip?'inverted':'upright')},${placementDirection(e)},${e.part==='beam'?e.beam+'-beam':e.part}`);
 const url=URL.createObjectURL(new Blob([rows.join('\n')],{type:'text/csv'})),a=document.createElement('a');a.href=url;a.download='minecraft-bridge-1.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
function mountAll(){mountCurve('lower');mountCurve('upper');mountUpperPlacement();mountBeams();}
$('#reset').onclick=()=>{state=bridgeDefaults();locks={lower:false,upper:false};zoom=1;pan=[0,0];frozenView=null;selected=-1;$('#baseline').checked=false;$('#selected').textContent='1 square = 1 block';mountAll();showPart('lower');fits.lower.run();fits.upper.run();};
new ResizeObserver(render).observe($('#viewport'));
// ---- State: autosave, blueprints ----
function scheduleSave(){if(!ready)return;clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(storageKey,JSON.stringify(globalThis.bridge1State.capture()));}catch{}},400);}
globalThis.bridge1State={
 capture:()=>({lower:{...state.lower},upper:{params:{...state.upper.params},level:state.upper.level,mirrored:state.upper.mirrored},beams:{linked:state.beams.linked,left:{...state.beams.left},right:{...state.beams.right}},locks:{...locks},onlyBlocks:$('#baseline').checked,display:Object.fromEntries(['reference','grid','handles'].map(id=>[id,$('#'+id).checked])),mono,mode3d,depth,part,zoom,pan:[...pan],camera:three.getState()}),
 restore(input){const s=validateBridge1State(input);state={lower:{...s.lower},upper:{params:{...s.upper.params},level:s.upper.level,mirrored:s.upper.mirrored},beams:{linked:s.beams.linked,left:{...s.beams.left},right:{...s.beams.right}}};locks={...s.locks};depth=s.depth;zoom=s.zoom;pan=[...s.pan];drag=null;frozenView=null;selected=-1;sceneCache=null;
  $('#baseline').checked=s.onlyBlocks;for(const [id,v]of Object.entries(s.display))$('#'+id).checked=v;$('#depth').value=depth;setMono(s.mono);mountAll();showPart(s.part);setView(s.mode3d);three.setState(s.camera);fits.lower.run();fits.upper.run();}
};
mountAll();showPart('lower');fits.lower.run();fits.upper.run();
try{const saved=JSON.parse(localStorage.getItem(storageKey)??'null');if(saved)globalThis.bridge1State.restore(saved);}catch{}
ready=true;
