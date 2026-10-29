import {encodeBlueprint,decodeBlueprint,validateBlueprint,readVersions,appendVersion,versionsKey} from './blueprint.js';
import {curveDefaults,curveSpecs,mountCurveControls,editCurveHandle,changeCurveType,toggleExtraPoint} from './curve-editor.js';
import {polygon} from './geometry.js';
import {curve} from './curves.js';
import {solve,measurePlacedRoof} from './optimizer.js';
import {createRoof3D} from './view3d.js';
import {placeRoof,placementDirection} from './layout.js';
const $=s=>document.querySelector(s),defaults={...curveDefaults};
let p={...defaults},result,worker,timer,watchdog,request=0,zoom=1,pan=[0,0],drag,selected=-1,mono=false,pending=false,frozenView=null;
const specs=curveSpecs;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
let centerLocked=false;
let mode3d=false,roofDepth=12,layout='straight',sceneCache=null;
function scene(){if(!result||result.layout!==layout)return null;const key=layout+':'+roofDepth;if(sceneCache?.roof===result.roof&&sceneCache.key===key)return sceneCache.model;const model=placeRoof(result.roof,roofDepth,layout,result.c.w);model.errors=measurePlacedRoof(model.blocks,result.c,layout);sceneCache={roof:result.roof,key,model};return model;}
const three=createRoof3D($('#preview3d'),(e,z)=>{$('#selected').textContent=describe(e)+` · z ${z}`;});
function controls(){$('#extra-point').textContent=p.extraEnabled?'Remove point':'Add point';$('#type').value=p.type;mountCurveControls($('#controls'),p,(key,value)=>{p[key]=value;calculate();},{centerLocked});}
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
 const svg=$('#preview'),c=curve({...p,layout}),r=result?.roof,box=$('#viewport').getBoundingClientRect();if(box.height<=0||box.width<=0)return;
 if(mode3d){const model=scene();three.update(model,roofDepth,{mono,grid:$('#grid').checked,pending});$('#dimensions').textContent=model?`${model.maxX-model.minX} × ${model.maxZ-model.minZ} footprint`:'';$('#drag-hint').hidden=false;$('#drag-hint').textContent='Drag to orbit · Shift-drag to pan · Scroll to zoom';if(model){$('#outer-error').textContent=model.errors.outerRms.toFixed(3);$('#inner-error').textContent=model.errors.innerRms.toFixed(3);for(const [id,pred]of [['blocks',e=>e.type==='block'],['slabs',e=>e.type==='slab'],['stairs',e=>['left','right'].includes(e.type)]])$('#'+id).textContent=model.blocks.filter(pred).length;}return;}
 $('#drag-hint').textContent='Drag handles to shape · Drag grid to pan';
 const minY=Math.min(c.min,r?.minY??c.min),maxY=Math.max(c.h,r?.maxY??c.h),w=c.w,aspect=box.width/box.height,baseW=Math.max(w+6,(maxY-minY+6)*aspect),baseH=baseW/aspect;
 const view=frozenView??[w/2-baseW/(2*zoom)-pan[0],-(maxY+minY)/2-baseH/(2*zoom)-pan[1],baseW/zoom,baseH/zoom];svg.setAttribute('viewBox',view.join(' '));const unit=view[2]/box.width;
 let html='<defs><pattern id="grid-pattern" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M 1 0 H 0 V 1" fill="none" stroke="#3e3e3e" stroke-width=".024"/></pattern></defs>';
 if($('#grid').checked)html+='<rect x="-1000" y="-1000" width="2000" height="2000" fill="url(#grid-pattern)"/>';
 html+=`<g transform="scale(1 -1)" opacity="${pending?.4:1}">`;
 if(layout!=='diagonal')r?.blocks.forEach((e,i)=>{const color=mono?'#a9a9a9':e.type==='block'?'#b0b0b0':e.type==='slab'?'#bababa':'#818181';html+=`<polygon class="tile ${selected===i?'selected':''}" data-index="${i}" points="${polygon(e).map(a=>a.join(',')).join(' ')}" fill="${color}" stroke="#343434" stroke-width=".025"><title>${describe(e)}</title></polygon>`;});html+='</g>';
 if($('#reference').checked)for(const [points,color,dash]of [[c.points,'#aeaeae',''],[c.inner,'#b3b3b3','5 4']])html+=`<polyline points="${points.map(([x,y])=>`${x},${-y}`).join(' ')}" fill="none" stroke="${color}" stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-dasharray="${dash}" pointer-events="none"/>`;
 if(centerLocked)html+=`<line x1="${c.w/2}" x2="${c.w/2}" y1="${view[1]}" y2="${view[1]+view[3]}" stroke="#c5c5c5" stroke-opacity=".45" stroke-dasharray="4 5" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
 if($('#handles').checked)c.handles.forEach(([x,y],i)=>{html+=`<g class="handle" data-handle="${i}" role="slider" tabindex="0" aria-label="${['Left endpoint','Bend position and rise','Right endpoint','Extra bend'][i]}" aria-valuemin="-32" aria-valuemax="96" aria-valuenow="${y.toFixed(1)}" aria-valuetext="x ${x.toFixed(1)}, y ${y.toFixed(1)}"><circle cx="${x}" cy="${-y}" r="${(matchMedia("(pointer:coarse)").matches?22:13)*unit}" fill="transparent"/><circle cx="${x}" cy="${-y}" r="${5.5*unit}" fill="#d2d2d2" stroke="#272727" stroke-width="2" vector-effect="non-scaling-stroke"/><title>${['Drag to change left end / span','Drag to move the bend left, right, up or down · Hold Shift to centre','Drag to change right end / span','Drag the extra bend'][i]}</title></g>`;});
 const focusedHandle=document.activeElement?.dataset.handle;svg.innerHTML=html;if(focusedHandle!==undefined)svg.querySelector(`[data-handle="${focusedHandle}"]`)?.focus({preventScroll:true});$('#view-title').textContent=layout==='straight'?({circle:'Circular',ellipse:'Elliptical',custom:'Custom'}[p.type])+' roof':'Profile editor';$('#dimensions').textContent=`${c.w.toFixed(1)} wide`;$('#drag-hint').hidden=!$('#handles').checked;
 $('.reference-key').classList.toggle('hidden',!$('#reference').checked);
 if(r){$('#outer-error').textContent=r.outerRms.toFixed(3);$('#inner-error').textContent=r.innerRms.toFixed(3);for(const [id,pred]of [['blocks',e=>e.type==='block'],['slabs',e=>e.type==='slab'],['stairs',e=>['left','right'].includes(e.type)]])$('#'+id).textContent=r.blocks.filter(pred).length;}
 if(layout!=='straight'){const model=scene();if(model){for(const [id,pred]of [['blocks',e=>e.type==='block'],['slabs',e=>e.type==='slab'],['stairs',e=>['left','right'].includes(e.type)]])$('#'+id).textContent=model.blocks.filter(pred).length;$('#outer-error').textContent=model.errors.outerRms.toFixed(3);$('#inner-error').textContent=model.errors.innerRms.toFixed(3);}}
}
function setHandle(index,dx,dy,original,originalCurve,center=false){p=editCurveHandle(original,index,dx,dy,{originalCurve,center:center||centerLocked});controls();calculate();}
for(const event of ['keydown','keyup'])document.addEventListener(event,e=>{if(e.key==='Shift'&&drag?.handle===1){e.preventDefault();setHandle(1,drag.dx,drag.dy,drag.original,drag.c,e.shiftKey);}});
$('#center-lock').onclick=()=>{centerLocked=!centerLocked;$('#center-lock').setAttribute('aria-pressed',String(centerLocked));$('#center-lock').textContent=centerLocked?'Unlock centre':'Lock centre';if(centerLocked){$('#handles').checked=true;setHandle(1,0,0,{...p},curve({...p,layout}),true);}else{controls();render();}};
const svg=$('#preview');function world(e){return new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());}
svg.onpointerdown=e=>{if(e.button!==0)return;const handle=e.target.closest('[data-handle]');drag={x:e.clientX,y:e.clientY,point:world(e),pan:[...pan],target:e.target,handle:handle?+handle.dataset.handle:null,original:{...p},c:curve({...p,layout}),dx:0,dy:0,moved:false};frozenView=[svg.viewBox.baseVal.x,svg.viewBox.baseVal.y,svg.viewBox.baseVal.width,svg.viewBox.baseVal.height];svg.setPointerCapture(e.pointerId);if(drag.handle===1&&e.shiftKey)setHandle(1,0,0,drag.original,drag.c,true);e.preventDefault();};
svg.onpointermove=e=>{if(!drag)return;drag.moved||=Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>3;if(drag.handle!==null){const point=world(e);drag.dx=point.x-drag.point.x;drag.dy=drag.point.y-point.y;setHandle(drag.handle,drag.dx,drag.dy,drag.original,drag.c,e.shiftKey);}else{const scale=frozenView[2]/svg.clientWidth,dx=(e.clientX-drag.x)*scale,dy=(e.clientY-drag.y)*scale;pan=[drag.pan[0]+dx,drag.pan[1]+dy];const vb=svg.viewBox.baseVal;svg.setAttribute('viewBox',`${frozenView[0]-dx} ${frozenView[1]-dy} ${vb.width} ${vb.height}`);}};
svg.onpointerup=e=>{if(!drag)return;const handle=drag.handle;if(!drag.moved&&handle===null&&drag.target.dataset.index!==undefined&&result){selected=+drag.target.dataset.index;$('#selected').textContent=describe(result.roof.blocks[selected]);}if(handle===null){const vb=svg.viewBox.baseVal;frozenView=null;}else frozenView=null;drag=null;render();if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);};
svg.onpointercancel=()=>{drag=null;frozenView=null;render();};
svg.onkeydown=e=>{const h=e.target.closest('[data-handle]');if(!h||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const i=+h.dataset.handle,d=e.shiftKey?1:.5;setHandle(i,e.key==='ArrowLeft'?-d:e.key==='ArrowRight'?d:0,e.key==='ArrowUp'?d:e.key==='ArrowDown'?-d:0,{...p},curve({...p,layout}));svg.querySelector(`[data-handle="${i}"]`)?.focus();};
svg.addEventListener('wheel',e=>{e.preventDefault();zoom=clamp(zoom*Math.exp(-e.deltaY*.001),.5,12);render();},{passive:false});
$('#type').onchange=e=>{p=changeCurveType(p,e.target.value);zoom=1;pan=[0,0];controls();calculate();};
$('#thickness').oninput=e=>{if(e.target.value===''||!Number.isFinite(+e.target.value))return;p.thickness=clamp(+e.target.value,1,6);calculate();};
for(const id of ['reference','grid','handles'])$('#'+id).onchange=render;$('#baseline').onchange=calculate;
$('#mono').onclick=()=>{mono=!mono;$('#mono').setAttribute('aria-pressed',String(mono));document.body.classList.toggle('mono',mono);render();};
$('#reset').onclick=()=>{centerLocked=false;$('#center-lock').setAttribute('aria-pressed','false');$('#center-lock').textContent='Lock centre';p={...defaults};zoom=1;pan=[0,0];frozenView=null;$('#thickness').value=p.thickness;$('#baseline').checked=false;$('#selected').textContent='1 square = 1 block';controls();calculate();};
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


let activeTab='curve';
function activateWorkspace(name){activeTab=name;setSettings(false);document.body.classList.toggle('frame-active',name!=='curve');$('#frame-panel').hidden=name!=='frame';$('#bridge-panel').hidden=name!=='bridge';for(const tab of ['curve','frame','bridge'])$('#'+tab+'-tab').setAttribute('aria-pressed',String(tab===name));if(name==='curve')render();}
for(const name of ['curve','frame','bridge'])$('#'+name+'-tab').onclick=()=>activateWorkspace(name);
function captureWorkspace(){const house=$('#frame-panel').contentWindow.houseRoofState,bridge=$('#bridge-panel').contentWindow.bridgeState;if(!house||!bridge)throw Error('The editors are still loading. Try again in a moment.');return {activeTab,curves:{params:{...p},layout,depth:roofDepth,mode3d,mono,locked:centerLocked,zoom,pan:[...pan],camera:three.getState(),display:Object.fromEntries(['reference','grid','handles','baseline'].map(id=>[id,$('#'+id).checked]))},house:house.capture(),bridge:bridge.capture()};}
function restoreWorkspace(input){const s=validateBlueprint(input).state;const house=$('#frame-panel').contentWindow.houseRoofState,bridge=$('#bridge-panel').contentWindow.bridgeState;if(!house||!bridge)throw Error('The editors are still loading.');const c=s.curves;p={...c.params};layout=c.layout;roofDepth=c.depth;mono=c.mono;centerLocked=c.locked;zoom=c.zoom;pan=[...c.pan];drag=null;frozenView=null;sceneCache=null;$('#layout').value=layout;$('#depth').value=roofDepth;$('#thickness').value=p.thickness;$('#mono').setAttribute('aria-pressed',String(mono));document.body.classList.toggle('mono',mono);$('#center-lock').setAttribute('aria-pressed',String(centerLocked));$('#center-lock').textContent=centerLocked?'Unlock centre':'Lock centre';for(const [id,value]of Object.entries(c.display))$('#'+id).checked=value;controls();setView(c.mode3d);three.setState(c.camera);house.restore(s.house);bridge.restore(s.bridge);activateWorkspace(s.activeTab);calculate();}
globalThis.designWorkspace={capture:captureWorkspace,restore:restoreWorkspace,export:()=>encodeBlueprint(captureWorkspace()),import:text=>restoreWorkspace(decodeBlueprint(text))};

$('#extra-point').onclick=()=>{p=toggleExtraPoint(p);controls();calculate();};
// Saved versions are local to this browser/origin; JSON blueprints are portable.
function versionMessage(text){$('#versions-status').textContent=text;}
function refreshVersions(){const list=$('#version-list');list.replaceChildren();try{const versions=readVersions(localStorage);if(!versions.length){const item=document.createElement('p');item.textContent='No saved versions yet.';list.append(item);}for(const v of versions.toReversed()){const row=document.createElement('div');row.className='version-row';const label=document.createElement('span');label.textContent=v.name;label.title=v.savedAt;const restore=document.createElement('button');restore.textContent='Restore';restore.onclick=()=>{try{restoreWorkspace(v.blueprint);$('#versions-dialog').close();}catch(e){versionMessage(e.message);}};const remove=document.createElement('button');remove.textContent='Delete';remove.setAttribute('aria-label','Delete '+v.name);remove.onclick=()=>{try{localStorage.setItem(versionsKey,JSON.stringify(readVersions(localStorage).filter(item=>item.id!==v.id)));refreshVersions();}catch{versionMessage('Browser storage is unavailable. Export a blueprint instead.');}};row.append(label,restore,remove);list.append(row);}}catch{versionMessage('Saved versions are unavailable in this browser. Use blueprint export/import instead.');}}
$('#versions-open').onclick=()=>{versionMessage('');refreshVersions();$('#versions-dialog').showModal();};
$('#versions-close').onclick=()=>$('#versions-dialog').close();
$('#save-version').onclick=()=>{try{const blueprint=decodeBlueprint(encodeBlueprint(captureWorkspace())),name=$('#version-name').value.trim()||'Version '+new Date().toLocaleString();appendVersion(localStorage,{id:globalThis.crypto?.randomUUID?.()??String(Date.now()),name:name.slice(0,100),savedAt:new Date().toISOString(),blueprint});refreshVersions();versionMessage('Version saved in this browser.');}catch(e){versionMessage(e.name==='QuotaExceededError'||e.name==='SecurityError'?'Browser storage is unavailable or full. Export a blueprint instead.':e.message);}};
$('#export-blueprint').onclick=()=>{try{const json=encodeBlueprint(captureWorkspace()),url=URL.createObjectURL(new Blob([json],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='minecraft-design.blueprint.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);versionMessage('Blueprint exported with editable settings for all tabs.');}catch(e){versionMessage(e.message);}};
$('#import-blueprint').onclick=()=>$('#blueprint-file').click();
$('#blueprint-file').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>1048576)throw Error('Blueprint must be smaller than 1 MB.');const blueprint=decodeBlueprint(await file.text());restoreWorkspace(blueprint);$('#versions-dialog').close();}catch(error){versionMessage(error.message);}finally{e.target.value='';}};
