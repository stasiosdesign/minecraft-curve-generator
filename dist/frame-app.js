import {validateHouseState} from './blueprint.js';
import {mountCurveControls,editCurveHandle,changeCurveType,toggleExtraPoint} from './curve-editor.js';
import {createFrame} from './frame.js';
import {createRoof3D} from './view3d.js';
import {curve} from './curves.js';
import {frameCurve,frameCurveDefaults,frameReference} from './frame-curve.js';
import {polygon} from './geometry.js';
import {placementDirection} from './layout.js';
const el=id=>document.getElementById(id),limit=(v,a,b)=>Math.max(a,Math.min(b,v));
let frameModel,group=null,profileParams={...frameCurveDefaults},profileRoof=null,profileDrag=null,profileLocked=false,profileView=null,curveWorker=null,curveTimer,curveRequest=0,curveBusy=false;
const frameColors={deck:'#606060',outer:'#898989',inner:'#aaaaaa',center:'#c5c5c5',curves:'#dedede'};
function selectFrameGroup(next,edit=false){
 group=next;el('selection').textContent=group?({inner:'12 middle pillars',outer:'16 outer pillars',center:'4 centre pillars',curves:'Four independent curves',deck:'Outer deck'})[group]+' selected':'Tap a group to highlight';
 for(const g of ['inner','outer','center'])el(g+'-label').classList.toggle('active',g===group);
 for(const b of document.querySelectorAll('[data-group]'))b.setAttribute('aria-pressed',String(b.dataset.group===group));
 if(edit){showEditor(group==='curves'?'curves':'structure');if(['inner','outer','center'].includes(group))el(group+'-height').focus({preventScroll:true});}updateFrame(false);
}
const frameView=createRoof3D(el('frame-canvas'),block=>selectFrameGroup(block.group,true));
for(const b of document.querySelectorAll('[data-group]')){b.style.setProperty('--group-color',frameColors[b.dataset.group]);b.onclick=()=>selectFrameGroup(group===b.dataset.group?null:b.dataset.group);}
el('clear-selection').onclick=()=>selectFrameGroup(null);
function showEditor(section){el('structure-controls').hidden=section!=='structure';el('curve-controls').hidden=section!=='curves';for(const name of ['structure','curves'])el(name+'-tab').setAttribute('aria-pressed',String(name===section));document.body.classList.add('editing');requestAnimationFrame(drawProfile);}
for(const name of ['structure','curves'])el(name+'-tab').onclick=()=>showEditor(name);
for(const id of ['close-controls','sheet-shade'])el(id).onclick=()=>document.body.classList.remove('editing');
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.body.classList.remove('editing');});
function updateFrame(rebuild=true){
 if(rebuild)frameModel=createFrame({innerHeight:el('inner-height').value,outerHeight:el('outer-height').value,centerHeight:el('center-height').value,elevation:20,curveWidth:el('curve-width').value,roof:el('curves-enabled').checked?profileRoof:null});
 frameView.update(frameModel,21,{grid:el('house-grid').checked,selectedGroup:group,groupColors:frameColors,pending:curveBusy});
 el('frame-count').textContent=frameModel.blocks.length+' pieces · base Y '+frameModel.elevation;
 el('frame-status').textContent=curveBusy?'Updating four curves…':'';
}
function reference(){return frameReference(profileParams);}
function drawProfile(){
 const svg=el('profile'),rect=svg.getBoundingClientRect();if(!rect.width)return;const c=reference(),min=Math.min(c.min,profileRoof?.minY??0)-2,max=Math.max(c.h,profileRoof?.maxY??0)+2;
 const view=profileView??[-2,-max,c.w+4,max-min];svg.setAttribute('viewBox',view.join(' '));const unit=Math.max(view[2]/rect.width,view[3]/rect.height);
 let html='<defs><pattern id="profile-grid" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M1 0H0V1" fill="none" stroke="#3e3e3e" stroke-width=".03"/></pattern></defs><rect x="-100" y="-100" width="200" height="200" fill="url(#profile-grid)"/>';
 if(!el('house-grid').checked)html='';
 html+=`<g transform="scale(1 -1)" opacity="${curveBusy?.35:1}">`;
 for(const b of profileRoof?.blocks??[])html+=`<polygon points="${polygon(b).map(p=>p.join(',')).join(' ')}" fill="#b4b4b4" stroke="#343434" stroke-width=".035"/>`;
 html+='</g>';
 if(el('house-reference').checked)for(const [pts,color]of [[c.points,'#aeaeae'],[c.inner,'#b3b3b3']])html+=`<polyline points="${pts.map(([x,y])=>[x,-y].join(',')).join(' ')}" stroke="${color}" fill="none" stroke-width="1.4" vector-effect="non-scaling-stroke"/>`;
 if(profileLocked)html+=`<path d="M${c.w/2} ${view[1]}v${view[3]}" stroke="#c5c5c5" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/>`;
 c.handles.forEach(([x,y],i)=>{html+=i===0?`<rect x="${x-unit*4}" y="${-y-unit*4}" width="${unit*8}" height="${unit*8}" fill="#cbcbcb"><title>Start fixed to centre platform</title></rect>`:`<g data-handle="${i}" class="handle" tabindex="0" role="slider" aria-label="${i===1?'Bend':i===2?'End':'Extra bend'} position" aria-valuetext="${x.toFixed(1)} blocks out, ${(y-profileParams.thickness).toFixed(1)} rise"><circle cx="${x}" cy="${-y}" r="${unit*20}" fill="transparent"/><circle cx="${x}" cy="${-y}" r="${unit*5}" fill="#d2d2d2"/></g>`;});
 const focused=document.activeElement?.dataset.handle;svg.innerHTML=html;if(focused)svg.querySelector(`[data-handle="${focused}"]`)?.focus({preventScroll:true});
}
function syncProfileFields(){el('house-extra-point').textContent=profileParams.extraEnabled?'Remove point':'Add point';el('house-type').value=profileParams.type;el('thickness').value=profileParams.thickness;mountCurveControls(el('house-curve-fields'),profileParams,(key,value)=>{profileParams[key]=value;scheduleCurve();},{prefix:'house-',centerLocked:profileLocked});}
function scheduleCurve(){
 clearTimeout(curveTimer);curveWorker?.terminate();curveWorker=null;const id=++curveRequest;curveBusy=true;el('export-frame').disabled=true;drawProfile();updateFrame(false);
 curveTimer=setTimeout(()=>{
  const finish=roof=>{if(id!==curveRequest)return;curveWorker?.terminate();curveWorker=null;profileRoof=roof;curveBusy=false;el('export-frame').disabled=false;updateFrame();drawProfile();};
  const fail=error=>{if(id!==curveRequest)return;curveBusy=false;curveWorker?.terminate();curveWorker=null;updateFrame(false);el('frame-status').textContent=error;};
  const fallback=()=>{try{finish(frameCurve(profileParams).roof);}catch(e){fail(e.message);}};
  if(!globalThis.FRAME_WORKER_SOURCE){fallback();return;}
  let url;try{url=URL.createObjectURL(new Blob([globalThis.FRAME_WORKER_SOURCE],{type:'text/javascript'}));curveWorker=new Worker(url);curveWorker.onmessage=({data})=>data.error?fail(data.error):finish(data.roof);curveWorker.onerror=e=>{e.preventDefault();fallback();};curveWorker.postMessage({...profileParams});}catch{fallback();}finally{if(url)URL.revokeObjectURL(url);}
 },profileDrag?100:40);
}
for(const id of ['inner-height','outer-height','center-height','curve-width']){
 el(id).oninput=()=>{if(el(id).value!==''&&el(id).validity.valid)updateFrame();};
 el(id).onchange=()=>{const input=el(id);input.value=limit(Math.round(+input.value),+input.min,+input.max);updateFrame();};
}
el('house-type').onchange=()=>{profileParams=changeCurveType(profileParams,el('house-type').value,{lockStart:true});syncProfileFields();scheduleCurve();};
el('thickness').oninput=()=>{if(el('thickness').value!==''&&el('thickness').validity.valid){profileParams.thickness=+el('thickness').value;scheduleCurve();}};
el('house-baseline').onchange=()=>{profileParams.onlyBlocks=el('house-baseline').checked;scheduleCurve();};
for(const id of ['house-grid','house-reference'])el(id).onchange=()=>{drawProfile();updateFrame(false);};
el('curves-enabled').onchange=()=>updateFrame();
el('profile-lock').onclick=()=>{profileLocked=!profileLocked;el('profile-lock').setAttribute('aria-pressed',String(profileLocked));el('profile-lock').textContent=profileLocked?'Unlock bend':'Lock bend to centre';if(profileLocked)profileParams.bend=50;syncProfileFields();scheduleCurve();};
const profileSvg=el('profile'),point=e=>new DOMPoint(e.clientX,e.clientY).matrixTransform(profileSvg.getScreenCTM().inverse());
function moveProfile(handle,dx,dy,original,center=false){profileParams=editCurveHandle(original,handle,dx,dy,{center:center||profileLocked,lockStart:true});syncProfileFields();scheduleCurve();}
profileSvg.onpointerdown=e=>{const h=e.target.closest('[data-handle]');if(!h||e.button!==0)return;profileDrag={handle:+h.dataset.handle,point:point(e),original:{...profileParams},dx:0,dy:0};const v=profileSvg.viewBox.baseVal;profileView=[v.x,v.y,v.width,v.height];profileSvg.setPointerCapture(e.pointerId);e.preventDefault();};
profileSvg.onpointermove=e=>{if(!profileDrag)return;const q=point(e);profileDrag.dx=q.x-profileDrag.point.x;profileDrag.dy=profileDrag.point.y-q.y;moveProfile(profileDrag.handle,profileDrag.dx,profileDrag.dy,profileDrag.original,e.shiftKey);};
profileSvg.onpointerup=profileSvg.onpointercancel=e=>{profileDrag=null;profileView=null;if(profileSvg.hasPointerCapture(e.pointerId))profileSvg.releasePointerCapture(e.pointerId);drawProfile();};
for(const event of ['keydown','keyup'])document.addEventListener(event,e=>{if(e.key==='Shift'&&profileDrag)moveProfile(profileDrag.handle,profileDrag.dx,profileDrag.dy,profileDrag.original,e.shiftKey);});
profileSvg.onkeydown=e=>{const h=e.target.closest('[data-handle]');if(!h||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();moveProfile(+h.dataset.handle,e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0,e.key==='ArrowUp'?.5:e.key==='ArrowDown'?-.5:0,{...profileParams},e.shiftKey);};
el('reset-frame').onclick=()=>{for(const [id,val]of Object.entries({'inner-height':9,'outer-height':5,'center-height':11,'curve-width':5}))el(id).value=val;profileParams={...frameCurveDefaults};el('house-baseline').checked=false;profileLocked=false;el('profile-lock').setAttribute('aria-pressed','false');el('profile-lock').textContent='Lock bend to centre';el('curves-enabled').checked=true;selectFrameGroup(null);for(const g of ['inner','outer','center'])el(g+'-label').classList.remove('active');el('selection').textContent='Tap a pillar or curve to edit';syncProfileFields();scheduleCurve();frameView.preset('outside');};
el('orbit').onclick=()=>frameView.preset('outside');el('top-frame').onclick=()=>frameView.preset('top');
el('minus-frame').onclick=()=>frameView.zoom(1/1.3);el('plus-frame').onclick=()=>frameView.zoom(1.3);el('fit-frame').onclick=()=>frameView.fit();
el('export-frame').onclick=()=>{if(curveBusy)return;const rows=['x,y,z,element,placement,full_half_direction,group,wing',...frameModel.blocks.map(b=>`${b.x},${b.y},${b.z},${['left','right'].includes(b.type)?'stair':b.type},${b.type==='block'?'full':b.type==='slab'?(b.flip?'upper':'lower'):(b.flip?'inverted':'upright')},${placementDirection(b)},${b.group},${b.wing??''}`)],url=URL.createObjectURL(new Blob([rows.join('\n')],{type:'text/csv'})),a=document.createElement('a');a.href=url;a.download='minecraft-house-roof.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
new ResizeObserver(()=>{if(frameModel)updateFrame(false);drawProfile();}).observe(el('viewport'));syncProfileFields();updateFrame();scheduleCurve();

globalThis.houseRoofState={capture(){return {params:{...profileParams},pillars:{outer:+el('outer-height').value,inner:+el('inner-height').value,center:+el('center-height').value},curveWidth:+el('curve-width').value,enabled:el('curves-enabled').checked,locked:profileLocked,grid:el('house-grid').checked,reference:el('house-reference').checked,group,editor:el('curve-controls').hidden?'structure':'curves',camera:frameView.getState()};},restore(input){const s=validateHouseState(input);profileParams={...s.params};for(const [key,value]of Object.entries(s.pillars))el(key+'-height').value=value;el('curve-width').value=s.curveWidth;el('curves-enabled').checked=s.enabled;el('house-grid').checked=s.grid;el('house-reference').checked=s.reference;el('house-baseline').checked=!!s.params.onlyBlocks;profileLocked=s.locked;el('profile-lock').setAttribute('aria-pressed',String(s.locked));el('profile-lock').textContent=s.locked?'Unlock bend':'Lock bend to centre';profileDrag=null;profileView=null;syncProfileFields();showEditor(s.editor);document.body.classList.remove('editing');selectFrameGroup(s.group);frameView.setState(s.camera);scheduleCurve();}};

el('house-extra-point').onclick=()=>{profileParams=toggleExtraPoint(profileParams,{lockStart:true});syncProfileFields();scheduleCurve();};
