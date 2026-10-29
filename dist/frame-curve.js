import {curve} from './curves.js';
import {solve} from './optimizer.js';
export const frameCurveDefaults={type:'custom',radius:20,extent:120,width:9,height:12,left:0,middle:-4.5,right:-6,bend:50,thickness:2,extraEnabled:false,extraPosition:75,extraHeight:-5.5};
export function frameReference(p){
 const raw=curve(p),offset=raw.offset??0,span=raw.span??raw.w,shift=p.thickness-raw.fn(offset),fn=x=>raw.fn(x+offset)+shift;
 const points=raw.points.map(([x,y])=>[x-offset,y+shift]),inner=points.map(([x,y])=>[x,y-p.thickness]);
 return {...raw,w:span,span,offset:0,fn,points,inner,h:Math.max(...points.map(p=>p[1])),min:Math.min(...inner.map(p=>p[1])),handles:raw.handles.map(([x,y])=>[x-offset,y+shift])};
}
export function frameCurve(p){const c=frameReference(p);return {c,roof:solve(c,{maxThickness:p.thickness,startLow:0,allowGaps:true,onlyBlocks:!!p.onlyBlocks})};}
