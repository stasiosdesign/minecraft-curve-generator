import {curve} from './curves.js';
// Thickness is measured across the curve (perpendicular), in blocks. 1.5 gives the proportions of classic stair roofs; 0.5 is the thinnest.
export const frameCurveDefaults={type:'custom',radius:20,extent:120,width:9,height:12,left:0,middle:-4.5,right:-6,bend:50,thickness:1.5,extraEnabled:false,extraPosition:75,extraHeight:-5.5};
const slopeOf=(fn,w,x,d=1e-3)=>{const a=Math.max(0,x-d),b=Math.min(w,x+d);return (fn(b)-fn(a))/(b-a);};
// The drawn line and its perpendicular offset (finite even where the line is vertical). With extend, both ends continue
// along their tangents so the band ends in clean vertical cuts at the first and last column.
export function offsetLine(fn,w,t,N=512,extend=0){
 const pts=[],s0=slopeOf(fn,w,0),s1=slopeOf(fn,w,w),E=extend?8:0;
 for(let i=E;i>0;i--){const d=extend*i/E/Math.hypot(1,s0);pts.push([-d,fn(0)-s0*d,s0]);}
 for(let i=0;i<=N;i++){const x=w*i/N;pts.push([x,fn(x),slopeOf(fn,w,x)]);}
 for(let i=1;i<=E;i++){const d=extend*i/E/Math.hypot(1,s1);pts.push([w+d,fn(w)+s1*d,s1]);}
 const outer=[],inner=[];for(const [x,y,s]of pts){const k=t/Math.hypot(1,s);outer.push([x,y]);inner.push([x+s*k,y-k]);}return {outer,inner};
}
// The drawn line is the roof's top surface. The profile is lifted so the band's underside starts on the centre columns (y = 0);
// the start slope is capped at 3 so a vertical start still gives a finite lift.
export function frameReference(p){
 const raw=curve(p),offset=raw.offset??0,span=raw.span??raw.w,t=p.thickness,base=x=>raw.fn(x+offset),s0=slopeOf(base,span,0),shift=t*Math.hypot(1,Math.max(-3,Math.min(3,s0)))-base(0),fn=x=>base(x)+shift;
 const points=raw.points.map(([x,y])=>[x-offset,y+shift]),{inner}=offsetLine(fn,span,t);
 return {...raw,w:span,span,offset:0,thickness:t,fn,points,inner,h:Math.max(...points.map(p=>p[1])),min:Math.min(...inner.map(p=>p[1])),handles:raw.handles.map(([x,y])=>[x-offset,y+shift])};
}
// Legal 2x2 half-block masks (bits: lower left, lower right, upper left, upper right): block, slabs and the four stair states.
const roofShapes=new Map([[15,{type:'block'}],[3,{type:'slab'}],[12,{type:'slab',flip:true}],[11,{type:'right'}],[7,{type:'left'}],[14,{type:'right',flip:true}],[13,{type:'left',flip:true}]]);
function roofRows(low,high,visit){for(let y=Math.floor(Math.min(low[0],low[1]));y<Math.ceil(Math.max(high[0],high[1]));y++){let mask=0;for(let j=0;j<4;j++){const yy=y+(j<2?.25:.75),side=j&1;if(yy>low[side]&&yy<high[side])mask|=1<<j;}if(mask&&visit(y,mask)===false)return false;}return true;}
const roofLegal=(low,high,onlyBlocks)=>roofRows(low,high,(y,mask)=>roofShapes.has(mask)&&(!onlyBlocks||mask===15));
const roofTiles=(x,low,high)=>{const out=[];roofRows(low,high,(y,mask)=>{out.push({x,y,...roofShapes.get(mask)});});return out;};
// Roof profile as a constant-thickness ribbon of legal Minecraft pieces, modelled on hand-built stair roofs:
// - the top surface follows the drawn line and the underside follows its perpendicular offset (L1 area, top weighted higher);
// - thickness stays constant from half-column to half-column, so steep runs keep equal row widths and shallow runs equal
//   column heights, and top and underside repeat the same half-step inside each block (parallel faces, e.g. stair /
//   block / upside-down stair on a 2:1 slope);
// - every column shares at least half a block of face with the next (no gaps), and the first column holds the anchor.
// Exact dynamic programme over block columns: a column is a left and a right half-block interval (Minecraft cannot step
// more than half a block inside one block). Predecessors are grouped by the height of their right half; within a group
// a sparse table gives the cheapest compatible one in O(1).
// bottomWeight: roofs are judged mostly by their top surface (0.5); beams, seen from both sides, use 1.
export function fitRoof({fn,w,thickness,startLow=0,onlyBlocks=false,bottomWeight=.5}){
 const n=Math.max(1,Math.ceil(w-1e-9)),H=2*n,K=8,step=onlyBlocks?1:.5,wTop=1,wBottom=bottomWeight,wThick=.25,wPar=.25,follow=.5,q2=v=>Math.round(v*2);
 const {outer,inner}=offsetLine(fn,w,thickness,Math.max(256,Math.ceil(w*48)),thickness*3),ring=[...outer,...inner.reverse()],buckets=Array.from({length:H},()=>[]);
 for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],from=Math.max(0,Math.floor(Math.min(a[0],b[0])*2)),to=Math.min(H-1,Math.floor(Math.max(a[0],b[0])*2));for(let h=from;h<=to;h++)buckets[h].push([a,b]);}
 // Band samples per half-column: [underside, top] from crossings with the band outline. Nothing is sampled past the line's end.
 const band=[];for(let h=0;h<H;h++){const s=[];for(let k=0;k<K;k++){const x=h/2+(k+.5)/(2*K);if(x>w)continue;let lo=Infinity,hi=-Infinity;for(const [[x1,y1],[x2,y2]]of buckets[h]){if(x<Math.min(x1,x2)||x>Math.max(x1,x2))continue;const y=x1===x2?Math.min(y1,y2):y1+(y2-y1)*(x-x1)/(x2-x1),top=x1===x2?Math.max(y1,y2):y;lo=Math.min(lo,y);hi=Math.max(hi,top);}if(Number.isFinite(lo))s.push([lo,hi]);}band.push(s);}
 // Points along the drawn line by arc length, so steep stretches weigh as much as flat ones when part of the line is left uncovered.
 const line=Array.from({length:H},()=>[]),N=1200;let px=0,py=fn(0);
 for(let i=1;i<=N;i++){const x=w*i/N,y=fn(x),len=Math.hypot(x-px,y-py),parts=Math.max(1,Math.ceil(len/.05));for(let j=0;j<parts;j++){const u=(j+.5)/parts,h=Math.min(H-1,Math.floor((px+(x-px)*u)*2));line[h].push([py+(y-py)*u,len/parts]);}px=x;py=y;}
 const memo=new Map(),cost=(h,lo,hi)=>{const key=h+':'+lo+':'+hi;let e=memo.get(key);if(e!==undefined)return e;e=0;for(const [b,a]of band[h])e+=wTop*Math.abs(hi-a)+wBottom*Math.abs(lo-b);e/=2*K;let miss=0;for(const [y,ds]of line[h])miss+=ds*Math.max(0,lo-y,y-hi);e+=follow*miss;memo.set(key,e);return e;};
 // Candidate heights: the band ±1 block, widened so neighbouring columns can always meet face to face.
 const ranges=[];for(let x=0;x<n;x++){let lo=Infinity,hi=-Infinity;for(const h of [2*x,2*x+1]){for(const [b,a]of band[h]){lo=Math.min(lo,b);hi=Math.max(hi,a);}for(const [y]of line[h]){lo=Math.min(lo,y);hi=Math.max(hi,y);}}ranges.push(Number.isFinite(lo)?[Math.floor(lo/step)*step-1,Math.ceil(hi/step)*step+1]:[...ranges[x-1]]);}
 ranges[0]=[Math.min(ranges[0][0],startLow),Math.max(ranges[0][1],startLow+1)];
 for(let x=1;x<n;x++){ranges[x][0]=Math.min(ranges[x][0],ranges[x-1][1]-1);ranges[x][1]=Math.max(ranges[x][1],ranges[x-1][0]+1);}
 for(let x=n-2;x>=0;x--){ranges[x][0]=Math.min(ranges[x][0],ranges[x+1][1]-1);ranges[x][1]=Math.max(ranges[x][1],ranges[x+1][0]+1);}
 let groups=[],states=[];
 for(let x=0;x<n;x++){
  const [lo,hi]=ranges[x],vals=[];for(let v=lo;v<=hi+1e-9;v+=step)vals.push(Math.round(v*2)/2);
  // Cheapest compatible predecessor for each left half: its right half must reach bl + 0.5 and start by tl - 0.5,
  // plus the penalty for changing thickness across the joint.
  const arrive=[];
  for(const bl of vals)for(const tl of vals){const hL=tl-bl;if(hL<.5-1e-9)continue;if(x===0){if(bl<=startLow&&tl>=startLow+.5)arrive.push({bl,tl,cost:0,from:null});continue;}
   let best=null;for(const g of groups){const pen=wThick*Math.abs(hL-g.h);if(best&&pen>=best.cost)continue;const q=g.query(q2(bl+.5-g.h),q2(tl-.5));if(!q)continue;const c=q.cost+pen;if(!best||c<best.cost)best={cost:c,from:q};}
   if(best)arrive.push({bl,tl,...best});}
  states=[];
  for(const a of arrive){const {bl,tl}=a,cl=cost(2*x,bl,tl);
   for(const tr of [tl-.5,tl,tl+.5])for(const br of [bl-.5,bl,bl+.5]){if(onlyBlocks&&(tr!==tl||br!==bl))continue;if(tr-br<.5-1e-9||tr<lo||tr>hi||br<lo||br>hi||Math.min(tl,tr)-Math.max(bl,br)<.5-1e-9)continue;const low=[bl,br],high=[tl,tr];if(!roofLegal(low,high,onlyBlocks))continue;
    states.push({right:[br,tr],low,high,cost:a.cost+cl+cost(2*x+1,br,tr)+wPar*Math.abs((tl-bl)-(tr-br)),from:a.from});}}
  if(!states.length)throw Error('No connected roof found for this curve.');
  const byHeight=new Map();for(const s of states){const h=s.right[1]-s.right[0],k=q2(s.right[0]);let m=byHeight.get(h);if(!m)byHeight.set(h,m=new Map());const o=m.get(k);if(!o||s.cost<o.cost)m.set(k,s);}
  groups=[];for(const [h,m]of byHeight){const keys=[...m.keys()],min=Math.min(...keys),max=Math.max(...keys),table=[Array.from({length:max-min+1},(_,i)=>m.get(min+i)??null)],pick=(a,b)=>!a?b:!b?a:a.cost<=b.cost?a:b;
   for(let p=1;(1<<p)<=max-min+1;p++){const prev=table[p-1],row=[];for(let i=0;i+(1<<p)<=max-min+1;i++)row.push(pick(prev[i],prev[i+(1<<(p-1))]));table.push(row);}
   groups.push({h,query:(from,to)=>{from=Math.max(from,min)-min;to=Math.min(to,max)-min;if(from>to)return null;const p=Math.floor(Math.log2(to-from+1));return pick(table[p][from],table[p][to-(1<<p)+1]);}});}
  groups.sort((a,b)=>a.h-b.h);
 }
 let s=states.reduce((a,b)=>b.cost<a.cost?b:a);const total=s.cost,chosen=[];while(s){chosen.unshift(s);s=s.from;}
 const columns=chosen.map(({high,low})=>({high,low})),blocks=columns.flatMap((o,x)=>roofTiles(x,o.low,o.high));
 const gaps=columns.slice(1).filter((o,i)=>Math.min(columns[i].high[1],o.high[0])-Math.max(columns[i].low[1],o.low[0])<.5).length;
 return {blocks,columns,gaps,cost:total,minY:Math.min(...blocks.map(b=>b.y)),maxY:Math.max(...blocks.map(b=>b.y+1))};
}
export function frameCurve(p){const c=frameReference(p);return {c,roof:fitRoof({fn:c.fn,w:c.w,thickness:p.thickness,startLow:0,onlyBlocks:!!p.onlyBlocks})};}
export const gableDefaults={enabled:true,height:7,reach:6,flare:60,thickness:1.5,depth:2,overhang:1};
// One arm of a corner gable, in local cells: cell 0 stands on the corner column, cell `reach` lands on the column `reach`
// blocks along the side; y = 0 is the top of the outer columns. The arm's top line sweeps from the peak (`height` above the
// columns) down to the landing, steep at the peak and flaring out at the foot (flare 0 = straight, 100 = strong sweep).
// It is fitted with the same stair-roof ribbon as the roof, then the corner cell is filled down into a post on the column.
export function cornerGableProfile({height=gableDefaults.height,reach=gableDefaults.reach,flare=gableDefaults.flare,thickness=gableDefaults.thickness}={}){
 const n=reach+1,k=1+2*Math.max(0,Math.min(100,flare))/100,foot=Math.min(thickness,height/2),fn=x=>foot+(height-foot)*Math.pow(Math.max(0,Math.min(1,x/n)),k);
 // Fitted from the landing (x = 0, anchored on the column top) up to the peak, then mirrored so cell 0 is the corner.
 const fitted=fitRoof({fn,w:n,thickness,startLow:0}).columns,columns=[];
 for(let i=0;i<n;i++){const src=fitted[n-1-i];let low=[...src.low].reverse().map(v=>Math.max(0,v)),high=[...src.high].reverse().map((v,s)=>Math.max(v,low[s]+.5));
  if(i===0)low=[0,0];
  if(!roofLegal(low,high,false))high=[Math.max(...high),Math.max(...high)];
  columns.push({low,high});}
 return {columns,blocks:columns.flatMap((c,i)=>roofTiles(i,c.low,c.high)),reach,height};
}
