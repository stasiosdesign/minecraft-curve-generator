import assert from 'node:assert/strict';
import {curve} from './dist/curves.js';
import {solve} from './dist/optimizer.js';
import {curveDefaults} from './dist/curve-editor.js';
import {bridgeDefaults,bridgeModel,bridgeBeams,bridgeBeamLimits,pairCells,upperFromLower,centreShift,gridWidth,beamBase} from './dist/bridge1.js';
import {bridgeBeamRanges,validateBridge1State} from './dist/blueprint.js';
assert.deepEqual(Object.fromEntries(Object.entries(bridgeBeamLimits).map(([k,[lo,hi]])=>[k,[lo,hi]])),bridgeBeamRanges,'saved-design beam limits match the geometry limits');
const fit=p=>solve(curve(p),{onlyBlocks:!!p.onlyBlocks}),key=e=>`${e.x},${e.y},${e.type},${!!e.flip}`;
const build=(s,extra={})=>bridgeModel({...s,lowerRoof:fit(s.lower),upperRoof:fit(s.upper.params),...extra});
const d=bridgeDefaults(),m=build(d),part=(model,name)=>model.elements.filter(e=>e.part===name);
// Lower curve: exactly the Curves tab's solver output for the same settings, centred on the bridge.
assert.deepEqual(d.lower,curveDefaults,'lower curve starts from the Curves tab defaults');
for(const p of [curveDefaults,{...curveDefaults,type:'ellipse',width:30,height:9},{...curveDefaults,type:'custom',left:4,middle:15,right:9,width:28.5,bend:40},{...curveDefaults,thickness:3.5,onlyBlocks:true}]){
 const s={...d,lower:p},shift=centreShift(curve(p));
 assert.deepEqual(part(build(s),'lower').map(key).sort(),fit(p).blocks.map(e=>key({...e,x:e.x+shift})).sort(),'lower curve = Curves tab blocks');
}
// Upper curve: a copy of the lower settings, upside down, mirroring every lower block across a line above the crown.
assert.deepEqual(d.upper.params,d.lower);assert.equal(d.upper.mirrored,true);
const lower=part(m,'lower'),upper=part(m,'upper'),upperKeys=new Set(upper.map(key));assert.equal(upper.length,lower.length);
for(const e of lower)assert(upperKeys.has(key({...e,y:d.upper.level+3-e.y,flip:e.type==='block'?false:!e.flip})),'upper block mirrors '+key(e));
assert(Math.min(...upper.map(e=>e.y))>Math.max(...lower.map(e=>e.y)),'upper curve sits above the lower curve');
for(const p of [{...curveDefaults,radius:30,extent:80},{...curveDefaults,type:'custom',left:4,middle:20,right:4,width:24}]){
 const s={...d,lower:p,upper:upperFromLower(p)},model=build(s),lo=part(model,'lower'),up=new Set(part(model,'upper').map(key));
 for(const e of lo)assert(up.has(key({...e,y:s.upper.level+3-e.y,flip:e.type==='block'?false:!e.flip})),'mirror holds for other curves');
 assert(Math.min(...part(model,'upper').map(e=>e.y))>Math.max(...lo.map(e=>e.y)));
}
// Not linked: editing the lower curve leaves the upper curve untouched, and the upper curve edits on its own.
const lowerEdited={...d,lower:{...d.lower,radius:28,extent:100}},m2=build(lowerEdited);
assert.deepEqual(part(m2,'upper').map(key),upper.map(key),'upper curve unchanged by lower edits');
const upperEdited={...d,upper:{...d.upper,params:{...d.upper.params,type:'ellipse',width:24,height:6},level:40}},m3=build(upperEdited);
assert.notDeepEqual(part(m3,'upper').map(key),upper.map(key),'upper curve edits independently');assert.deepEqual(part(m3,'lower').map(key),lower.map(key),'lower unchanged by upper edits');
const upright=build({...d,upper:{...d.upper,mirrored:false}});assert.deepEqual(part(upright,'upper').map(e=>e.y-d.upper.level+4).sort((a,b)=>a-b),fit(d.upper.params).blocks.map(e=>e.y).sort((a,b)=>a-b),'unmirrored upper curve is the same arch lifted');
// Beams: always four, two per side, each pair parallel, leaning towards the centre.
const beamsOf=model=>{const g={};for(const e of part(model,'beam'))(g[e.beam]??=[]).push(e);return g;};
const rows=cells=>{const r=new Map();for(const c of cells){if(!r.has(c.y))r.set(c.y,[]);r.get(c.y).push(c.x);}return r;};
const centreAt=(cells,y)=>{const xs=rows(cells).get(y);return (Math.min(...xs)+Math.max(...xs)+1)/2;};
const lc=curve(d.lower),mid=centreShift(lc)+gridWidth(lc)/2;
for(const beams of [d.beams,{linked:false,left:{height:12,thickness:1,tilt:20,spacing:2,position:4},right:{height:40,thickness:3,tilt:3,spacing:6,position:-6}},{linked:true,left:{height:20,thickness:2,tilt:0,spacing:1,position:0},right:{height:20,thickness:2,tilt:0,spacing:1,position:0}}]){
 const g=beamsOf(bridgeModel({...d,beams}));assert.deepEqual(Object.keys(g).sort(),['left-inner','left-outer','right-inner','right-outer'],'four beams');
 for(const side of ['left','right']){
  const b=beams[side],outer=g[side+'-outer'],inner=g[side+'-inner'],pitch=b.thickness+b.spacing,dir=side==='left'?1:-1,base=beamBase(lc);
  assert.deepEqual(outer.map(c=>`${c.x+dir*pitch},${c.y}`).sort(),inner.map(c=>`${c.x},${c.y}`).sort(),side+' beams are parallel: one is the other shifted');
  assert.deepEqual([...rows(inner).keys()].sort((a,b)=>a-b),Array.from({length:b.height},(_,i)=>base+i),side+' beam height');
  for(const xs of rows(inner).values())assert(xs.length>=b.thickness&&xs.length<=b.thickness+1,'beam thickness per row');
  // Gap between the pair in each row equals the spacing.
  for(const [y,xs]of rows(inner)){const os=rows(outer).get(y),gap=side==='left'?Math.min(...xs)-Math.max(...os)-1:Math.min(...os)-Math.max(...xs)-1;assert(gap>=b.spacing-1&&gap<=b.spacing,'spacing between the pair');}
  const lean=(centreAt(inner,base+b.height-1)-centreAt(inner,base))*dir,expected=(b.height-1)*Math.tan(b.tilt*Math.PI/180);assert(Math.abs(lean-expected)<=1,'tilt '+b.tilt);if(b.tilt>3)assert(lean>0,'leans towards the centre');
  for(const beam of [inner,outer]){const set=new Set(beam.map(c=>c.x+','+c.y));for(const c of beam)if(c.y>base)assert(set.has(c.x+','+(c.y-1))||[...set].some(k=>k===`${c.x-1},${c.y}`&&set.has(`${c.x-1},${c.y-1}`))||[...set].some(k=>k===`${c.x+1},${c.y}`&&set.has(`${c.x+1},${c.y-1}`)),'beam blocks stay face-connected');}
 }
 if(beams.linked){const left=new Set([...g['left-inner'],...g['left-outer']].map(c=>`${2*mid-1-c.x},${c.y}`));assert.deepEqual([...g['right-inner'],...g['right-outer']].map(c=>`${c.x},${c.y}`).sort(),[...left].sort(),'shared settings mirror the two sides');}
}
// Position moves a pair inwards; a steep one-block beam stays connected; inputs outside the limits are clamped.
const at=position=>Math.min(...bridgeBeams(lc,{left:{...d.beams.left,position},right:d.beams.right}).filter(e=>e.beam==='left-outer').map(e=>e.x));assert.equal(at(5)-at(0),5,'position moves the pair');
const steep=pairCells({height:16,thickness:1,tilt:45,spacing:2,position:0}).filter(c=>c.beam===0),cells=new Set(steep.map(c=>c.u+','+c.r));for(const c of steep)if(c.r>0)assert(cells.has(c.u+','+(c.r-1))||cells.has((c.u-1)+','+c.r)&&cells.has((c.u-1)+','+(c.r-1)),'steep thin beam connected');
assert.equal(new Set(pairCells({height:500,thickness:0,tilt:90,spacing:-3,position:0}).map(c=>c.r)).size,bridgeBeamLimits.height[1],'clamped to limits');
// Saved state validates and rejects bad values.
const saved={lower:d.lower,upper:d.upper,beams:d.beams,locks:{lower:false,upper:true},onlyBlocks:false,display:{reference:true,grid:true,handles:true},mono:false,mode3d:true,depth:10,part:'upper',zoom:1.5,pan:[2,-3],camera:{yaw:.4,pitch:.3,zoom:1.2,offset:[0,0]}};
assert.deepEqual(validateBridge1State(structuredClone(saved)),saved);
for(const edit of [s=>s.beams.left.tilt=60,s=>s.beams.right.thickness=1.5,s=>s.upper.mirrored='yes',s=>s.part='deck',s=>s.upper.level=1e6,s=>delete s.beams.right])assert.throws(()=>{const bad=structuredClone(saved);edit(bad);validateBridge1State(bad);});
console.log('Bridge 1: Curves-tab lower curve, mirrored then independent upper curve, four parallel inward-leaning beams and saved state passed.');
