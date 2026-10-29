import assert from 'node:assert/strict';
import {createRavine,ravineGap,ravineEdges} from './dist/ravine.js';
const r=createRavine();assert(r.maxY>=50&&r.maxY<=58);assert.equal(r.maxZ,36);assert.equal(ravineGap(0),37);assert.equal(ravineGap(49),78);
const cells=new Set(r.blocks.map(b=>`${b.x},${b.y},${b.z}`));assert.equal(cells.size,r.blocks.length);
for(let z=0;z<36;z++)for(const y of [0,49]){const [left,right]=ravineEdges(y,z);assert.equal(right-left,y===0?37:78);assert(cells.has(`${left-1},${y},${z}`));assert(cells.has(`${right},${y},${z}`));if(y>0)for(let x=left;x<right;x++)assert(!cells.has(`${x},${y},${z}`));}
assert.equal(r.blocks.filter(b=>b.group==='water').length,37*36);assert(r.mesh.length<40000);assert(r.blocks.every(b=>[b.x,b.y,b.z].every(Number.isInteger)));
const materials=new Set(r.blocks.map(b=>b.group));for(const name of ['grass','soil','gravel','rock-dark','rock-light'])assert(materials.has(name));
const ridgeHeights=new Set();for(let z=0;z<36;z++)ridgeHeights.add(Math.max(...r.blocks.filter(b=>b.z===z).map(b=>b.y)));assert(ridgeHeights.size>=3,'irregular summit heights');
assert(new Set(Array.from({length:36},(_,z)=>ravineEdges(25,z).join(','))).size>10,'organic cliff relief');
for(const f of r.mesh){assert.equal(f.pts.length,4);assert(f.pts.flat().every(Number.isInteger));assert(r.blocks[f.id]);}
assert.deepEqual(createRavine().dimensions,r.dimensions);
console.log(`Ravine exact 37/78 openings, irregular peaks/ledges, materials, river and ${r.mesh.length} exposed faces passed.`);
