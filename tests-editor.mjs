import assert from 'node:assert/strict';
import {curve} from './dist/curves.js';
import {curveDefaults,curveSpecs,editCurveHandle,changeCurveType,toggleExtraPoint} from './dist/curve-editor.js';
import {frameCurve,frameReference,frameCurveDefaults} from './dist/frame-curve.js';
import {solve} from './dist/optimizer.js';
for(const type of ['circle','ellipse','custom']){
 const p={...curveDefaults,type,width:18,radius:12,height:7},c=curve(p),h=frameReference(p);
 for(let i=0;i<c.points.length;i++)assert(Math.abs((c.points[i][1]-c.handles[0][1]+p.thickness)-h.points[i][1])<1e-8);
 assert.equal(h.handles[0][0],0);assert(Math.abs(h.handles[0][1]-p.thickness)<1e-8);
 for(const index of [1,2]){const free=editCurveHandle(p,index,2,3),anchored=editCurveHandle(p,index,2,3,{lockStart:true});const a=curve(free),b=frameReference(anchored);assert.equal(a.span,b.span);for(let i=0;i<a.points.length;i++)assert(Math.abs(a.points[i][1]-a.handles[0][1]+p.thickness-b.points[i][1])<1e-7);}
 assert.deepEqual(editCurveHandle(p,0,8,8,{lockStart:true}),p);
 const withPoint=toggleExtraPoint(p),q=editCurveHandle(withPoint,3,-1,5),extra=curve(q);assert.equal(extra.handles.length,4);
 for(const [x,y]of extra.handles)assert(Math.abs(extra.fn(x)-y)<1e-9);
 assert(Math.abs(extra.fn(extra.w*q.extraPosition/100)-q.extraHeight)<1e-8);
 for(const index of [1,3]){const x=extra.handles[index][0],e=1e-5;assert(Math.abs((extra.fn(x+e)-extra.fn(x))/e-(extra.fn(x)-extra.fn(x-e))/e)<.01,'continuous tangent');}
 assert.equal(curve(toggleExtraPoint(q)).handles.length,3);assert(Number.isFinite(solve(extra).rms));assert(frameCurve({...q,onlyBlocks:false}).roof.blocks.length>0);
}
for(const extraPosition of [5,49,50,51,95]){const c=curve({...frameCurveDefaults,extraEnabled:true,extraPosition,extraHeight:10});assert(c.points.every(p=>p.every(Number.isFinite)));}
assert.deepEqual(Object.keys(curveSpecs),['circle','ellipse','custom']);
console.log('Shared editor parity, fixed anchor, three curve types, fourth point interpolation/tangents, removal and solver checks passed.');
