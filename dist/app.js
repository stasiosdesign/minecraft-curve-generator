import {polygon} from './geometry.js';
import {curve} from './curves.js';
import {solve,measurePlacedRoof} from './optimizer.js';
import {createRoof3D} from './view3d.js';
import {placeRoof,placementDirection} from './layout.js';
const $=s=>document.querySelector(s),defaults={type:'circle',radius:20,extent:120,width:32,height:12,left:4,middle:16,bend:50,right:4,thickness:2};
let p={...defaults},result,worker,timer,watchdog,request=0,zoom=1,pan=[0,0],drag,selected=-1,mono=false,pending=false,frozenView=null;
const specs={circle:[['radius','Radius',2,128,.5],['extent','Arc',10,180,1]],ellipse:[['width','Width',4,128,.5],['height','Rise',1,64,.5]],custom:[['width','Width',4,128,.5],['middle','Rise',-32,96,.5],['bend','Bend position %',10,90,1]]};
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
let mode3d=false,roofDepth=12,layout='straight',sceneCache=null;
function scene(){if(!result||result.layout!==layout)return null;const key=layout+':'+roofDepth;if(sceneCache?.roof===result.roof&&sceneCache.key===key)return sceneCache.model;const model=placeRoof(result.roof,roofDepth,layout,result.c.w);model.errors=measurePlacedRoof(model.blocks,result.c,layout);sceneCache={roof:result.roof,key,model};return model;}
const three=createRoof3D($('#preview3d'),(e,z)=>{$('#selected').textContent=describe(e)+` · z ${z}`;});
function controls(){
 $('#type').value=p.type;$('#controls').innerHTML=specs[p.type].map(([key,label,min,max,step])=>`<div class="control"><div class="control-head"><label for="${key}-range">${label}</label><input id="${key}-number" aria-label="${label}" type="number" min="${min}" max="${max}" step="${step}" value="${Number(p[key].toFixed(2))}"></div><input id="${key}-range" aria-label="${label}" type="range" min="${min}" max="${max}" step="${step}" value="${p[key]}"></div>`).join('');
 for(const [key,,min,max] of specs[p.type])for(const suffix of ['range','number'])$(`#${key}-${suffix}`).oninput=e=>{if(e.target.value===''||!Number.isFinite(+e.target.value))return;p[key]=clamp(+e.target.value,min,max);$(`#${key}-${suffix==='range'?'number':'range'}`).value=p[key];calculate();};
}
function calculate(){
 clearTimeout(timer);clearTimeout(watchdog);worker?.terminate();worker=null;const id=++request,input={...p,layout,onlyBlocks:$('#baseline').checked};pending=true;
 $('#busy').textContent='Finding the best fit…';$('#busy').hidden=false;$('#export').disabled=true;render();
 function fail(message){if(id!==request)return;clearTimeout(watchdog);pending=false;$('#busy').textContent=message;worker?.terminate();worker=null;}
 function finish(data){if(id!==request)return;clearTimeout(watchdog);worker?.terminate();worker=null;result={...data,layout:input.layout};pending=false;$('#busy').hidden=true;$('#export').disabled=false;selected=-1;render();}
 let fallingBack=false;function fallback(){if(id!==request||fallingBack)return;fallingBack=true;clearTimeout(watchdog);worker?.terminate();worker=null;setTimeout(()=>{if(id!==request)return;try{const c=curve(input);finish({c,roof:solve(c,{onlyBlocks:input.onlyBlocks,diagonal:input.layout==='diagonal'})});}catch(e){fail(e.message);}},0);}
 timer=setTimeout(()=>{let url;try{if(globalThis.CURVE_WORKER_SOURCE){url=URL.createObjectURL(new Blob([globalThis.CURVE_WORKER_SOURCE],{type:'text/javascript'}));worker=new Worker(url);}else worker=new Worker('./worker.js',{type:'module'});worker.onmessage=({data})=>data.error?fail(data.error):finish(data);worker.onerror=e=>{e.preventDefault();fallback();};worker.onmessageerror=fallback;watchdog=setTimeout(fallback,8000);worker.postMessage(input);}catch{fallback();}finally{if(url)URL.revokeObjectURL(url);}},drag?130:60);
}
function describe(e){return `(${e.x}, ${e.y}) · ${e.type==='block'?'Full block':e.type==='slab'?`${e.flip?'Upper':'Lower'} slab`:`${e.flip?'Inverted':'Upright'} stair · full half ${placementDirection(e)}`}`;}
function render(){
 const svg=$('#preview'),c=curve(p),r=result?.roof,box=$('#viewport').getBoundingClientRect();if(box.height<=0||box.width<=0)return;
 if(mode3d){const model=scene();three.update(model,roofDepth,{mono,grid:$('#grid').checked,pending});$('#dimensions').textContent=model?`${model.maxX-model.minX} × ${model.maxZ-model.minZ} footprint`:'';$('#drag-hint').hidden=false;$('#drag-hint').textContent='Drag to orbit · Shift-drag to pan · Scroll to zoom';if(model){$('#outer-error').textContent=model.errors.outerRms.toFixed(3);$('#inner-error').textContent=model.errors.innerRms.toFixed(3);for(const [id,pred]of [['blocks',e=>e.type==='block'],['slabs',e=>e.type==='slab'],['stairs',e=>['left','right'].includes(e.type)]])$('#'+id).textContent=model.blocks.filter(pred).length;}return;}
 $('#drag-hint').textContent='Drag handles to shape · Drag grid to pan';
 const minY=Math.min(c.min,r?.minY??c.min),maxY=Math.max(c.h,r?.maxY??c.h),w=c.w,aspect=box.width/box.height,baseW=Math.max(w+6,(maxY-minY+6)*aspect),baseH=baseW/aspect;
 const view=frozenView??[w/2-baseW/(2*zoom)-pan[0],-(maxY+minY)/2-baseH/(2*zoom)-pan[1],baseW/zoom,baseH/zoom];svg.setAttribute('viewBox',view.join(' '));const unit=view[2]/box.width;
 let html='<defs><pattern id="grid-pattern" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M 1 0 H 0 V 1" fill="none" stroke="#304337" stroke-width=".024"/></pattern></defs>';
 if($('#grid').checked)html+='<rect x="-1000" y="-1000" width="2000" height="2000" fill="url(#grid-pattern)"/>';
 html+=`<g transform="scale(1 -1)" opacity="${pending?.4:1}">`;
 if(layout!=='diagonal')r?.blocks.forEach((e,i)=>{const color=mono?'#9eaf8e':e.type==='block'?'#a5b691':e.type==='slab'?'#d3b981':'#6b8a66';html+=`<polygon class="tile ${selected===i?'selected':''}" data-index="${i}" points="${polygon(e).map(a=>a.join(',')).join(' ')}" fill="${color}" stroke="#26392c" stroke-width=".025"><title>${describe(e)}</title></polygon>`;});html+='</g>';
 if($('#reference').checked)for(const [points,color,dash]of [[c.points,'#e5a27c',''],[c.inner,'#8bbbd7','5 4']])html+=`<polyline points="${points.map(([x,y])=>`${x},${-y}`).join(' ')}" fill="none" stroke="${color}" stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-dasharray="${dash}" pointer-events="none"/>`;
 if($('#handles').checked)c.handles.forEach(([x,y],i)=>{html+=`<g class="handle" data-handle="${i}" role="slider" tabindex="0" aria-label="${['Left endpoint','Bend position and rise','Right endpoint'][i]}" aria-valuemin="-32" aria-valuemax="96" aria-valuenow="${y.toFixed(1)}" aria-valuetext="x ${x.toFixed(1)}, y ${y.toFixed(1)}"><circle cx="${x}" cy="${-y}" r="${(matchMedia("(pointer:coarse)").matches?22:13)*unit}" fill="transparent"/><circle cx="${x}" cy="${-y}" r="${5.5*unit}" fill="#c1dbac" stroke="#1a2b20" stroke-width="2" vector-effect="non-scaling-stroke"/><title>${['Drag to change left end / span','Drag to move the bend left, right, up or down','Drag to change right end / span'][i]}</title></g>`;});
 const focusedHandle=document.activeElement?.dataset.handle;svg.innerHTML=html;if(focusedHandle!==undefined)svg.querySelector(`[data-handle="${focusedHandle}"]`)?.focus({preventScroll:true});$('#view-title').textContent=layout==='straight'?({circle:'Circular',ellipse:'Elliptical',custom:'Custom'}[p.type])+' roof':'Profile editor';$('#dimensions').textContent=`${c.w.toFixed(1)} wide`;$('#drag-hint').hidden=!$('#handles').checked;
 $('.reference-key').classList.toggle('hidden',!$('#reference').checked);
 if(r){$('#outer-error').textContent=r.outerRms.toFixed(3);$('#inner-error').textContent=r.innerRms.toFixed(3);for(const [id,pred]of [['blocks',e=>e.type==='block'],['slabs',e=>e.type==='slab'],['stairs',e=>['left','right'].includes(e.type)]])$('#'+id).textContent=r.blocks.filter(pred).length;}
 if(layout!=='straight'){const model=scene();if(model){for(const [id,pred]of [['blocks',e=>e.type==='block'],['slabs',e=>e.type==='slab'],['stairs',e=>['left','right'].includes(e.type)]])$('#'+id).textContent=model.blocks.filter(pred).length;$('#outer-error').textContent=model.errors.outerRms.toFixed(3);$('#inner-error').textContent=model.errors.innerRms.toFixed(3);}}
}
function setHandle(index,dx,dy,original,originalCurve){
 p={...original};const w=clamp(originalCurve.w+(index===0?-dx:index===2?dx:0),4,128),hs=originalCurve.handles.map(a=>a[1]);
 if(index===1&&(original.type==='custom'||Math.abs(dx)>.2)){p.type='custom';p.width=w;p.left=hs[0];p.right=hs[2];p.middle=clamp(hs[1]+dy,-32,96);p.bend=clamp(100*(originalCurve.handles[1][0]+dx)/w,10,90);}
 else if(index!==1&&Math.abs(dy)>.2){p.type='custom';p.width=w;p.bend=100*originalCurve.handles[1][0]/originalCurve.w;p.left=hs[0];p.middle=hs[1];p.right=hs[2];p[index===0?'left':'right']=clamp(hs[index]+dy,-32,96);}
 else if(p.type==='circle'){
  if(index===1){const rise=clamp(hs[1]+dy-4,Math.max(.2,w*w/1024),w/2);p.radius=(w*w/4+rise*rise)/(2*rise);p.extent=4*Math.atan(2*rise/w)*180/Math.PI;}
  else p.radius=clamp(w/(2*Math.sin(p.extent*Math.PI/360)),2,128);
 }else if(p.type==='ellipse'){p.width=w;if(index===1)p.height=clamp(hs[1]+dy-4,1,64);}
 else{p.width=w;if(index===1)p.middle=clamp(hs[1]+dy,-32,96);}
 controls();calculate();
}
const svg=$('#preview');function world(e){return new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());}
svg.onpointerdown=e=>{if(e.button!==0)return;const handle=e.target.closest('[data-handle]');drag={x:e.clientX,y:e.clientY,point:world(e),pan:[...pan],target:e.target,handle:handle?+handle.dataset.handle:null,original:{...p},c:curve(p),moved:false};frozenView=[svg.viewBox.baseVal.x,svg.viewBox.baseVal.y,svg.viewBox.baseVal.width,svg.viewBox.baseVal.height];svg.setPointerCapture(e.pointerId);e.preventDefault();};
svg.onpointermove=e=>{if(!drag)return;drag.moved||=Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>3;if(drag.handle!==null){const point=world(e);setHandle(drag.handle,point.x-drag.point.x,drag.point.y-point.y,drag.original,drag.c);}else{const scale=frozenView[2]/svg.clientWidth,dx=(e.clientX-drag.x)*scale,dy=(e.clientY-drag.y)*scale;pan=[drag.pan[0]+dx,drag.pan[1]+dy];const vb=svg.viewBox.baseVal;svg.setAttribute('viewBox',`${frozenView[0]-dx} ${frozenView[1]-dy} ${vb.width} ${vb.height}`);}};
svg.onpointerup=e=>{if(!drag)return;const handle=drag.handle;if(!drag.moved&&handle===null&&drag.target.dataset.index!==undefined&&result){selected=+drag.target.dataset.index;$('#selected').textContent=describe(result.roof.blocks[selected]);}if(handle===null){const vb=svg.viewBox.baseVal;frozenView=null;}else frozenView=null;drag=null;render();if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);};
svg.onpointercancel=()=>{drag=null;frozenView=null;render();};
svg.onkeydown=e=>{const h=e.target.closest('[data-handle]');if(!h||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const i=+h.dataset.handle,d=e.shiftKey?1:.5;setHandle(i,e.key==='ArrowLeft'?-d:e.key==='ArrowRight'?d:0,e.key==='ArrowUp'?d:e.key==='ArrowDown'?-d:0,{...p},curve(p));svg.querySelector(`[data-handle="${i}"]`)?.focus();};
svg.addEventListener('wheel',e=>{e.preventDefault();zoom=clamp(zoom*Math.exp(-e.deltaY*.001),.5,12);render();},{passive:false});
$('#type').onchange=e=>{const c=curve(p);p.type=e.target.value;p.width=clamp(c.w,4,128);p.height=clamp(c.h-4,1,64);p.bend=100*c.handles[1][0]/c.w;p.left=c.handles[0][1];p.middle=c.handles[1][1];p.right=c.handles[2][1];zoom=1;pan=[0,0];controls();calculate();};
$('#thickness').oninput=e=>{if(e.target.value===''||!Number.isFinite(+e.target.value))return;p.thickness=clamp(+e.target.value,1,6);calculate();};
for(const id of ['reference','grid','handles'])$('#'+id).onchange=render;$('#baseline').onchange=calculate;
$('#mono').onclick=()=>{mono=!mono;$('#mono').setAttribute('aria-pressed',String(mono));document.body.classList.toggle('mono',mono);render();};
$('#reset').onclick=()=>{p={...defaults};zoom=1;pan=[0,0];frozenView=null;$('#thickness').value=p.thickness;$('#baseline').checked=false;$('#selected').textContent='1 square = 1 block';controls();calculate();};
$('#plus').onclick=()=>{if(mode3d){three.zoom(1.3);return;}zoom=clamp(zoom*1.3,.5,12);render();};$('#minus').onclick=()=>{if(mode3d){three.zoom(1/1.3);return;}zoom=clamp(zoom/1.3,.5,12);render();};$('#fit').onclick=()=>{if(mode3d){three.fit();return;}zoom=1;pan=[0,0];render();};
function setView(value){mode3d=value;document.body.classList.toggle('mode3d',value);$('#preview').toggleAttribute('hidden',value);$('#preview3d').hidden=!value;$('#depth-control').hidden=!value||layout==='hip';$('#camera-controls').hidden=!value;$('#view-2d').setAttribute('aria-pressed',String(!value));$('#view-3d').setAttribute('aria-pressed',String(value));$('#handles').disabled=value;$('#reference').disabled=value;$('#selected').textContent=layout==='hip'?'Full profile on both wings · full-block seam':layout==='diagonal'?'45° grid · counts include full footprint':value?'3D roof · counts include depth':'2D elevation · counts for one layer';render();}
$('#view-2d').onclick=()=>setView(false);$('#view-3d').onclick=()=>setView(true);$('#depth').oninput=e=>{if(e.target.value===''||!Number.isFinite(+e.target.value))return;roofDepth=clamp(Math.round(+e.target.value),1,32);render();};$('#depth').onchange=()=>$('#depth').value=roofDepth;$('#outside').onclick=()=>three.preset('outside');$('#inside').onclick=()=>three.preset('inside');
$('#top').onclick=()=>three.preset('top');$('#layout').onchange=e=>{layout=e.target.value;sceneCache=null;setView(true);three.preset('outside');calculate();};
new ResizeObserver(render).observe($('#viewport'));
$('#export').onclick=()=>{if(!result||pending)return;const model=layout==='straight'&&!mode3d?placeRoof(result.roof,1):scene();if(!model)return;const rows=['x,y,z,element,placement,full_half_direction'];for(const e of model.blocks)rows.push(`${e.x},${e.y},${e.z},${['right','left'].includes(e.type)?'stair':e.type},${e.type==='block'?'full':e.type==='slab'?(e.flip?'top':'bottom'):(e.flip?'inverted':'upright')},${placementDirection(e)}`);const url=URL.createObjectURL(new Blob([rows.join('\n')],{type:'text/csv'})),a=document.createElement('a');a.href=url;a.download='minecraft-curve-'+layout+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
function setSettings(open){document.body.classList.toggle('settings-open',open);$('#settings-backdrop').hidden=!open;$('#adjust').setAttribute('aria-expanded',String(open));if(open)$('#settings-done').focus();else if(matchMedia('(max-width:760px)').matches)$('#adjust').focus();}
$('#adjust').onclick=()=>setSettings(!document.body.classList.contains('settings-open'));
$('#settings-done').onclick=()=>setSettings(false);
$('#settings-backdrop').onclick=()=>setSettings(false);
$('#reset-mobile').onclick=()=>$('#reset').click();
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('settings-open'))setSettings(false);});
matchMedia('(max-width:760px)').addEventListener('change',e=>{if(!e.matches)setSettings(false);});
controls();calculate();






$('#portrait-trigger').onclick=()=>$('#portrait-dialog').showModal();
$('#portrait-close').onclick=()=>$('#portrait-dialog').close();
$('#portrait-dialog').onclick=e=>{if(e.target===$('#portrait-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}};
