import assert from 'node:assert/strict';
import {createFrame} from './dist/frame.js';
import {frameCurve,frameCurveDefaults} from './dist/frame-curve.js';
import {occupiedVoxels} from './dist/layout.js';
import {roofMesh} from './dist/view3d.js';
const base=createFrame();assert.equal(base.maxX,21);assert.equal(base.innerHeight,9);assert.equal(base.outerHeight,5);assert.equal(base.centerHeight,11);assert.equal(base.center.length,4);
const keys=new Set(base.blocks.map(b=>[b.x,b.y,b.z].join(',')));for(let x=0;x<21;x++)for(let z=0;z<21;z++)if(x<=4||x>=16||z<=4||z>=16)assert(keys.has(`${x},20,${z}`));
const def=frameCurve(frameCurveDefaults);assert.equal(def.roof.gaps,0);assert(def.c.fn(4.5)<(def.c.fn(0)+def.c.fn(9))/2,'default convex');
for(const thickness of [1,2,4])for(const edit of [{},{middle:-3,end:-14},{middle:12,end:-12,bend:70,run:6}]){
 const p={...frameCurveDefaults,...edit,thickness},r=frameCurve(p).roof;
 for(const col of r.columns){assert(Math.max(...col.high)-Math.min(...col.low)<=thickness+1e-9,'never exceed requested vertical thickness');}
 assert.equal(r.columns[0].low[0],0,'start anchored without flat footing');
 for(const width of [1,5,6,9]){
  const model=createFrame({roof:r,curveWidth:width}),wings=model.blocks.filter(b=>b.group==='curves');assert.equal(wings.length,r.blocks.length*width*4,'retain every source element');
  assert(wings.every(b=>!(b.x>=8&&b.x<=12&&b.z>=8&&b.z<=12)),'full 5x5 roof opening');
  assert(wings.every(b=>[b.x,b.y,b.z].every(Number.isInteger)));
  const voxels=occupiedVoxels(wings);for(const key of voxels.keys()){const [x,y,z]=key.split(',').map(Number);assert(voxels.has(`${41-z},${y},${x}`),'four-way geometry symmetry');}
  const changed=createFrame({roof:r,curveWidth:width,innerHeight:40,outerHeight:40});assert.deepEqual(changed.blocks.filter(b=>b.group==='curves'),wings,'structure must not modify roof');
 }
}
// Independently meshed layers preserve surfaces even when they occupy the same cell.
const b={x:0,y:0,z:0,type:'block',axis:'x'};assert.equal(roofMesh([{...b,layer:'structure'},{...b,type:'slab',layer:'roof'}],1,true).length,12);
console.log('Defaults, convex profile, hard thickness limits, independent geometry, adjustable widths, 5x5 opening and four-way symmetry passed.');
