import assert from 'node:assert/strict';
import {curve} from './dist/curves.js';
import {solve} from './dist/optimizer.js';
import {placeRoof} from './dist/layout.js';
for(const width of [6,32,96])for(const bend of [10,25,50,75,90]){
 const c=curve({type:'custom',width,bend,left:4,middle:16,right:4,thickness:2}),x=width*bend/100;
 assert(Math.abs(c.fn(x)-16)<1e-9);assert.equal(c.fn(0),4);assert(Math.abs(c.fn(width)-4)<1e-9);
 assert(Math.abs(c.handles[1][0]-x)<1e-9);
 for(const [,y] of c.points)assert(y>=4-1e-9&&y<=16+1e-9);
 const e=width*1e-6;assert(Math.abs((c.fn(x+e)-c.fn(x))/e-(c.fn(x)-c.fn(x-e))/e)<.01);
 const mirror=curve({type:'custom',width,bend:100-bend,left:4,middle:16,right:4});
 for(const [xx,y] of c.points)assert(Math.abs(y-mirror.fn(width-xx))<1e-9);
 for(const layout of ['straight','diagonal','hip']){const roof=solve(c,{diagonal:layout==='diagonal'});assert(Number.isFinite(roof.rms));const model=placeRoof(roof,2,layout,c.w);assert(model.blocks.length>0);for(const b of model.blocks)assert([b.x,b.y,b.z].every(Number.isInteger));}
}
console.log('Movable bend: endpoints, handle interpolation, smoothness, bounds, symmetry and all roof layouts passed.');

