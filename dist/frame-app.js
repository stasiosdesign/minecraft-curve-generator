import {validateHouseState} from './blueprint.js';
import {mountCurveControls,editCurveHandle,changeCurveType,toggleExtraPoint} from './curve-editor.js';
import {createFrame,frameDefaults,frameSize} from './frame.js';
import {frameSection,createSectionView} from './frame-section.js';
import {createRoof3D} from './view3d.js';
import {frameCurve,frameCurveDefaults,frameReference,cornerGableProfile,gableDefaults} from './frame-curve.js';
import {polygon} from './geometry.js';
import {placementDirection} from './layout.js';
import {createAngleRoof,angleBeamDefaults,angleBeamSets,angleBeamRanges,beamLimits,beamEnd,angleForEnd,beamPairs} from './angle-roof.js';
const el=id=>document.getElementById(id),limit=(v,a,b)=>Math.max(a,Math.min(b,v));
// Two independent roof variations share the viewer, layers and file actions; each keeps its own settings.
let variant='curved',curvedEditor='structure',diagramDrag=null,diagramView=null;
let frameModel,viewModel,viewKey='',section=null,group=null,hidden=new Set(),view='perspective',sectionAxis='z',levelAll=true,baseSelection='',ready=false,saveTimer,flashTimer;
let profileParams={...frameCurveDefaults},profileRoof=null,profileDrag=null,profileLocked=false,profileView=null,curveWorker=null,curveTimer,curveRequest=0,curveBusy=false;
const frameColors={gables:'#4b4b4b',path:'#565656',steps:'#6f6f6f',beam:'#828282',outer:'#999999',inner:'#afafaf',center:'#c6c6c6',curves:'#e0e0e0','outer-beams':'#dcdcdc','inner-beams':'#f0f0f0'};
const groupNames={gables:'Corner gables · on the outer columns',path:'Pathway · 7 blocks wide, fixed',steps:'Stair ring · 8th block in, fixed',beam:'Outer perimeter beam',outer:'20 outer columns',inner:'12 inner columns',center:'4 innermost columns',curves:'Four roof curves','outer-beams':'Inner → outer beams','inner-beams':'Innermost → inner beams'};
const pieceNames={gables:'Corner gable',path:'Pathway',steps:'Stair ring',beam:'Beam',outer:'Outer column',inner:'Inner column',center:'Innermost column',curves:'Roof curve','outer-beams':'Inner → outer beam','inner-beams':'Innermost → inner beam'};
// The input each layer opens when it is picked in the view, per variation.
const groupInputs={curved:{gables:'gable-height',outer:'outer-height',inner:'inner-height',center:'center-height',beam:'beam-level'},angle:{outer:'angle-outer-height',inner:'angle-inner-height',center:'angle-center-height',beam:'angle-beam-level','outer-beams':'toOuter-start','inner-beams':'toInner-start'}};
const variantGroups={curved:['gables','path','steps','beam','outer','inner','center','curves'],angle:['path','steps','beam','outer','inner','center','outer-beams','inner-beams']};
// Angle Roof settings: its own column inputs (never shared with the Curved Roof) and two beam sets.
const angleInputs={'angle-outer-height':['outer','outerHeight'],'angle-inner-height':['inner','innerHeight'],'angle-center-height':['center','centerHeight'],'angle-center-lift':['lift','centerLift'],'angle-beam-level':['beam','beamLevel']};
const beamKeys=Object.keys(angleBeamSets);
const inputs={'outer-height':'outerHeight','inner-height':'innerHeight','center-height':'centerHeight','center-lift':'centerLift','beam-level':'beamLevel','curve-width':'curveSide'};
const pillarInputs={outer:'outer-height',inner:'inner-height',center:'center-height',lift:'center-lift',beam:'beam-level'};
// Corner gable settings; the arm profile is only refitted when its shape settings change.
const gableInputs={'gable-height':'height','gable-reach':'reach','gable-flare':'flare','gable-thickness':'thickness','gable-depth':'depth','gable-overhang':'overhang'};
let gableKey='',gableProfile=null;
function gableSettings(){const g={enabled:el('gables-enabled').checked};for(const [id,key]of Object.entries(gableInputs))g[key]=+el(id).value;return g;}
function gablesFor(g){if(!g.enabled)return null;const key=[g.height,g.reach,g.flare,g.thickness].join();if(key!==gableKey){gableKey=key;gableProfile=cornerGableProfile(g);}return {profile:gableProfile,depth:g.depth,overhang:g.overhang};}
function setGables(g){el('gables-enabled').checked=g.enabled;for(const [id,key]of Object.entries(gableInputs))el(id).value=g[key];}
const storageKey='minecraft-house-roof-design-v3',legacyKeys=[['minecraft-house-roof-design-v2',.5],['minecraft-house-roof-design-v1',2]],designFormat='minecraft-house-roof-design';
const shape=b=>b.type==='corner'?'inner corner stair':b.type==='outer'?'outer corner stair':b.type==='left'||b.type==='right'?'stair':b.type==='slab'?'slab':'block';
const describe=b=>`${pieceNames[b.group]??b.group} · x ${b.x} · Y ${b.y} · z ${b.z} · ${shape(b)}`;
function selectFrameGroup(next,edit=false,block=null){
 group=next;baseSelection=group?(block?describe(block):groupNames[group]+' selected'):'Tap a column, beam or curve to edit';el('selection').textContent=baseSelection;
 const target=groupInputs[variant][group];
 for(const id of new Set([...Object.values(groupInputs.curved),...Object.values(groupInputs.angle)]))el(id).closest('label').classList.toggle('active',id===target);
 for(const b of document.querySelectorAll('[data-group]'))b.setAttribute('aria-pressed',String(b.dataset.group===group));
 if(edit){showEditor(variant==='angle'?null:group==='curves'?'curves':'structure');if(target&&matchMedia('(min-width:761px)').matches){el(target).closest('details').open=true;el(target).focus({preventScroll:true});}}
 render();
}
const pick=block=>selectFrameGroup(block.group,true,block);
const frameView=createRoof3D(el('frame-canvas'),pick);
const sectionView=createSectionView(el('section-canvas'),{onPick:pick,onHover:hit=>{el('selection').textContent=hit?describe(hit.block)+(hit.cut?' · in the cut':' · beyond the cut'):baseSelection;}});
for(const b of document.querySelectorAll('[data-group]')){b.style.setProperty('--group-color',frameColors[b.dataset.group]);b.onclick=()=>selectFrameGroup(group===b.dataset.group?null:b.dataset.group);}
el('clear-selection').onclick=()=>{hidden.clear();syncEyes();selectFrameGroup(null);};
function syncEyes(){for(const b of document.querySelectorAll('[data-eye]')){const on=!hidden.has(b.dataset.eye),name=b.parentElement.querySelector('[data-group]').textContent;b.setAttribute('aria-pressed',String(on));b.setAttribute('aria-label',(on?'Hide ':'Show ')+name);b.title=(on?'Hide ':'Show ')+name;b.parentElement.classList.toggle('off',!on);}}
for(const b of document.querySelectorAll('[data-eye]'))b.onclick=()=>{const g=b.dataset.eye;if(hidden.has(g))hidden.delete(g);else hidden.add(g);syncEyes();render();};
// Panel visibility: the variation's own settings, and for the Curved Roof its Structure / Curve page.
function syncPanels(){
 el('curved-controls').hidden=variant!=='curved';el('angle-controls').hidden=variant!=='angle';
 el('structure-controls').hidden=curvedEditor!=='structure';el('curve-controls').hidden=curvedEditor!=='curves';
 for(const n of ['structure','curves'])el(n+'-tab').setAttribute('aria-pressed',String(n===curvedEditor));
 for(const v of ['curved','angle'])el('variant-'+v).setAttribute('aria-pressed',String(v===variant));
 for(const chip of document.querySelectorAll('.layer[data-variants]'))chip.hidden=!chip.dataset.variants.split(' ').includes(variant);
 document.body.classList.toggle('curve-mode',variant==='curved'&&curvedEditor==='curves');
 el('export-frame').disabled=variant==='curved'&&curveBusy;
 requestAnimationFrame(drawPanels);
}
function drawPanels(){if(variant==='curved')drawProfile();else drawAngleDiagram();}
function showEditor(name){if(name)curvedEditor=name;syncPanels();document.body.classList.add('editing');}
for(const name of ['structure','curves'])el(name+'-tab').onclick=()=>showEditor(name);
el('open-controls').onclick=()=>{document.body.classList.add('editing');requestAnimationFrame(drawPanels);};
function setVariant(name){if(name===variant)return;variant=name;if(group&&!variantGroups[name].includes(group))group=null;syncPanels();updateFrame();selectFrameGroup(group);}
for(const v of ['curved','angle'])el('variant-'+v).onclick=()=>setVariant(v);
for(const id of ['close-controls','sheet-shade'])el(id).onclick=()=>document.body.classList.remove('editing');
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.body.classList.remove('editing');});
// Views: 3D presets share one canvas; Section is a flat 2D drawing on its own canvas.
const views=[['orbit','perspective'],['top-frame','top'],['front-frame','front'],['section-frame','section']];
function setView(name){view=name;const flat=name==='section';el('frame-canvas').hidden=flat;el('section-canvas').hidden=!flat;el('section-controls').hidden=!flat;for(const [id,v]of views)el(id).setAttribute('aria-pressed',String(v===name));if(flat)sectionView.fit();else frameView.preset(name==='perspective'?'outside':name);render();}
for(const [id,v]of views)el(id).onclick=()=>setView(v);
function syncCut(){const c=+el('cut').value;el('section-axis').textContent=sectionAxis==='z'?'Facing north':'Facing east';el('cut-value').textContent=`${sectionAxis==='z'?'Z':'X'} ${c}${c===(frameSize-1)/2?' · centre':''}`;}
el('section-axis').onclick=()=>{sectionAxis=sectionAxis==='z'?'x':'z';syncCut();render();};
el('cut').oninput=()=>{syncCut();render();};
function syncLevel(){const input=el('level'),min=frameModel.minY,max=frameModel.maxY-1;input.min=min;input.max=max;input.value=levelAll?max:limit(+input.value,min,max);levelAll=+input.value>=max;el('level-value').textContent=levelAll?'All':'Y '+input.value;}
el('level').oninput=()=>{levelAll=+el('level').value>=+el('level').max;el('level-value').textContent=levelAll?'All':'Y '+el('level').value;render();};
function render(){
 if(!frameModel)return;
 const level=+el('level').value,key=[...hidden].sort().join()+'|'+(levelAll?'all':level);
 if(viewModel?.source!==frameModel||key!==viewKey){viewKey=key;viewModel={...frameModel,source:frameModel,blocks:frameModel.blocks.filter(b=>!hidden.has(b.group)&&(levelAll||b.y<=level))};section=null;}
 const options={grid:el('house-grid').checked,selectedGroup:group,groupColors:frameColors,pending:curveBusy&&variant==='curved'};
 if(view==='section'){const cut=+el('cut').value;if(!section||section.axis!==sectionAxis||section.cut!==cut)section=frameSection(viewModel,{axis:sectionAxis,cut});sectionView.update(viewModel,section,options);}
 else frameView.update(viewModel,frameSize,options);
 const shown=viewModel.blocks.length,total=frameModel.blocks.length;
 el('frame-count').textContent=(shown===total?total+' pieces':`${shown} of ${total} pieces shown`)+' · base Y '+frameModel.elevation;
 el('frame-status').textContent=curveBusy&&variant==='curved'?'Updating four curves…':'';
 scheduleSave();
}
function updateFrame(rebuild=true){
 if(rebuild){
  if(variant==='angle'){frameModel=createAngleRoof(angleParams());syncBeamInputs();}
  else{const params={elevation:20,roof:el('curves-enabled').checked?profileRoof:null,gables:gablesFor(gableSettings())};for(const [id,key]of Object.entries(inputs))params[key]=el(id).value;frameModel=createFrame(params);el('curve-width-note').textContent=`${frameModel.curveWidth} wide · ${frameModel.curveSide} each side`;}
  syncLevel();
 }
 render();
 if(variant==='angle')drawAngleDiagram();
}
// ---- Angle Roof ----
// Requested beam ends survive column changes: the model clamps them to the columns, and the inputs show the
// result. An explicit edit commits the clamped value.
let beamRequest=structuredClone(angleBeamDefaults);
function angleParams(){const params={elevation:20,beams:beamRequest};for(const [id,[,key]]of Object.entries(angleInputs))params[key]=el(id).value;return params;}
function anglePillars(){return Object.fromEntries(Object.entries(angleInputs).map(([id,[key]])=>[key,+el(id).value]));}
function setAnglePillars(p){for(const [id,[key]]of Object.entries(angleInputs))el(id).value=p[key];}
// Beam fitting can take a few tens of milliseconds, so live edits rebuild at most once per frame; a commit flushes first.
let frameDirty=false,frameRequest=0,frameForce=false;
function scheduleFrame(force=false){frameForce||=force;frameDirty=true;if(!frameRequest)frameRequest=requestAnimationFrame(()=>{frameRequest=0;flushFrame();});}
function flushFrame(){if(!frameDirty)return;frameDirty=false;const force=frameForce;frameForce=false;updateFrame();syncBeamInputs(force);}
function commitBeam(key){flushFrame();if(frameModel?.beams?.[key])beamRequest[key]={...frameModel.beams[key]};}
function syncBeamInputs(force=false){
 if(variant!=='angle'||!frameModel?.beams)return;
 for(const key of beamKeys){
  const v=frameModel.beams[key],l=beamLimits(key,frameModel),show=(id,value)=>{const input=el(key+'-'+id);if(force||document.activeElement!==input)input.value=value;};
  el(key+'-start').max=l.startMax;show('start',v.start);show('end',+beamEnd(key,v,frameModel).toFixed(1));show('degrees',v.angle);show('thickness',v.thickness);show('extendStart',v.extendStart);show('extendEnd',v.extendEnd);
  el(key+'-angle').value=v.angle;el(key+'-angle').setAttribute('aria-valuetext',v.angle+' degrees');
 }
}
for(const [id]of Object.entries(angleInputs)){
 el(id).oninput=()=>{if(el(id).value!==''&&el(id).validity.valid)scheduleFrame();};
 el(id).onchange=()=>{const input=el(id);input.value=limit(Math.round(+input.value||0),+input.min,+input.max);frameDirty=false;updateFrame();syncBeamInputs(true);};
}
// Start, angle, thickness and extensions are the beam's settings; End is the angle expressed as the block reached on
// the second column, so editing it sets the angle.
for(const key of beamKeys){
 const set=(field,value,force=false)=>{if(!Number.isFinite(value))return;beamRequest[key][field]=value;scheduleFrame(force);};
 for(const field of ['start','thickness','extendStart','extendEnd']){const input=el(key+'-'+field);input.oninput=()=>{if(input.value!=='')set(field,+input.value);};input.onchange=()=>{commitBeam(key);syncBeamInputs(true);};}
 const deg=el(key+'-degrees');deg.oninput=()=>{if(deg.value!=='')set('angle',+deg.value);};deg.onchange=()=>{commitBeam(key);syncBeamInputs(true);};
 el(key+'-angle').oninput=()=>{el(key+'-degrees').value=el(key+'-angle').value;set('angle',+el(key+'-angle').value,true);};el(key+'-angle').onchange=()=>commitBeam(key);
 const end=el(key+'-end');end.onchange=()=>{if(end.value!==''&&Number.isFinite(+end.value)){commitBeam(key);set('angle',angleForEnd(key,frameModel.beams[key].start,+end.value,frameModel));}commitBeam(key);syncBeamInputs(true);};
}
// Section through the middle of the house (Z 10), drawn from the model's own pieces: pathway, stair ring, columns,
// perimeter beam and both beam sets on each side, with stairs and slabs as built. Handles sit on the east beams'
// centre line: the start handle moves in whole blocks, the end handle sets the angle.
const diagramShapes={block:[[0,0],[1,0],[1,1],[0,1]],slab:[[0,0],[1,0],[1,.5],[0,.5]],right:[[0,0],[1,0],[1,1],[.5,1],[.5,.5],[0,.5]],left:[[0,0],[1,0],[1,.5],[.5,.5],[.5,1],[0,1]]};
function diagramBeams(){return beamKeys.map(key=>{const v=frameModel.beams[key],pair=beamPairs(key,frameModel).find(p=>p.wing==='east');if(!pair)return null;const a=[pair.from.x+.5,pair.from.base+v.start-.5],b=[pair.to.x+.5,pair.to.base+beamEnd(key,v,frameModel)-.5];return {key,v,pair,a,b};}).filter(Boolean);}
function drawAngleDiagram(){
 const svg=el('angle-diagram'),rect=svg.getBoundingClientRect();if(!rect.width||variant!=='angle'||!frameModel?.beams)return;
 const m=frameModel,e=m.elevation,cut=m.blocks.filter(b=>b.z===10&&b.x>=-12&&b.x<=36),beams=diagramBeams(),pieceTop=Math.max(...cut.filter(b=>b.group.endsWith('-beams')).map(b=>b.y+1-e),m.outerHeight,m.beamLevel);
 const minX=Math.min(-.6,...cut.map(b=>b.x-.6)),maxX=Math.max(25.6,...cut.map(b=>b.x+1.6)),top=Math.min(Math.max(...cut.map(b=>b.y+1-e)),Math.max(pieceTop,...beams.map(b=>b.b[1]+1))+2)+.5;
 const view=diagramView??[minX,-top,maxX-minX,top+2.2];svg.setAttribute('viewBox',view.join(' '));const unit=Math.max(view[2]/rect.width,view[3]/rect.height),font=10*unit;
 let html=`<defs><pattern id="angle-grid" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M1 0H0V1" fill="none" stroke="#222222" stroke-width="${unit}"/></pattern></defs><rect x="${view[0]}" y="${view[1]}" width="${view[2]}" height="${view[3]}" fill="url(#angle-grid)"/><g transform="scale(1 -1)">`;
 for(const b of cut){const pts=(diagramShapes[b.type]??diagramShapes.block).map(([u,w])=>[b.x+u,b.y-e+(b.flip?1-w:w)]);html+=`<polygon points="${pts.map(p=>p.join(',')).join(' ')}" fill="${frameColors[b.group]??'#999999'}" stroke="#080808" stroke-width="${unit}"${b.group==='beam'?` stroke-opacity=".9"`:''}><title>${describe(b)}</title></polygon>`;}
 for(const b of beams)html+=`<path d="M${b.a[0]} ${b.a[1]}L${b.b[0]} ${b.b[1]}" stroke="#909090" stroke-width="${unit*1.2}" stroke-dasharray="${unit*4} ${unit*3}"/>`;
 html+='</g>';
 html+=`<path d="M${view[0]} 0H${view[0]+view[2]}" stroke="#555555" stroke-width="${unit}"/>`;
 for(const [name,x]of [['Innermost',12.5],['Inner',18.5],['Outer',24.5]])html+=`<text x="${x}" y="${.5}" font-size="${font}" fill="#8d8d8d" text-anchor="${x>24?'end':'middle'}" dominant-baseline="hanging">${name}</text>`;
 for(const b of beams){
  const mx=(b.a[0]+b.b[0])/2+1,my=(b.a[1]+b.b[1])/2-.6*Math.hypot(1,(b.b[1]-b.a[1])/(b.b[0]-b.a[0]))*b.v.thickness;
  html+=`<text x="${mx}" y="${-my+.4}" font-size="${font}" fill="#e6e6e6" text-anchor="middle" dominant-baseline="hanging">${b.v.angle}°</text>`;
  for(const [which,p,label]of [['start',b.a,'start block'],['end',b.b,'end (sets the angle)']])html+=`<g class="handle" data-key="${b.key}" data-end="${which}" tabindex="0" role="slider" aria-label="${b.key==='toOuter'?'Inner to outer':'Innermost to inner'} beam ${label}" aria-valuenow="${which==='start'?b.v.start:b.v.angle}"><circle cx="${p[0]}" cy="${-p[1]}" r="${unit*16}" fill="transparent"/><circle cx="${p[0]}" cy="${-p[1]}" r="${unit*5}" fill="#f2f2f2" stroke="#080808" stroke-width="${unit*1.5}"/></g>`;
 }
 const focused=document.activeElement?.closest?.('#angle-diagram [data-key]'),keep=focused&&[focused.dataset.key,focused.dataset.end];svg.innerHTML=html;
 if(keep)svg.querySelector(`[data-key="${keep[0]}"][data-end="${keep[1]}"]`)?.focus({preventScroll:true});
}
const diagram=el('angle-diagram'),diagramPoint=e=>new DOMPoint(e.clientX,e.clientY).matrixTransform(diagram.getScreenCTM().inverse());
// Start moves in whole blocks; the end is free (quarter blocks) and is turned into an angle about the start.
function moveBeamEnd(key,which,level){const pair=beamPairs(key,frameModel)[0],v=frameModel.beams[key];if(!pair||!v)return;
 if(which==='start')beamRequest[key].start=Math.round(level-pair.from.base+.5);else{beamRequest[key].start=v.start;beamRequest[key].angle=angleForEnd(key,v.start,Math.round((level-pair.to.base+.5)*4)/4,frameModel);}
 scheduleFrame(true);}
diagram.onpointerdown=e=>{const h=e.target.closest('[data-key]');if(!h||e.button!==0)return;commitBeam(h.dataset.key);diagramDrag={key:h.dataset.key,end:h.dataset.end};const v=diagram.viewBox.baseVal;diagramView=[v.x,v.y,v.width,v.height];diagram.setPointerCapture(e.pointerId);e.preventDefault();};
diagram.onpointermove=e=>{if(!diagramDrag)return;moveBeamEnd(diagramDrag.key,diagramDrag.end,-diagramPoint(e).y);};
diagram.onpointerup=diagram.onpointercancel=e=>{if(!diagramDrag)return;commitBeam(diagramDrag.key);diagramDrag=null;diagramView=null;if(diagram.hasPointerCapture(e.pointerId))diagram.releasePointerCapture(e.pointerId);updateFrame();syncBeamInputs(true);};
diagram.onkeydown=e=>{const h=e.target.closest('[data-key]');if(!h||(e.key!=='ArrowUp'&&e.key!=='ArrowDown'))return;e.preventDefault();const {key,end}=h.dataset,v=frameModel.beams[key],sign=e.key==='ArrowUp'?1:-1;commitBeam(key);
 if(end==='start')beamRequest[key].start=v.start+sign;else beamRequest[key].angle=Math.max(0,Math.min(80,v.angle+sign*(e.shiftKey?5:.5)));updateFrame();commitBeam(key);syncBeamInputs(true);};
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
 c.handles.forEach(([x,y],i)=>{html+=i===0?`<rect x="${x-unit*4}" y="${-y-unit*4}" width="${unit*8}" height="${unit*8}" fill="#cbcbcb"><title>Start fixed to centre columns</title></rect>`:`<g data-handle="${i}" class="handle" tabindex="0" role="slider" aria-label="${i===1?'Bend':i===2?'End':'Extra bend'} position" aria-valuetext="${x.toFixed(1)} blocks out, ${(y-profileParams.thickness).toFixed(1)} rise"><circle cx="${x}" cy="${-y}" r="${unit*20}" fill="transparent"/><circle cx="${x}" cy="${-y}" r="${unit*6}" fill="#d2d2d2"/></g>`;});
 const focused=document.activeElement?.dataset.handle;svg.innerHTML=html;if(focused)svg.querySelector(`[data-handle="${focused}"]`)?.focus({preventScroll:true});
}
function syncProfileFields(){el('house-extra-point').textContent=profileParams.extraEnabled?'Remove point':'Add point';el('house-type').value=profileParams.type;el('thickness').value=profileParams.thickness;mountCurveControls(el('house-curve-fields'),profileParams,(key,value)=>{profileParams[key]=value;scheduleCurve();},{prefix:'house-',centerLocked:profileLocked});}
function scheduleCurve(){
 clearTimeout(curveTimer);curveWorker?.terminate();curveWorker=null;const id=++curveRequest;curveBusy=true;el('export-frame').disabled=variant==='curved';drawProfile();updateFrame(false);
 curveTimer=setTimeout(()=>{
  const finish=roof=>{if(id!==curveRequest)return;curveWorker?.terminate();curveWorker=null;profileRoof=roof;curveBusy=false;el('export-frame').disabled=false;updateFrame(variant==='curved');drawProfile();};
  const fail=error=>{if(id!==curveRequest)return;curveBusy=false;el('export-frame').disabled=false;curveWorker?.terminate();curveWorker=null;updateFrame(false);el('frame-status').textContent=error;};
  const fallback=()=>{try{finish(frameCurve(profileParams).roof);}catch(e){fail(e.message);}};
  if(!globalThis.FRAME_WORKER_SOURCE){fallback();return;}
  let url;try{url=URL.createObjectURL(new Blob([globalThis.FRAME_WORKER_SOURCE],{type:'text/javascript'}));curveWorker=new Worker(url);curveWorker.onmessage=({data})=>data.error?fail(data.error):finish(data.roof);curveWorker.onerror=e=>{e.preventDefault();fallback();};curveWorker.postMessage({...profileParams});}catch{fallback();}finally{if(url)URL.revokeObjectURL(url);}
 },profileDrag?100:40);
}
for(const id of [...Object.keys(inputs),...Object.keys(gableInputs)]){
 el(id).oninput=()=>{if(el(id).value!==''&&el(id).validity.valid)updateFrame();};
 el(id).onchange=()=>{const input=el(id),step=+input.step||1;input.value=limit(Math.round(+input.value/step)*step,+input.min,+input.max);updateFrame();};
}
el('house-type').onchange=()=>{profileParams=changeCurveType(profileParams,el('house-type').value,{lockStart:true});syncProfileFields();scheduleCurve();};
el('thickness').oninput=()=>{if(el('thickness').value!==''&&el('thickness').validity.valid){profileParams.thickness=+el('thickness').value;scheduleCurve();}};
el('house-baseline').onchange=()=>{profileParams.onlyBlocks=el('house-baseline').checked;scheduleCurve();};
for(const id of ['house-grid','house-reference'])el(id).onchange=()=>{drawProfile();render();};
el('curves-enabled').onchange=()=>updateFrame();
el('gables-enabled').onchange=()=>updateFrame();
function setLock(on){profileLocked=on;el('profile-lock').setAttribute('aria-pressed',String(on));el('profile-lock').textContent=on?'Unlock bend':'Lock bend';}
el('profile-lock').onclick=()=>{setLock(!profileLocked);if(profileLocked)profileParams.bend=50;syncProfileFields();scheduleCurve();};
const profileSvg=el('profile'),point=e=>new DOMPoint(e.clientX,e.clientY).matrixTransform(profileSvg.getScreenCTM().inverse());
function moveProfile(handle,dx,dy,original,center=false){profileParams=editCurveHandle(original,handle,dx,dy,{center:center||profileLocked,lockStart:true});syncProfileFields();scheduleCurve();}
profileSvg.onpointerdown=e=>{const h=e.target.closest('[data-handle]');if(!h||e.button!==0)return;profileDrag={handle:+h.dataset.handle,point:point(e),original:{...profileParams},dx:0,dy:0};const v=profileSvg.viewBox.baseVal;profileView=[v.x,v.y,v.width,v.height];profileSvg.setPointerCapture(e.pointerId);e.preventDefault();};
profileSvg.onpointermove=e=>{if(!profileDrag)return;const q=point(e);profileDrag.dx=q.x-profileDrag.point.x;profileDrag.dy=profileDrag.point.y-q.y;moveProfile(profileDrag.handle,profileDrag.dx,profileDrag.dy,profileDrag.original,e.shiftKey);};
profileSvg.onpointerup=profileSvg.onpointercancel=e=>{profileDrag=null;profileView=null;if(profileSvg.hasPointerCapture(e.pointerId))profileSvg.releasePointerCapture(e.pointerId);drawProfile();};
for(const event of ['keydown','keyup'])document.addEventListener(event,e=>{if(e.key==='Shift'&&profileDrag)moveProfile(profileDrag.handle,profileDrag.dx,profileDrag.dy,profileDrag.original,e.shiftKey);});
profileSvg.onkeydown=e=>{const h=e.target.closest('[data-handle]');if(!h||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();moveProfile(+h.dataset.handle,e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0,e.key==='ArrowUp'?.5:e.key==='ArrowDown'?-.5:0,{...profileParams},e.shiftKey);};
el('house-extra-point').onclick=()=>{profileParams=toggleExtraPoint(profileParams,{lockStart:true});syncProfileFields();scheduleCurve();};
// Reset only touches the variation on screen; the other keeps its settings.
const angleDefaults={outer:frameDefaults.outerHeight,inner:frameDefaults.innerHeight,center:frameDefaults.centerHeight,lift:frameDefaults.centerLift,beam:frameDefaults.beamLevel};
el('reset-frame').onclick=()=>{
 hidden.clear();syncEyes();levelAll=true;
 if(variant==='angle'){setAnglePillars(angleDefaults);beamRequest=structuredClone(angleBeamDefaults);selectFrameGroup(null);updateFrame();syncBeamInputs(true);setView('perspective');flash('Angle Roof reset to the defaults.');return;}
 for(const [id,key]of Object.entries(inputs))el(id).value=frameDefaults[key];setGables(gableDefaults);profileParams={...frameCurveDefaults};el('house-baseline').checked=false;setLock(false);el('curves-enabled').checked=true;selectFrameGroup(null);syncProfileFields();updateFrame();scheduleCurve();setView('perspective');flash('Curved Roof reset to the defaults.');
};
const activeView=()=>view==='section'?sectionView:frameView;
el('minus-frame').onclick=()=>activeView().zoom(1/1.3);el('plus-frame').onclick=()=>activeView().zoom(1.3);el('fit-frame').onclick=()=>activeView().fit();
function download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function flash(text){el('design-status').textContent=text;clearTimeout(flashTimer);flashTimer=setTimeout(()=>{el('design-status').textContent='';},5000);}
el('export-frame').onclick=()=>{if(curveBusy&&variant==='curved')return;const placement=b=>b.type==='block'?'full':b.type==='slab'?(b.flip?'upper':'lower'):(b.flip?'inverted':'upright')+(b.type==='corner'?' inner corner':b.type==='outer'?' outer corner':''),rows=['x,y,z,element,placement,full_half_direction,group,wing',...frameModel.blocks.map(b=>`${b.x},${b.y},${b.z},${['left','right','corner','outer'].includes(b.type)?'stair':b.type},${placement(b)},${placementDirection(b)},${b.group},${b.wing??''}`)];download(rows.join('\n'),variant==='angle'?'minecraft-angle-roof.csv':'minecraft-house-roof.csv','text/csv');};
// Portable design files hold only editable settings; geometry is always rebuilt from them.
el('save-design').onclick=()=>{try{const stamp=new Date().toISOString(),data={format:designFormat,version:1,savedAt:stamp,house:validateHouseState(globalThis.houseRoofState.capture())};download(JSON.stringify(data,null,2),`house-roof-design-${stamp.slice(0,16).replace(/[:T]/g,'-')}.json`,'application/json');flash('Design saved to your downloads. Use Open to load it again.');}catch(e){flash(e.message);}};
el('open-design').onclick=()=>el('design-file').click();
el('design-file').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>1048576)throw Error('Design files must be smaller than 1 MB.');let data;try{data=JSON.parse(await file.text());}catch{throw Error('This file is not a valid design file.');}const house=data?.format===designFormat?data.house:data?.format==='minecraft-design-blueprint'?data.state?.house:null;if(!house)throw Error('This file is not a House Roof design or blueprint.');globalThis.houseRoofState.restore(house);flash(`Opened ${file.name}. It is now the saved design in this browser.`);}catch(error){flash(error.message);}finally{e.target.value='';}};
function scheduleSave(){if(!ready)return;clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(storageKey,JSON.stringify(globalThis.houseRoofState.capture()));el('autosave').textContent='Autosaved in this browser';}catch{el('autosave').textContent='Autosave unavailable: use Save';}},400);}
new ResizeObserver(()=>{if(frameModel)render();drawPanels();}).observe(el('viewport'));

globalThis.houseRoofState={capture(){return {params:{...profileParams},pillars:Object.fromEntries(Object.entries(pillarInputs).map(([key,id])=>[key,+el(id).value])),curveSide:+el('curve-width').value,gables:gableSettings(),enabled:el('curves-enabled').checked,locked:profileLocked,grid:el('house-grid').checked,reference:el('house-reference').checked,group,editor:curvedEditor,camera:frameView.getState(),variant,angle:{pillars:anglePillars(),beams:structuredClone(beamRequest)}};},restore(input){const s=validateHouseState(input);profileParams={...s.params};for(const [key,id]of Object.entries(pillarInputs))el(id).value=s.pillars[key];el('curve-width').value=s.curveSide;setGables(s.gables);el('curves-enabled').checked=s.enabled;el('house-grid').checked=s.grid;el('house-reference').checked=s.reference;el('house-baseline').checked=!!s.params.onlyBlocks;setLock(s.locked);profileDrag=null;profileView=null;syncProfileFields();
 setAnglePillars(s.angle.pillars);beamRequest=structuredClone(s.angle.beams);variant=s.variant;curvedEditor=s.editor;syncPanels();document.body.classList.remove('editing');updateFrame();syncBeamInputs(true);const g=s.group==='deck'?null:s.group;selectFrameGroup(variantGroups[variant].includes(g)?g:null);if(view!=='perspective')setView('perspective');frameView.setState(s.camera);scheduleCurve();}};

syncEyes();syncCut();syncProfileFields();syncPanels();updateFrame();scheduleCurve();
// Older autosaves carried earlier default thicknesses (2, then 0.5); carry them over once at the current default.
try{let saved=JSON.parse(localStorage.getItem(storageKey)??'null');for(const [key,oldDefault]of legacyKeys){if(saved)break;saved=JSON.parse(localStorage.getItem(key)??'null');if(saved?.params?.thickness===oldDefault)saved.params.thickness=frameCurveDefaults.thickness;}if(saved)globalThis.houseRoofState.restore(saved);}catch{}
ready=true;
