import {createFrame} from './frame.js';
import {createRoof3D} from './view3d.js';
import {curve} from './curves.js';
import {frameCurve,frameCurveDefaults} from './frame-curve.js';
import {polygon} from './geometry.js';
import {placementDirection} from './layout.js';
const el=id=>document.getElementById(id),limit=(v,a,b)=>Math.max(a,Math.min(b,v));
let frameModel,group=null,profileParams={...frameCurveDefaults},profileRoof=null,profileDrag=null,profileLocked=false,profileView=null,curveWorker=null,curveTimer,curveRequest=0,curveBusy=false;
const frameColors={deck:'#788990',outer:'#72b7d5',inner:'#b197d5',center:'#a0cf98',curves:'#e2ad76'};
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
 if(rebuild)frameModel=createFrame({innerHeight:el('inner-height').value,outerHeight:el('outer-height').value,centerHeight:el('center-height').value,elevation:el('elevation').value,curveWidth:el('curve-width').value,roof:el('curves-enabled').checked?profileRoof:null});
 frameView.update(frameModel,21,{grid:true,selectedGroup:group,groupColors:frameColors,pending:curveBusy});
 el('frame-count').textContent=frameModel.blocks.length+' pieces · base Y '+frameModel.elevation;
 el('frame-status').textContent=curveBusy?'Updating four curves…':el('curves-enabled').checked&&profileRoof?.gaps?`${profileRoof.gaps} ${profileRoof.gaps===1?'gap':'gaps'} per wing at this thickness · adjust profile or thickness`:'';
}
function reference(){return curve({type:'custom',width:profileParams.run,left:profileParams.thickness,middle:profileParams.thickness+profileParams.middle,right:profileParams.thickness+profileParams.end,bend:profileParams.bend,thickness:profileParams.thickness});}
function drawProfile(){
 const svg=el('profile'),rect=svg.getBoundingClientRect();if(!rect.width)return;const c=reference(),min=Math.min(c.min,profileRoof?.minY??0)-2,max=Math.max(c.h,profileRoof?.maxY??0)+2;
 const view=profileView??[-2,-max,c.w+4,max-min];svg.setAttribute('viewBox',view.join(' '));const unit=Math.max(view[2]/rect.width,view[3]/rect.height);
 let html='<defs><pattern id="profile-grid" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M1 0H0V1" fill="none" stroke="#304337" stroke-width=".03"/></pattern></defs><rect x="-100" y="-100" width="200" height="200" fill="url(#profile-grid)"/>';
 html+=`<g transform="scale(1 -1)" opacity="${curveBusy?.35:1}">`;
 for(const b of profileRoof?.blocks??[])html+=`<polygon points="${polygon(b).map(p=>p.join(',')).join(' ')}" fill="#e2ad76" stroke="#26392c" stroke-width=".035"/>`;
 html+='</g>';
 for(const [pts,color]of [[c.points,'#e5a27c'],[c.inner,'#8bbbd7']])html+=`<polyline points="${pts.map(([x,y])=>[x,-y].join(',')).join(' ')}" stroke="${color}" fill="none" stroke-width="1.4" vector-effect="non-scaling-stroke"/>`;
 if(profileLocked)html+=`<path d="M${c.w/2} ${view[1]}v${view[3]}" stroke="#a8d0aa" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/>`;
 c.handles.forEach(([x,y],i)=>{html+=i===0?`<rect x="${x-unit*4}" y="${-y-unit*4}" width="${unit*8}" height="${unit*8}" fill="#e8c98c"><title>Start fixed to centre platform</title></rect>`:`<g data-handle="${i}" class="handle" tabindex="0" role="slider" aria-label="${i===1?'Bend':'End'} position" aria-valuetext="${x.toFixed(1)} blocks out, ${(y-profileParams.thickness).toFixed(1)} rise"><circle cx="${x}" cy="${-y}" r="${unit*20}" fill="transparent"/><circle cx="${x}" cy="${-y}" r="${unit*5}" fill="#c1dbac"/></g>`;});
 const focused=document.activeElement?.dataset.handle;svg.innerHTML=html;if(focused)svg.querySelector(`[data-handle="${focused}"]`)?.focus({preventScroll:true});
}
function syncProfileFields(){for(const key of Object.keys(frameCurveDefaults))el(key).value=Number(profileParams[key].toFixed(2));el('bend').disabled=profileLocked;}
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
for(const id of ['inner-height','outer-height','center-height','elevation','curve-width']){
 el(id).oninput=()=>{if(el(id).value!==''&&el(id).validity.valid)updateFrame();};
 el(id).onchange=()=>{const input=el(id);input.value=limit(Math.round(+input.value),+input.min,+input.max);updateFrame();};
}
for(const key of Object.keys(frameCurveDefaults)){
 el(key).oninput=()=>{if(el(key).value!==''&&el(key).validity.valid){profileParams[key]=+el(key).value;scheduleCurve();}};
 el(key).onchange=()=>{const input=el(key),step=+input.step;profileParams[key]=limit(Math.round(+input.value/step)*step,+input.min,+input.max);syncProfileFields();scheduleCurve();};
}
el('curves-enabled').onchange=()=>updateFrame();
el('profile-lock').onclick=()=>{profileLocked=!profileLocked;el('profile-lock').setAttribute('aria-pressed',String(profileLocked));el('profile-lock').textContent=profileLocked?'Unlock bend':'Lock bend to centre';if(profileLocked)profileParams.bend=50;syncProfileFields();scheduleCurve();};
const profileSvg=el('profile'),point=e=>new DOMPoint(e.clientX,e.clientY).matrixTransform(profileSvg.getScreenCTM().inverse());
function moveProfile(handle,dx,dy,original,center=false){profileParams={...original};if(handle===1){profileParams.bend=center||profileLocked?50:limit(original.bend+dx/original.run*100,10,90);profileParams.middle=limit(original.middle+dy,-32,32);}else{profileParams.run=limit(Math.round(original.run+dx),3,32);profileParams.end=limit(original.end+dy,-32,32);}syncProfileFields();scheduleCurve();}
profileSvg.onpointerdown=e=>{const h=e.target.closest('[data-handle]');if(!h||e.button!==0)return;profileDrag={handle:+h.dataset.handle,point:point(e),original:{...profileParams},dx:0,dy:0};const v=profileSvg.viewBox.baseVal;profileView=[v.x,v.y,v.width,v.height];profileSvg.setPointerCapture(e.pointerId);e.preventDefault();};
profileSvg.onpointermove=e=>{if(!profileDrag)return;const q=point(e);profileDrag.dx=q.x-profileDrag.point.x;profileDrag.dy=profileDrag.point.y-q.y;moveProfile(profileDrag.handle,profileDrag.dx,profileDrag.dy,profileDrag.original,e.shiftKey);};
profileSvg.onpointerup=profileSvg.onpointercancel=e=>{profileDrag=null;profileView=null;if(profileSvg.hasPointerCapture(e.pointerId))profileSvg.releasePointerCapture(e.pointerId);drawProfile();};
for(const event of ['keydown','keyup'])document.addEventListener(event,e=>{if(e.key==='Shift'&&profileDrag)moveProfile(profileDrag.handle,profileDrag.dx,profileDrag.dy,profileDrag.original,e.shiftKey);});
profileSvg.onkeydown=e=>{const h=e.target.closest('[data-handle]');if(!h||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();moveProfile(+h.dataset.handle,e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0,e.key==='ArrowUp'?.5:e.key==='ArrowDown'?-.5:0,{...profileParams},e.shiftKey);};
el('reset-frame').onclick=()=>{for(const [id,val]of Object.entries({'inner-height':9,'outer-height':5,'center-height':11,elevation:20,'curve-width':5}))el(id).value=val;profileParams={...frameCurveDefaults};profileLocked=false;el('profile-lock').setAttribute('aria-pressed','false');el('profile-lock').textContent='Lock bend to centre';el('curves-enabled').checked=true;selectFrameGroup(null);for(const g of ['inner','outer','center'])el(g+'-label').classList.remove('active');el('selection').textContent='Tap a pillar or curve to edit';syncProfileFields();scheduleCurve();frameView.preset('outside');};
el('orbit').onclick=()=>frameView.preset('outside');el('top-frame').onclick=()=>frameView.preset('top');
el('minus-frame').onclick=()=>frameView.zoom(1/1.3);el('plus-frame').onclick=()=>frameView.zoom(1.3);el('fit-frame').onclick=()=>frameView.fit();
el('export-frame').onclick=()=>{if(curveBusy)return;const rows=['x,y,z,element,placement,full_half_direction,group,wing',...frameModel.blocks.map(b=>`${b.x},${b.y},${b.z},${['left','right'].includes(b.type)?'stair':b.type},${b.type==='block'?'full':b.type==='slab'?(b.flip?'upper':'lower'):(b.flip?'inverted':'upright')},${placementDirection(b)},${b.group},${b.wing??''}`)],url=URL.createObjectURL(new Blob([rows.join('\n')],{type:'text/csv'})),a=document.createElement('a');a.href=url;a.download='minecraft-frame.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
new ResizeObserver(()=>{if(frameModel)updateFrame(false);drawProfile();}).observe(el('viewport'));syncProfileFields();updateFrame();scheduleCurve();
