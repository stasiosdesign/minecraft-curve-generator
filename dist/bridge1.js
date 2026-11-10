import {curve} from './curves.js';
import {curveDefaults} from './curve-editor.js';
// Bridge 1: a lower curve, an upper curve and four tilted side beams, drawn in one elevation.
// Both curves use the Curves tab's curve maths and block solver unchanged; this module only places them.
// Bridge frame: x = 0 is the centre line, y as in the curve maths (the lower curve is not moved vertically).
export const bridgeGap=6;
export const bridgeBeamDefaults={height:30,thickness:2,tilt:8,spacing:3,position:-2};
export const bridgeBeamLimits={height:[1,96,1],thickness:[1,8,1],tilt:[0,45,1],spacing:[1,24,1],position:[-24,48,1]};
// Grid width of a solved curve (the solver uses ceil(w) columns) and its shift onto the centre line.
export const gridWidth=c=>Math.ceil(c.w-1e-9);
export const centreShift=c=>-Math.floor(gridWidth(c)/2);
// The upper curve starts as a copy of the lower curve's settings, turned upside down and lifted so that it mirrors
// the lower curve across a horizontal line `gap` blocks above its crown. After that it has its own settings.
export function upperFromLower(lower,gap=bridgeGap){const c=curve(lower);return {params:{...lower},level:Math.round(2*c.h+gap-4),mirrored:true};}
// Upper curve placement. `level` is where its baseline (the curve's end height of 4) sits.
export const upperY=(y,{level,mirrored})=>mirrored?level+4-y:y+level-4;
export function placeUpper(blocks,{level,mirrored}){return blocks.map(e=>mirrored?{...e,y:level+3-e.y,flip:e.type==='block'?false:!e.flip}:{...e,y:e.y+level-4});}
// Defaults: lower = Curves tab defaults; upper = its mirror; beam pairs reach the upper curve's ends.
export function bridgeDefaults(lower={...curveDefaults}){const side={...bridgeBeamDefaults};return {lower:{...lower},upper:upperFromLower(lower),beams:{linked:true,left:{...side},right:{...side}}};}
// Beams stand on the lowest point of the lower curve's underside.
export const beamBase=c=>Math.floor(c.min+1e-9);
const clampBeam=b=>Object.fromEntries(Object.entries(bridgeBeamLimits).map(([k,[lo,hi]])=>[k,Math.max(lo,Math.min(hi,Math.round(Number(b?.[k]??bridgeBeamDefaults[k]))))]));
// One side's pair, in a frame measured inward from the curve end: u = 0 is the first column inside the curve.
// Both beams share one rasterisation (whole-block steps of the same tilt), so they are exactly parallel.
export function pairCells(beam){
 const b=clampBeam(beam),pitch=b.thickness+b.spacing,slope=Math.tan(b.tilt*Math.PI/180),out=[];
 const starts=Array.from({length:b.height},(_,r)=>Math.round(b.position-pitch/2-b.thickness/2+r*slope));
 for(const [index,offset]of [[0,0],[1,pitch]])for(let r=0;r<b.height;r++){
  // A one-block-thick beam that steps sideways keeps a shared face by widening the row below the step.
  const from=starts[r],to=Math.max(from+b.thickness,(starts[r+1]??from)+1);
  for(let u=from;u<to;u++)out.push({u:u+offset,r,beam:index});
 }
 return out;
}
// Four beams: two per side, mirrored about the lower curve's centre when both sides use the same settings.
export function bridgeBeams(lowerCurve,{left,right}){
 const W=gridWidth(lowerCurve),s=centreShift(lowerCurve),base=beamBase(lowerCurve),out=[];
 for(const [side,beam]of [['left',left],['right',right]])for(const {u,r,beam:i}of pairCells(beam)){
  const x=side==='left'?s+u:s+W-1-u;
  out.push({x,y:base+r,type:'block',part:'beam',group:'beam',beam:`${side}-${i?'inner':'outer'}`,side});
 }
 return out;
}
// The whole elevation. Solved block lists may be null while a curve is still being fitted.
export function bridgeModel({lower,upper,beams,lowerRoof=null,upperRoof=null}){
 const lc=curve(lower),uc=curve(upper.params),ls=centreShift(lc),us=centreShift(uc);
 const lowerBlocks=(lowerRoof?.blocks??[]).map(e=>({...e,x:e.x+ls,part:'lower'}));
 const upperBlocks=placeUpper(upperRoof?.blocks??[],upper).map(e=>({...e,x:e.x+us,part:'upper'}));
 const beamBlocks=bridgeBeams(lc,beams),elements=[...lowerBlocks,...beamBlocks,...upperBlocks].map(e=>({...e,layer:e.part}));
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(const e of elements){minX=Math.min(minX,e.x);maxX=Math.max(maxX,e.x+1);minY=Math.min(minY,e.y);maxY=Math.max(maxY,e.y+1);}
 return {elements,lowerCurve:lc,upperCurve:uc,lowerShift:ls,upperShift:us,base:beamBase(lc),bounds:{minX,maxX,minY,maxY}};
}
