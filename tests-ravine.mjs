import assert from 'node:assert/strict';
import {createRavine,ravineGap} from './dist/ravine.js';
const r=createRavine();assert.equal(r.maxY,50);assert.equal(r.maxZ,20);assert.equal(ravineGap(0),26);assert.equal(ravineGap(49),50);
const cells=new Set(r.blocks.map(b=>`${b.x},${b.y},${b.z}`));assert.equal(cells.size,r.blocks.length);
for(const y of [0,24,49]){const half=ravineGap(y)/2;assert(cells.has(`${half},${y},10`));assert(cells.has(`${-half-1},${y},10`));if(y>0)for(let x=-half;x<half;x++)assert(!cells.has(`${x},${y},10`));}
assert.equal(r.blocks.filter(b=>b.group==='water').length,26*20);assert(r.mesh.length<15000);assert(r.blocks.every(b=>[b.x,b.y,b.z].every(Number.isInteger)));
for(const f of r.mesh){assert.equal(f.pts.length,4);assert(f.pts.flat().every(Number.isInteger));assert(r.blocks[f.id]);}
console.log('Ravine height, gaps, compact depth, river and integer face mesh passed.');
