import assert from 'node:assert/strict';
import {createFrame} from './dist/frame.js';
import {roofMesh} from './dist/view3d.js';
for(const settings of [{},{innerHeight:1,outerHeight:1,elevation:0},{innerHeight:22,outerHeight:10,elevation:35}]){
 const m=createFrame(settings),keys=new Set(m.blocks.map(b=>[b.x,b.y,b.z].join(',')));
 assert.equal(keys.size,m.blocks.length);assert.equal(m.inner.length,12);assert.equal(m.outer.length,16);
 assert.equal(m.blocks.length,84+52+12*(m.innerHeight-1)+16*(m.outerHeight-1));
 for(const b of m.blocks){assert([b.x,b.y,b.z].every(Number.isInteger));assert(b.x>=0&&b.x<22&&b.z>=0&&b.z<22);assert(b.y>=m.elevation);assert(keys.has([21-b.x,b.y,b.z].join(',')));assert(keys.has([b.x,b.y,21-b.z].join(',')));}
 for(const [points,height]of [[m.inner,m.innerHeight],[m.outer,m.outerHeight]])for(const [x,z]of points){assert.equal(m.blocks.filter(b=>b.x===x&&b.z===z).length,height);assert(keys.has([x,m.elevation+height-1,z].join(',')));}
 for(const [x,z]of m.inner){if(x===4)assert(m.outer.some(([a,b])=>a===0&&b===z));if(x===17)assert(m.outer.some(([a,b])=>a===21&&b===z));if(z===4)assert(m.outer.some(([a,b])=>a===x&&b===0));if(z===17)assert(m.outer.some(([a,b])=>a===x&&b===21));}
 assert(roofMesh(m.blocks,22,true).length>0);
}
console.log('Frame dimensions, fifth-block inset, counts, heights, elevation, opposite pillars, symmetry and mesh passed.');
