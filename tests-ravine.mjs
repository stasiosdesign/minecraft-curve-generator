import assert from 'node:assert/strict';
import {createRavine,ravineGap,ravineEdges,greedyMesh} from './dist/ravine.js';
const started=performance.now(),r=createRavine(),buildMs=performance.now()-started,at=r.materialAt;
assert(r.maxY>=50&&r.maxY<=58);assert.equal(r.maxZ,36);assert.equal(ravineGap(0),37);assert.equal(ravineGap(49),78);
// Exact openings at the river and at the rim, open air in between.
for(let z=0;z<36;z++)for(const y of [0,49]){const [left,right]=ravineEdges(y,z);assert.equal(right-left,y===0?37:78);assert(at(left-1,y,z));assert(at(right,y,z));if(y>0)for(let x=left;x<right;x++)assert(!at(x,y,z));}
assert.equal(r.water,37*36);
// Envelope of the original terrain: flanks about 66-71 blocks out at the river, about 51-53 at the summits.
const extent=y=>{let lo=Infinity,hi=-Infinity;for(let z=0;z<36;z++)for(let x=-80;x<80;x++){const m=at(x,y,z);if(m&&m!=='water'){lo=Math.min(lo,x);hi=Math.max(hi,x);}}return [lo,hi];};
for(const [y,lo,hi]of [[0,-71,71],[20,-66,67],[40,-60,60],[49,-56,56],[57,-53,52]]){const [a,b]=extent(y);assert(Math.abs(a-lo)<=2&&Math.abs(b-hi)<=2,`flank extent at Y ${y}: ${a}..${b}`);}
// Summits per 6-block stretch keep the original heights, left and right.
const peak=(c,side)=>{let top=0;for(let z=c*6;z<c*6+6;z++)for(let x=-80;x<80;x++)if(Math.sign(x||1)===side)for(let y=57;y>top;y--)if(at(x,y,z)){top=y;break;}return top;};
assert.deepEqual([0,1,2,3,4,5].map(c=>peak(c,-1)),[57,57,57,54,57,57],'left summits');assert.deepEqual([0,1,2,3,4,5].map(c=>peak(c,1)),[57,56,54,56,57,57],'right summits');
// Simplified relief: a few broad ledges along the river instead of block-by-block noise.
const ledges=new Set(Array.from({length:36},(_,z)=>ravineEdges(25,z).join(','))).size;assert(ledges>=3&&ledges<=6,'chunky cliff relief: '+ledges);
const materials=new Set();for(let z=0;z<36;z++)for(let y=-1;y<58;y++)for(let x=-75;x<76;x++){const m=at(x,y,z);if(m)materials.add(m);}
for(const name of ['grass','soil','gravel','rock-dark','rock-light','strata','water','riverbed'])assert(materials.has(name),name);
// Far fewer faces than one per exposed block side (the detailed version had about 31,000).
assert(r.mesh.length<2500,'merged faces: '+r.mesh.length);
for(const f of r.mesh){assert.equal(f.pts.length,4);assert(f.pts.flat().every(Number.isInteger));assert(r.materials[f.material]);}
// Merged faces cover exactly the exposed block sides: compare total area with an unmerged mesh.
const area=faces=>faces.reduce((s,f)=>{const [a,,c]=f.pts;return s+[0,1,2].map(i=>Math.abs(c[i]-a[i])).filter(Boolean).reduce((p,q)=>p*q,1);},0);
const unit=r.meshWith(1);assert.equal(unit.every(f=>area([f])===1),true);assert.equal(area(r.mesh),area(unit),'merged area equals exposed block sides');assert(r.meshWith(2).every(f=>area([f])<=4),'fallback faces stay small');
// The greedy mesher on a hand-made shape: an L of three blocks has 14 unit sides, merged into 10 faces (an L needs two per flat side).
const shape=new Set(['0,0,0','1,0,0','0,1,0']),tiny=greedyMesh((x,y,z)=>shape.has(`${x},${y},${z}`)?1:0,[0,0,0],[2,2,1]);assert.equal(area(tiny),14);assert.equal(tiny.length,10);
assert.deepEqual(createRavine().dimensions,r.dimensions);
console.log(`Ravine 37/78 openings, original envelope and summits, materials and ${r.mesh.length} merged faces (${buildMs.toFixed(0)} ms) passed.`);
