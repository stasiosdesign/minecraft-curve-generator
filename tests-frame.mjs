import assert from 'node:assert/strict';
import {createFrame} from './dist/frame.js';
import {frameCurve,frameCurveDefaults} from './dist/frame-curve.js';
import {occupiedVoxels} from './dist/layout.js';
import {roofMesh} from './dist/view3d.js';
const base=createFrame();assert.equal(base.maxX,21);assert.equal(base.maxZ,21);assert.equal(base.inner.length,12);assert.equal(base.outer.length,16);assert.equal(base.center.length,4);
for(const [x,z]of base.center){assert([8,12].includes(x)&&[8,12].includes(z));assert(base.inner.some(([a,b])=>a===4&&b===z));assert(base.inner.some(([a,b])=>a===x&&b===4));}
const keys=new Set(base.blocks.map(b=>[b.x,b.y,b.z].join(',')));
for(let x=0;x<21;x++)for(let z=0;z<21;z++)if(x<=4||x>=16||z<=4||z>=16)assert(keys.has(`${x},20,${z}`),'continuous deck');
for(let x=8;x<=12;x++)for(let z=8;z<=12;z++)assert(keys.has(`${x},39,${z}`),'centre platform cap');
for(const params of [frameCurveDefaults,{...frameCurveDefaults,run:15,middle:6,end:-7,bend:70},{...frameCurveDefaults,run:5,middle:0,end:0,thickness:1}]){
 const {c,roof}=frameCurve(params);assert.equal(c.fn(0),params.thickness);assert.deepEqual(roof.columns[0],{high:[params.thickness,params.thickness],low:[0,0]});
 const m=createFrame({roof}),unique=new Set(m.blocks.map(b=>[b.x,b.y,b.z].join(',')));assert.equal(unique.size,m.blocks.length);
 const voxels=occupiedVoxels(m.blocks);for(const key of voxels.keys()){const [x,y,z]=key.split(',').map(Number);assert(voxels.has(`${41-z},${y},${x}`),'quarter-turn symmetry including stair geometry');}
 for(const b of m.blocks)assert([b.x,b.y,b.z].every(Number.isInteger));
 for(const [x,z]of [[12,10],[8,10],[10,12],[10,8]]){assert(unique.has(`${x},${m.surfaceY},${z}`));assert(unique.has(`${x},${m.surfaceY-1},${z}`));}
 // Every half-cell of an individual wing is connected to its anchored first column.
 const wingVoxels=occupiedVoxels(m.blocks.filter(b=>b.group==='curves'&&b.wing==='east')),seen=new Set(),queue=[wingVoxels.keys().next().value];while(queue.length){const key=queue.pop();if(seen.has(key)||!wingVoxels.has(key))continue;seen.add(key);const p=key.split(',').map(Number);for(let a=0;a<3;a++)for(const d of [-1,1]){const q=[...p];q[a]+=d;queue.push(q.join(','));}}assert.equal(seen.size,wingVoxels.size);
 assert(roofMesh(m.blocks,21,true).length>0);
 const moved=createFrame({roof,centerHeight:27,elevation:8});assert.equal(moved.surfaceY,35);assert(moved.blocks.some(b=>b.group==='curves'&&b.x===12&&b.z===10&&b.y===35));
}
console.log('21/13/5 dimensions, exact pillar alignment, filled deck, platform attachment, connected wings, legal blocks and four-way voxel symmetry passed.');
