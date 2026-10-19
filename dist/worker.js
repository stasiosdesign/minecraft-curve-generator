import {curve} from './curves.js';import {solve} from './optimizer.js';
self.onmessage=({data:p})=>{try{const c=curve(p),roof=solve(c,{onlyBlocks:p.onlyBlocks,diagonal:p.layout==='diagonal'});self.postMessage({c:{w:c.w,h:c.h,min:c.min,points:c.points,inner:c.inner,handles:c.handles},roof});}catch(e){self.postMessage({error:e.message});}};
