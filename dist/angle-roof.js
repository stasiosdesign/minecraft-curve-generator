import {createFrame,frameStops} from './frame.js';
import {fitRoof} from './frame-curve.js';
// Angle Roof: the shared column framework (three column rings, perimeter beam, pathway) plus straight beams that rise
// outward from one column ring to the next. Heights are counted in blocks of each column, base block = 1.
//
// A beam is an ideal straight band: its centre line runs from the middle of the start block on the first column, at the
// set angle, across to the second column, with a constant thickness measured across the beam. That band is built from
// Minecraft pieces by two fitters:
// - side beams run along a grid axis and use the stair-roof fitter (blocks, top and bottom slabs, upright and upside-down
//   stairs facing either way), with the top and underside weighted equally: both edges follow the line, the thickness
//   stays constant and the faces stay parallel, so the beam reads as one smooth member at any angle;
// - corner beams run at 45 degrees in plan, so they are built like the hip of a stair roof: one cell per diagonal step,
//   using only pieces that are symmetric about the diagonal (blocks, slabs, inner and outer corner stairs, upright or
//   upside down), chosen by a small dynamic programme that follows both edges of the same ideal band.
// Extensions lengthen the ideal line itself before fitting, so an overhang is the same beam continued, not a piece added on.
export const angleBeamDefaults={toOuter:{start:4,angle:26.6,thickness:1,extendStart:0,extendEnd:0},toInner:{start:6,angle:26.6,thickness:1,extendStart:0,extendEnd:0}};
export const angleBeamRanges={start:[1,64,1],angle:[0,80,.1],thickness:[.5,3,.25],extendStart:[0,12,1],extendEnd:[0,12,1]};
// The outer set keeps its four corner beams; the inner square has side beams only.
export const angleBeamSets={
 toOuter:{from:'inner',to:'outer',group:'outer-beams',corners:true},
 toInner:{from:'center',to:'inner',group:'inner-beams',corners:false}
};
const ringBounds=name=>[frameStops[name][0],frameStops[name][frameStops[name].length-1]];
// Horizontal distance between a column and the one it faces on the next ring (6 and 4 by default).
export const beamRun=key=>Math.abs(ringBounds(angleBeamSets[key].to)[0]-ringBounds(angleBeamSets[key].from)[0]);
function columnsOf(frame){return {outer:{base:0,height:frame.outerHeight},inner:{base:0,height:frame.innerHeight},center:{base:frame.centerLift,height:frame.centerHeight}};}
// Only the start is held by the columns (it must be a block of the first column). The angle is free from 0 to 80 degrees;
// a beam may end above its second column.
export function beamLimits(key,frame){const set=angleBeamSets[key],cols=columnsOf(frame),a=cols[set.from],b=cols[set.to];return {startMax:a.height,offset:a.base-b.base,run:beamRun(key)};}
const round=(v,step)=>Math.round(v/step)*step;
export function normalizeBeam(key,value,frame){
 const v={...angleBeamDefaults[key],...value},out={};
 for(const [k,[lo,hi,step]]of Object.entries(angleBeamRanges)){const n=Number(v[k]);out[k]=+Math.max(lo,Math.min(hi,round(Number.isFinite(n)?n:angleBeamDefaults[key][k],step))).toFixed(2);}
 out.start=Math.min(out.start,beamLimits(key,frame).startMax);return out;
}
export const beamAngle=(key,v)=>v.angle;
// End block on the second column (fractional) for a start and angle, and the angle that reaches a given end.
export function beamEnd(key,{start,angle},frame){const l=beamLimits(key,frame);return start+l.offset+l.run*Math.tan(angle*Math.PI/180);}
export function angleForEnd(key,start,end,frame){const l=beamLimits(key,frame),[lo,hi]=angleBeamRanges.angle;return +Math.max(lo,Math.min(hi,Math.atan2(end-start-l.offset,l.run)*180/Math.PI)).toFixed(1);}
// Column pairs of one beam set: every inner (middle) column meets the column it faces on the other ring. Side columns face
// straight across; the corner columns face the corresponding corner column (outer set only).
export function beamPairs(key,frame){
 const set=angleBeamSets[key],cols=columnsOf(frame),hub='inner',other=set.from===hub?set.to:set.from;
 const [lo,hi]=ringBounds(hub),[tlo,thi]=ringBounds(other),side=v=>v===lo?-1:v===hi?1:0,targets=new Set(frame[other].map(c=>c.join(','))),pairs=[];
 for(const [x,z]of frame[hub]){
  const dx=side(x),dz=side(z),corner=dx!==0&&dz!==0;if(corner&&!set.corners)continue;
  const tx=dx<0?tlo:dx>0?thi:Math.max(tlo,Math.min(thi,x)),tz=dz<0?tlo:dz>0?thi:Math.max(tlo,Math.min(thi,z));
  if(!targets.has(tx+','+tz))continue;
  const hubColumn={x,z,...cols[hub]},otherColumn={x:tx,z:tz,...cols[other]},wing=[dz<0?'north':dz>0?'south':'',dx<0?'west':dx>0?'east':''].filter(Boolean).join('-');
  pairs.push(set.from===hub?{from:hubColumn,to:otherColumn,wing,corner}:{from:otherColumn,to:hubColumn,wing,corner});
 }
 return pairs;
}
// ---- Side beams: the stair-roof fitter on the ideal band ----
// Local frame: u runs along the beam from the first column's near edge (its cell is u 0-1, the second column's is
// u run to run+1); y is the level above the base, centre line through (0.5, y0) with the given slope.
const sideCache=new Map();
// Whole-block changes of height (start block, lift) only move a beam, so shapes are fitted once per fractional height.
export function sideProfile({run,y0,slope,thickness,extendStart=0,extendEnd=0}){
 const lift=Math.floor(y0),shape=sideShape({run,y0:y0-lift,slope,thickness,extendStart,extendEnd});
 return {...shape,blocks:shape.blocks.map(b=>({...b,y:b.y+lift})),centre:u=>shape.centre(u)+lift};
}
function sideShape({run,y0,slope,thickness,extendStart,extendEnd}){
 const key=[run,y0,slope,thickness,extendStart,extendEnd].join();if(sideCache.has(key))return sideCache.get(key);
 const u0=extendStart>0?-extendStart:1,u1=extendEnd>0?run+1+extendEnd:run,lift=thickness/2*Math.hypot(1,slope);
 // How cleanly a line meets the half-block grid depends on its height phase: a 45-degree line through block centres
 // gives stacked blocks and slabs, the same line half a block lower gives one clean run of stairs. The line may move by
 // up to half a block (the band still covers its start block) when that gives a clearly better arrangement; a shift
 // of -1/2 is the same shape as +1/2 one block lower, so four phases cover every quarter-block offset.
 let best=null;
 for(const phase of [0,-.25,.25,-.5]){
  const centre=u=>y0+phase+(u-.5)*slope,fit=fitRoof({fn:x=>centre(u0+x)+lift,w:u1-u0,thickness,startLow:Math.floor(2*centre(u0+.25))/2,bottomWeight:1}),score=fit.cost+.3*Math.abs(phase)*(u1-u0);
  if(!best||score<best.score-1e-9)best={fit,score,centre,phase};
 }
 const {fit,centre,phase}=best,out={u0,u1,blocks:fit.blocks.map(b=>({...b,x:b.x+u0})),gaps:fit.gaps,centre,lift,phase};
 if(sideCache.size>400)sideCache.clear();sideCache.set(key,out);return out;
}
// ---- Corner beams: hip-style diagonal fit ----
// Each diagonal cell has three slots along the beam: L (near quarter), M (the two side quarters) and H (far quarter).
// Pieces symmetric about the diagonal give a slot pattern per half-block row (bit 1 = lower half, 2 = upper half).
const hipPieces=new Map([
 ['3,3,3',{type:'block'}],['1,1,1',{type:'slab'}],['2,2,2',{type:'slab',flip:true}],
 ['1,1,3',{type:'outer',quad:'H'}],['3,1,1',{type:'outer',quad:'L'}],['1,3,3',{type:'corner',quad:'L'}],['3,3,1',{type:'corner',quad:'H'}],
 ['3,2,2',{type:'outer',flip:true,quad:'L'}],['2,2,3',{type:'outer',flip:true,quad:'H'}],['2,3,3',{type:'corner',flip:true,quad:'L'}],['3,3,2',{type:'corner',flip:true,quad:'H'}]
]);
// Rows of one cell given slot intervals [bottom, top] (half-block values); null when some row has no legal piece.
function hipRows(slots){
 const lo=Math.floor(Math.min(...slots.map(s=>s[0]))),hi=Math.ceil(Math.max(...slots.map(s=>s[1]))),rows=[];
 for(let y=lo;y<hi;y++){const bits=slots.map(([b,t])=>(b<=y&&t>=y+.5?1:0)|(b<=y+.5&&t>=y+1?2:0)),k=bits.join(',');if(k==='0,0,0')continue;const piece=hipPieces.get(k);if(!piece)return null;rows.push({y,...piece});}
 return rows;
}
const hipCache=new Map();
// Positions run along the diagonal in half-cell steps: a whole position p is the diagonal cell (p, p); a half position
// sits between two diagonal cells. The default ('one') puts it in the cell that steps along the beam's first axis, so
// the corner beam is one block wide and every cell shares a face with the next (mirrored for each corner, so the roof
// stays symmetric). 'both' fills both side cells (a wider, heavier band); false keeps only the diagonal cells, which
// then touch only at their edges. These were compared in the rendered roof; 'one' reads as a continuous, light member.
export function hipProfile({steps,y0,slope,thickness,extendStart=0,extendEnd=0,fill='one'}){
 const lift=Math.floor(y0),shape=hipShape({steps,y0:y0-lift,slope,thickness,extendStart,extendEnd,fill});
 return {...shape,cells:shape.cells.map(c=>({...c,rows:c.rows.map(r=>({...r,y:r.y+lift})),slots:c.slots.map(([b,t])=>[b+lift,t+lift])})),centre:d=>shape.centre(d)+lift};
}
function hipShape({steps,y0,slope,thickness,extendStart,extendEnd,fill}){
 const key=[steps,y0,slope,thickness,extendStart,extendEnd,fill].join();if(hipCache.has(key))return hipCache.get(key);
 // Same height-phase search as the side beams.
 let best=null;for(const phase of [0,-.25,.25,-.5]){const fit=hipFit({steps,y0:y0+phase,slope,thickness,extendStart,extendEnd,fill}),score=fit.total+.3*Math.abs(phase)*fit.cells.length;if(!best||score<best.score-1e-9)best={...fit,score,phase};}
 if(hipCache.size>400)hipCache.clear();hipCache.set(key,best);return best;
}
function hipFit({steps,y0,slope,thickness,extendStart,extendEnd,fill}){
 const step=fill?.5:1,k0=extendStart>0?-extendStart:step,k1=extendEnd>0?steps+extendEnd:steps-step,R=Math.SQRT2,half=thickness/2*Math.hypot(1,slope),centre=d=>y0+slope*d;
 // Rising beams step up towards H: a cell's top (and underside) is flat, or half a block lower at L, or at L and M.
 const patterns=[[0,0,0],[-.5,0,0],[-.5,-.5,0]],weight=[1,2,1],wPar=.5,wThick=.5,wJoin=fill?1:0,wDetail=.35;
 let prev=null;const layers=[];
 for(let k=k0;k<=k1+1e-9;k+=step){
  const d=[(k-.25)*R,k*R,(k+.25)*R],top=d.map(v=>centre(v)+half),bottom=d.map(v=>centre(v)-half),states=[];
  const T0=Math.round(top[2]*2)/2,B0=Math.round(bottom[2]*2)/2;
  for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++)for(const p of patterns)for(const q of patterns){
   const T=T0+i/2,B=B0+j/2,slots=[0,1,2].map(s=>[B+q[s],T+p[s]]);if(slots.some(([b,t])=>t-b<.5))continue;
   const rows=hipRows(slots);if(!rows)continue;
   let cost=0;for(let s=0;s<3;s++)cost+=weight[s]*(Math.abs(slots[s][1]-top[s])+Math.abs(slots[s][0]-bottom[s]));
   cost+=wThick*Math.abs((slots[1][1]-slots[1][0])-2*half);
   // Corner stairs only where they clearly follow the line better: small quarter steps read as clutter otherwise.
   cost+=wDetail*rows.filter(r=>r.type==='outer'||r.type==='corner').length;
   states.push({slots,rows,cost,total:Infinity,from:null});
  }
  // Consecutive cells meet at the diagonal corner: the far slot of one and the near slot of the next share at least
  // half a block of height, and their thickness changes as little as possible.
  for(const s of states){
   if(!prev){s.total=s.cost;continue;}
   for(const p of prev){const a=p.slots[2],b=s.slots[0];if(Math.min(a[1],b[1])-Math.max(a[0],b[0])<.5)continue;
    // With fill, the far slot of one position and the near slot of the next sit at the same point along the beam.
    const c=p.total+s.cost+wPar*Math.abs((p.slots[1][1]-p.slots[1][0])-(s.slots[1][1]-s.slots[1][0]))+wJoin*(Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]));if(c<s.total){s.total=c;s.from=p;}}
  }
  prev=states.filter(s=>Number.isFinite(s.total));if(!prev.length)throw Error('No connected corner beam found.');layers.push(k);
 }
 let s=prev.reduce((a,b)=>b.total<a.total?b:a);const total=s.total,cells=[];for(let i=layers.length-1;i>=0;i--){cells.unshift({k:layers[i],rows:s.rows,slots:s.slots});s=s.from;}
 return {k0,k1,cells,centre,half,fill,total};
}
// ---- Placement ----
// Side profiles are laid along the beam's axis; stairs keep their tall half on the correct side when the beam runs
// towards negative x or z. Hip cells map their L / H slots to the near and far quarters of each cell.
const swapSide=type=>type==='left'?'right':type==='right'?'left':type;
function placeSide(profile,{from,dx,dz},elevation){return profile.blocks.map(b=>({x:from.x+dx*b.x,y:elevation+b.y,z:from.z+dz*b.x,type:dx<0||dz<0?swapSide(b.type):b.type,flip:!!b.flip,axis:dx?'x':'z'}));}
function placeHip(profile,{from,dx,dz},elevation){
 const far={x:dx>0?1:0,z:dz>0?1:0},near={x:1-far.x,z:1-far.z},out=[];
 for(const {k,rows}of profile.cells){
  const at=Number.isInteger(k)?[[k,k]]:profile.fill==='both'?[[Math.ceil(k),Math.floor(k)],[Math.floor(k),Math.ceil(k)]]:[[Math.ceil(k),Math.floor(k)]];
  for(const [a,b]of at)for(const r of rows){const piece={x:from.x+dx*a,y:elevation+r.y,z:from.z+dz*b,type:r.type,flip:!!r.flip,axis:'x'};
   if(r.type==='outer'){const q=r.quad==='H'?far:near;piece.hiX=q.x;piece.hiZ=q.z;}
   if(r.type==='corner'){const q=r.quad==='H'?far:near;piece.lowX=q.x;piece.lowZ=q.z;}
   out.push(piece);}}
 return out;
}
export function createAngleRoof({beams=angleBeamDefaults,cornerFill='one',...pillars}={}){
 const frame=createFrame({...pillars,roof:null,gables:null}),e=frame.elevation;
 const occupied=new Set(frame.blocks.map(b=>b.x+','+b.y+','+b.z)),cells=new Map(),settings={},profiles={};
 for(const [key,set]of Object.entries(angleBeamSets)){
  const v=normalizeBeam(key,beams?.[key],frame);settings[key]=v;
  for(const pair of beamPairs(key,frame)){
   const {from,to,wing,corner}=pair,dx=Math.sign(to.x-from.x),dz=Math.sign(to.z-from.z),run=Math.max(Math.abs(to.x-from.x),Math.abs(to.z-from.z));
   // Centre line from the middle of the start block to the end level on the second column.
   const y0=from.base+v.start-.5,rise=beamEnd(key,v,frame)-v.start-(from.base-to.base);
   const pieces=corner?placeHip(profiles[key+':hip']=hipProfile({steps:run,y0,slope:rise/(run*Math.SQRT2),thickness:v.thickness,extendStart:v.extendStart,extendEnd:v.extendEnd,fill:cornerFill}),{from,dx,dz},e)
    :placeSide(profiles[key+':side']=sideProfile({run,y0,slope:rise/run,thickness:v.thickness,extendStart:v.extendStart,extendEnd:v.extendEnd}),{from,dx,dz},e);
   for(const p of pieces){const id=p.x+','+p.y+','+p.z;if(occupied.has(id))continue;const old=cells.get(id);
    // Two beams claiming one cell with different pieces become a full block there.
    if(old){if(old.type!==p.type||old.flip!==p.flip||old.axis!==p.axis){Object.assign(old,{type:'block',flip:false});delete old.hiX;delete old.hiZ;delete old.lowX;delete old.lowZ;}continue;}
    cells.set(id,{...p,group:set.group,wing,layer:set.group,beam:corner?'corner':'side'});}
  }
 }
 const beamBlocks=[...cells.values()],blocks=[...frame.blocks,...beamBlocks],bounds={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity,minZ:Infinity,maxZ:-Infinity};
 for(const b of blocks){bounds.minX=Math.min(bounds.minX,b.x);bounds.maxX=Math.max(bounds.maxX,b.x+1);bounds.minY=Math.min(bounds.minY,b.y);bounds.maxY=Math.max(bounds.maxY,b.y+1);bounds.minZ=Math.min(bounds.minZ,b.z);bounds.maxZ=Math.max(bounds.maxZ,b.z+1);}
 return {...frame,...bounds,blocks,variant:'angle',beams:settings,beamCount:beamBlocks.length,profiles};
}
