import assert from 'node:assert/strict';
import {curve} from './dist/curves.js';
import {solve} from './dist/optimizer.js';
import {placeRoof} from './dist/layout.js';
for(const params of [
 {type:'circle',radius:20,extent:120,thickness:2},
 {type:'ellipse',width:24,height:9,thickness:2},
 {type:'custom',width:20,left:3,middle:12,right:7,thickness:2},
 {type:'custom',width:20,left:3,middle:12,right:19,thickness:2}
]){
 const c=curve(params),roof=solve(c),model=placeRoof(roof,12,'hip',c.w),size=Math.ceil(c.w);
 assert.equal(model.maxX,size,'hip must preserve the full edited width');
 assert.equal(model.maxZ,size,'both wings must preserve the full edited width');
 const signature=elements=>elements.map(e=>[e.y,e.type,!!e.flip].join(':')).sort();
 // Each wing must reproduce EVERY source column, including the formerly
 // discarded right half. At the join only, existing seam capping is allowed.
 for(let i=0;i<size;i++){
  const original=roof.blocks.filter(e=>e.x===i);
  const expected=signature(original.map(e=>i===size-1&&['left','right'].includes(e.type)?{...e,type:'block',flip:false}:e));
  assert.deepEqual(signature(model.blocks.filter(e=>e.x===i&&e.z===size-1)),expected);
  assert.deepEqual(signature(model.blocks.filter(e=>e.z===i&&e.x===size-1)),expected);
 }
 console.log(params.type,`${size} × ${size}: both wings reproduce all profile columns`);
}
console.log('Full-profile hip regression passed.');
