// Explicit, versioned data only. Imported geometry is always rebuilt from editable parameters.
export const blueprintFormat='minecraft-design-blueprint';
const obj=(v,name)=>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error(`Invalid ${name}`);return v;};
const num=(v,min,max,name,integer=false)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||(integer&&!Number.isInteger(v)))throw Error(`Invalid ${name}`);return v;};
const bool=(v,name)=>{if(typeof v!=='boolean')throw Error(`Invalid ${name}`);return v;};
const choice=(v,values,name)=>{if(!values.includes(v))throw Error(`Invalid ${name}`);return v;};
const pair=(v,name)=>{if(!Array.isArray(v)||v.length!==2)throw Error(`Invalid ${name}`);return v.map(n=>num(n,-1e6,1e6,name));};
export function validateCamera(s){obj(s,'camera');return {yaw:num(s.yaw,-1e6,1e6,'camera angle'),pitch:num(s.pitch,-Math.PI/2,Math.PI/2,'camera pitch'),zoom:num(s.zoom,.3,12,'camera zoom'),offset:pair(s.offset,'camera pan')};}
export function validateCurveParams(s){obj(s,'curve');const p={type:choice(s.type,['circle','ellipse','custom'],'curve type')};for(const [key,min,max]of [['radius',2,256],['extent',1,180],['width',4,128],['height',1,64],['left',-256,256],['middle',-256,256],['right',-256,256],['bend',10,90],['thickness',.5,6]])p[key]=num(s[key],min,max,key);p.extraEnabled=s.extraEnabled===undefined?false:bool(s.extraEnabled,'extra point');p.extraPosition=s.extraPosition===undefined?75:num(s.extraPosition,5,95,'extra point position');p.extraHeight=s.extraHeight===undefined?12:num(s.extraHeight,-256,256,'extra point height');if('onlyBlocks'in s)p.onlyBlocks=bool(s.onlyBlocks,'full blocks');return p;}
// Corner gable defaults (kept equal to gableDefaults in frame-curve.js; a test checks this). Older files have no gables.
export const houseGableDefaults={enabled:true,height:7,reach:6,flare:60,thickness:1.5,depth:2,overhang:1};
function validateGables(g){if(g===undefined)return {...houseGableDefaults};obj(g,'corner gables');return {enabled:bool(g.enabled,'corner gables'),height:num(g.height,1,24,'gable height',true),reach:num(g.reach,2,12,'gable reach',true),flare:num(g.flare,0,100,'gable flare',true),thickness:num(g.thickness,.5,4,'gable thickness'),depth:num(g.depth,1,4,'gable depth',true),overhang:num(g.overhang,0,3,'gable overhang',true)};}
const validatePillars=(p,name)=>({outer:num(p?.outer,1,64,name+' outer height',true),inner:num(p?.inner,1,64,name+' inner height',true),center:num(p?.center,1,64,name+' innermost height',true),lift:p?.lift===undefined?3:num(p.lift,0,32,name+' innermost lift',true),beam:p?.beam===undefined?5:num(p.beam,1,64,name+' beam level',true)});
// Angle Roof beam defaults (kept equal to angleBeamDefaults in angle-roof.js; a test checks this).
export const houseAngleBeamDefaults={toOuter:{start:4,angle:26.6,thickness:1,extendStart:0,extendEnd:0},toInner:{start:6,angle:26.6,thickness:1,extendStart:0,extendEnd:0}};
// Ranges kept equal to angleBeamRanges in angle-roof.js (a test checks this).
export const houseAngleBeamRanges={start:[1,64,true],angle:[0,80,false],thickness:[.5,3,false],extendStart:[0,12,true],extendEnd:[0,12,true]};
// Beam runs, kept equal to beamRun() in angle-roof.js: older files stored an end block, converted here to the same angle.
const beamRuns={toOuter:6,toInner:4};
function validateBeams(b,pillars){const out={};for(const key of Object.keys(houseAngleBeamDefaults)){const v=b?.[key];if(v===undefined){out[key]={...houseAngleBeamDefaults[key]};continue;}obj(v,'beams');
 if(v.angle===undefined&&v.end!==undefined){const start=num(v.start,1,64,'beam start',true),end=num(v.end,1,64,'beam end',true),offset=key==='toInner'?pillars.lift:0;out[key]={...houseAngleBeamDefaults[key],start,angle:+Math.max(0,Math.min(80,Math.atan2(end-start-offset,beamRuns[key])*180/Math.PI)).toFixed(1)};continue;}
 out[key]=Object.fromEntries(Object.entries(houseAngleBeamRanges).map(([k,[lo,hi,int]])=>[k,num(v[k],lo,hi,'beam '+k,int)]));}return out;}
// Files from before the Angle Roof start it as a copy of their Curved Roof columns.
function validateAngle(a,pillars){if(a===undefined)return {pillars:{...pillars},beams:validateBeams(undefined,pillars)};obj(a,'Angle Roof');const own=validatePillars(a.pillars,'Angle Roof');return {pillars:own,beams:validateBeams(a.beams,own)};}
export function validateHouseState(s){obj(s,'House Roof');
 // curveSide counts blocks either side of the centre line; older files stored a total width instead.
 const curveSide=s.curveSide!==undefined?num(s.curveSide,0,15,'curve width',true):Math.min(15,Math.round((num(s.curveWidth,1,32,'curve width',true)-1)/2));
 const pillars=validatePillars(s.pillars,'Curved Roof');
 return {params:validateCurveParams(s.params),pillars,curveSide,gables:validateGables(s.gables),enabled:bool(s.enabled,'curve visibility'),locked:bool(s.locked,'bend lock'),grid:bool(s.grid,'grid'),reference:bool(s.reference,'reference'),group:choice(s.group,[null,'deck','gables','path','steps','beam','outer','inner','center','curves','outer-beams','inner-beams'],'selection'),editor:choice(s.editor,['structure','curves'],'editor'),camera:validateCamera(s.camera),variant:s.variant===undefined?'curved':choice(s.variant,['curved','angle'],'roof variation'),angle:validateAngle(s.angle,pillars)};}
// Bridge 1: lower and upper curve settings, the upper curve's placement, and the two beam pairs.
// Beam limits are kept equal to bridgeBeamLimits in bridge1.js (a test checks this).
export const bridgeBeamRanges={height:[1,96],thickness:[1,8],tilt:[0,45],spacing:[1,24],position:[-24,48]};
function validateBridgeBeam(b,name){obj(b,name);return Object.fromEntries(Object.entries(bridgeBeamRanges).map(([key,[lo,hi]])=>[key,num(b[key],lo,hi,`${name} ${key}`,true)]));}
export function validateBridge1State(s){obj(s,'Bridge 1');const u=obj(s.upper,'upper curve'),b=obj(s.beams,'beams');
 return {lower:validateCurveParams(s.lower),upper:{params:validateCurveParams(u.params),level:num(u.level,-256,256,'upper curve height',true),mirrored:bool(u.mirrored,'mirrored upper curve')},beams:{linked:bool(b.linked,'linked beams'),left:validateBridgeBeam(b.left,'left beams'),right:validateBridgeBeam(b.right,'right beams')},
  locks:{lower:bool(s.locks?.lower,'lower centre lock'),upper:bool(s.locks?.upper,'upper centre lock')},onlyBlocks:bool(s.onlyBlocks,'full blocks'),display:{reference:bool(s.display?.reference,'reference'),grid:bool(s.display?.grid,'grid'),handles:bool(s.display?.handles,'handles')},
  mono:bool(s.mono,'single colour'),mode3d:bool(s.mode3d,'3D mode'),depth:num(s.depth,1,32,'depth',true),part:choice(s.part,['lower','beams','upper'],'Bridge 1 panel'),zoom:num(s.zoom,.5,12,'zoom'),pan:pair(s.pan,'pan'),camera:validateCamera(s.camera)};}
export function validateBlueprint(input){
 const b=obj(input,'blueprint');if(b.format!==blueprintFormat||b.version!==1)throw Error('Unsupported blueprint format or version.');const s=obj(b.state,'state'),c=obj(s.curves,'Curves');
 const curves={params:validateCurveParams(c.params),layout:choice(c.layout,['straight','diagonal','hip'],'layout'),depth:num(c.depth,1,32,'depth',true),mode3d:bool(c.mode3d,'3D mode'),mono:bool(c.mono,'single colour'),locked:bool(c.locked,'centre lock'),zoom:num(c.zoom,.5,12,'zoom'),pan:pair(c.pan,'pan'),camera:validateCamera(c.camera),display:{}};
 for(const key of ['reference','grid','handles','baseline'])curves.display[key]=bool(c.display?.[key],key);
 return {format:blueprintFormat,version:1,createdAt:typeof b.createdAt==='string'?b.createdAt:'',state:{activeTab:choice(s.activeTab,['curve','frame','bridge','bridge1'],'workspace'),curves,house:validateHouseState(s.house),bridge:{camera:validateCamera(s.bridge?.camera)},bridge1:s.bridge1===undefined||s.bridge1===null?null:validateBridge1State(s.bridge1)}};
}
export function encodeBlueprint(state){return JSON.stringify(validateBlueprint({format:blueprintFormat,version:1,createdAt:new Date().toISOString(),state}),null,2);}
export function decodeBlueprint(text){if(typeof text!=='string'||text.length>1048576)throw Error('Blueprint must be smaller than 1 MB.');let parsed;try{parsed=JSON.parse(text);}catch{throw Error('This file is not valid blueprint JSON.');}return validateBlueprint(parsed);}
export const versionsKey='minecraft-design-versions-v1';
export function readVersions(storage){const raw=storage.getItem(versionsKey);if(!raw)return [];const list=JSON.parse(raw);if(!Array.isArray(list)||list.length>50)throw Error('Invalid saved versions. Export a blueprint to keep a portable copy.');return list.map(v=>{if(typeof v.id!=='string'||typeof v.name!=='string'||typeof v.savedAt!=='string')throw Error('Invalid saved version');return {id:v.id,name:v.name.slice(0,100),savedAt:v.savedAt,blueprint:validateBlueprint(v.blueprint)};});}
export function appendVersion(storage,entry){const list=readVersions(storage);if(list.length>=50)throw Error('50 versions saved. Export or delete an older version first.');const next={...entry,blueprint:validateBlueprint(entry.blueprint)};storage.setItem(versionsKey,JSON.stringify([...list,next]));return next;}
