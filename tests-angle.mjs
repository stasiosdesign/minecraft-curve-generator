import assert from 'node:assert/strict';
import {createAngleRoof,angleBeamDefaults,angleBeamRanges,beamPairs,beamLimits,beamEnd,angleForEnd,beamRun,sideProfile,hipProfile} from './dist/angle-roof.js';
import {createFrame} from './dist/frame.js';
import {houseAngleBeamDefaults,houseAngleBeamRanges} from './dist/blueprint.js';
import {occupiedVoxels,forEachVoxel} from './dist/layout.js';
assert.deepEqual(houseAngleBeamDefaults,angleBeamDefaults,'saved-design defaults match the beam defaults');
assert.deepEqual(Object.fromEntries(Object.entries(houseAngleBeamRanges).map(([k,[lo,hi]])=>[k,[lo,hi]])),Object.fromEntries(Object.entries(angleBeamRanges).map(([k,[lo,hi]])=>[k,[lo,hi]])),'saved-design ranges match');
const e=20,m=createAngleRoof({elevation:e}),id=b=>`${b.x},${b.y},${b.z}`,sig=b=>`${id(b)},${b.group},${b.type}`;
// Clean framework: exactly the shared columns, perimeter beam, pathway and stair ring; no curved roof or gables.
assert.deepEqual(m.blocks.filter(b=>b.layer==='structure').map(sig).sort(),createFrame({elevation:e}).blocks.map(sig).sort(),'framework identical to the column structure');
assert.deepEqual([...new Set(m.blocks.map(b=>b.group))].sort(),['beam','center','inner','inner-beams','outer','outer-beams','path','steps']);
assert.equal(new Set(m.blocks.map(id)).size,m.blocks.length,'no block is placed twice');
// Outer set: 8 side beams plus the 4 corner beams. Inner square: its 8 side beams only, no corner beams.
const outerPairs=beamPairs('toOuter',m),innerPairs=beamPairs('toInner',m);
assert.equal(outerPairs.length,12);assert.equal(outerPairs.filter(p=>p.corner).length,4);
assert.equal(innerPairs.length,8);assert(innerPairs.every(p=>!p.corner&&!p.wing.includes('-')),'no corner beams in the inner square');
assert(m.blocks.filter(b=>b.group==='inner-beams').every(b=>b.beam==='side'),'inner beams are side beams only');
assert.equal(new Set(m.blocks.filter(b=>b.group==='outer-beams'&&b.beam==='corner').map(b=>b.wing)).size,4,'four outer corner beams');
for(const p of [...outerPairs,...innerPairs]){const key=outerPairs.includes(p)?'toOuter':'toInner',dx=Math.abs(p.to.x-p.from.x),dz=Math.abs(p.to.z-p.from.z),run=beamRun(key);assert(p.corner?dx===run&&dz===run:(dx===run&&dz===0)||(dx===0&&dz===run));}
// Smooth beams: blocks, slabs and stairs both ways up, not a staircase of cubes.
const types=group=>new Set(m.blocks.filter(b=>b.group===group).map(b=>b.type+(b.flip?'~':'')));
assert(types('outer-beams').has('slab')&&types('outer-beams').has('slab~'),'default beams use top and bottom slabs');
// The angle is not capped by the columns: 60 degrees on 8-high outer columns rises above them.
const steep=createAngleRoof({elevation:e,beams:{toOuter:{start:4,angle:60}}});assert.equal(steep.beams.toOuter.angle,60);
assert(beamEnd('toOuter',steep.beams.toOuter,steep)>steep.outerHeight,'end above the outer columns');
assert(Math.max(...steep.blocks.filter(b=>b.group==='outer-beams').map(b=>b.y))>=e+steep.outerHeight,'beam continues above the column tops');
assert.equal(createAngleRoof({elevation:e,beams:{toOuter:{angle:120}}}).beams.toOuter.angle,80,'angle range 0-80');
assert.equal(createAngleRoof({elevation:e,innerHeight:3,beams:{toOuter:{start:9}}}).beams.toOuter.start,3,'start stays on its column');
for(const [deg,start]of [[0,4],[26.6,4],[63.4,2]])assert(Math.abs(angleForEnd('toOuter',start,beamEnd('toOuter',{start,angle:deg},m),m)-deg)<.06,'end and angle agree');
assert.equal(+beamEnd('toOuter',angleBeamDefaults.toOuter,m).toFixed(1),7);assert.equal(+beamEnd('toInner',angleBeamDefaults.toInner,m).toFixed(1),11,'defaults reach outer block 7 and inner block 11');
// Profile quality across angles, thicknesses and extensions. In each half-block column the beam is one solid interval
// that follows the ideal band (centre line at the chosen height phase, constant thickness across the beam).
const halfColumns=pieces=>{const cols=new Map();for(const b of pieces){const m={block:[1,1,1,1],slab:[1,1,0,0],right:[1,1,0,1],left:[1,1,1,0]}[b.type];for(let yy=0;yy<2;yy++)for(let s=0;s<2;s++)if(m[(b.flip?1-yy:yy)*2+s]){const h=2*b.x+s;if(!cols.has(h))cols.set(h,[]);cols.get(h).push(b.y+yy/2);}}return cols;};
let worst=0,sum=0,count=0;
for(const angle of [0,4,12,20,26.6,33.7,45,55,63.4,75])for(const thickness of [.5,1,1.5,2.5])for(const [extendStart,extendEnd]of [[0,0],[2,3]]){
 const slope=Math.tan(angle*Math.PI/180),p=sideProfile({run:6,y0:3.5,slope,thickness,extendStart,extendEnd}),half=thickness/2*Math.hypot(1,slope);
 assert.equal(p.gaps,0,'every column meets the next face to face');assert(Math.abs(p.phase)<=.5,'line moves at most half a block');
 const cols=halfColumns(p.blocks);assert.equal(cols.size,2*(p.u1-p.u0),'covers the whole length, extensions included');
 for(const [h,ys]of cols){ys.sort((a,b)=>a-b);for(let i=1;i<ys.length;i++)assert.equal(ys[i]-ys[i-1],.5,'one solid interval per half column');
  const u=(h+.5)/2,lo=ys[0],hi=ys.at(-1)+.5,c=p.centre(u),err=Math.max(Math.abs(lo-(c-half)),Math.abs(hi-(c+half)));
  // Steep beams have near-vertical edges; their error is measured across the beam, not up the column.
  const across=err/Math.hypot(1,slope);worst=Math.max(worst,across);sum+=across;count++;assert(across<=.85,`band follows the line: ${angle} deg, t ${thickness}, off ${across.toFixed(2)}`);}
 if(angle===45&&thickness===1&&!extendStart)assert(p.blocks.every(b=>b.type==='left'||b.type==='right'),'a 45-degree beam is one clean run of stairs');
}
assert(sum/count<.3,'mean deviation across the beam: '+(sum/count).toFixed(3));
// Corner beams: one cell per half step along the diagonal, each face-connected to the next, built only from pieces
// symmetric about the diagonal, following the same band.
for(const angle of [0,10,26.6,45,60,75])for(const thickness of [.5,1,2])for(const [extendStart,extendEnd]of [[0,0],[1,2]]){
 const rise=6*Math.tan(angle*Math.PI/180),slope=rise/(6*Math.SQRT2),h=hipProfile({steps:6,y0:3.5,slope,thickness,extendStart,extendEnd}),half=thickness/2*Math.hypot(1,slope);
 assert.equal(h.cells.length,2*(h.k1-h.k0)+1,'every half step along the diagonal');
 for(let i=0;i<h.cells.length;i++){const c=h.cells[i];assert(c.rows.every(r=>['block','slab','outer','corner'].includes(r.type)),'symmetric pieces only');
  for(const [s,[b,t]]of c.slots.entries()){const d=(c.k+(s-1)*.25)*Math.SQRT2,ctr=h.centre(d);assert(Math.max(Math.abs(b-(ctr-half)),Math.abs(t-(ctr+half)))/Math.hypot(1,slope)<=.9,`corner follows the line: ${angle} deg t ${thickness}`);}
  if(i){const a=h.cells[i-1].slots[2],b=c.slots[0];assert(Math.min(a[1],b[1])-Math.max(a[0],b[0])>=.5,'consecutive cells overlap by half a block');}}
}
// Whole roofs: corner cells face-connected in plan; beams avoid the structure; mirror symmetry left/right and front/back.
const mirrorX=v=>{const [x,y,z]=v.split(',').map(Number);return `${49-x},${y},${z}`},mirrorZ=v=>{const [x,y,z]=v.split(',').map(Number);return `${x},${y},${49-z}`};
let seed=11;const rand=n=>{seed=(seed*16807)%2147483647;return seed%n;};let totalMs=0;
for(let i=0;i<40;i++){
 const p={elevation:e,outerHeight:1+rand(20),innerHeight:1+rand(20),centerHeight:1+rand(20),centerLift:rand(8),beamLevel:1+rand(8),beams:{toOuter:{start:1+rand(10),angle:rand(81),thickness:.5+.25*rand(9),extendStart:rand(3),extendEnd:rand(4)},toInner:{start:1+rand(10),angle:rand(81),thickness:.5+.25*rand(9),extendStart:rand(3),extendEnd:rand(4)}}};
 const t0=performance.now(),r=createAngleRoof(p);totalMs+=performance.now()-t0;
 const structure=new Set(r.blocks.filter(b=>b.layer==='structure').map(id)),beams=r.blocks.filter(b=>b.group.endsWith('-beams'));
 assert(beams.every(b=>!structure.has(id(b))),'beams never overwrite columns');assert(beams.every(b=>[b.x,b.y,b.z].every(Number.isInteger)));
 assert(beams.some(b=>b.group==='outer-beams')&&beams.some(b=>b.group==='inner-beams'),'both sets built');
 for(const group of ['outer-beams','inner-beams']){const v=occupiedVoxels(beams.filter(b=>b.group===group));for(const key of v.keys()){assert(v.has(mirrorX(key)),group+' mirror left/right');assert(v.has(mirrorZ(key)),group+' mirror front/back');}}
 // The corner beam's path in plan (from its own profile, before the structure claims any cells) steps one face at a time.
 const path=r.profiles['toOuter:hip'].cells.map(({k})=>Number.isInteger(k)?[6-k,6-k]:[6-Math.ceil(k),6-Math.floor(k)]);
 for(let j=1;j<path.length;j++)assert.equal(Math.abs(path[j][0]-path[j-1][0])+Math.abs(path[j][1]-path[j-1][1]),1,'corner cells step one face at a time');
 assert.deepEqual(r.blocks.filter(b=>b.layer==='structure').map(sig).sort(),createFrame(p).blocks.map(sig).sort(),'beams never change the framework');
 assert(Number.isFinite(r.minY)&&r.maxY>r.minY);
}
assert(totalMs/40<400,'build time per roof: '+(totalMs/40).toFixed(0)+' ms');
// Outer corner stairs voxelise as a full bottom plus one raised quarter (and upside down when flipped).
const outerStair=[];forEachVoxel({x:0,y:0,z:0,type:'outer',hiX:1,hiZ:0},(...v)=>outerStair.push(v.join()));assert.deepEqual(outerStair.sort(),['0,0,0','0,0,1','1,0,0','1,0,1','1,1,0'].sort());
const flipped=[];forEachVoxel({x:0,y:0,z:0,type:'outer',hiX:0,hiZ:1,flip:true},(...v)=>flipped.push(v.join()));assert.deepEqual(flipped.sort(),['0,0,1','0,1,0','0,1,1','1,1,0','1,1,1'].sort());
console.log(`Angle Roof: 12 outer and 8 inner beams, no inner corners, uncapped angles, smooth stair/slab profiles (worst ${worst.toFixed(2)}, mean ${(sum/count).toFixed(2)} blocks off the line), clean corners, extensions, symmetry and stability passed (${(totalMs/40).toFixed(0)} ms per roof).`);
