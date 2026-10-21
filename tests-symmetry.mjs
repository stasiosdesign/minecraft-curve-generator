import assert from 'node:assert/strict';
import {curve} from './dist/curves.js';
import {solve} from './dist/optimizer.js';
for(const layout of ['straight','diagonal','hip'])for(const input of [
 {type:'circle',radius:3,extent:120},{type:'circle',radius:32,extent:145},
 {type:'ellipse',width:35,height:12},{type:'ellipse',width:34.5,height:7},
 {type:'custom',width:34.64,left:4,middle:-9,right:4,bend:50},
 {type:'custom',width:35,left:4,middle:18,right:4,bend:50}
])for(const onlyBlocks of [false,true]){
 const c=curve({...input,layout,thickness:2}),r=solve(c,{diagonal:layout==='diagonal',onlyBlocks}),n=r.columns.length;
 for(let x=0;x<n;x++)for(const side of ['high','low'])assert.deepEqual(r.columns[x][side],[...r.columns[n-1-x][side]].reverse());
 const key=b=>[b.x,b.y,b.type,!!b.flip].join(','),blocks=new Set(r.blocks.map(key));
 for(const b of r.blocks)assert(blocks.has(key({...b,x:n-1-b.x,type:b.type==='left'?'right':b.type==='right'?'left':b.type})));
 for(let x=1;x<n;x++)assert(Math.min(r.columns[x-1].high[1],r.columns[x].high[0])-Math.max(r.columns[x-1].low[1],r.columns[x].low[0])>=.5);
 assert(Math.abs(c.handles[1][0]-c.w/2)<1e-8);
}
const a=curve({type:'custom',width:32,left:4,right:4,middle:16,bend:30});assert.equal(a.symmetric,false);assert(a.fn(8)!==a.fn(24));
console.log('Exact mirrored elements and surfaces, connected centre joins, odd/even/fractional spans, concave curves and all layouts passed.');
