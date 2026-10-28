// Nearest-polyline distance with a bounding-volume tree.
function tree(pts,lo=0,hi=pts.length-1){const slice=pts.slice(lo,hi+1),node={minX:Math.min(...slice.map(p=>p[0])),maxX:Math.max(...slice.map(p=>p[0])),minY:Math.min(...slice.map(p=>p[1])),maxY:Math.max(...slice.map(p=>p[1]))};if(hi-lo<=4)node.points=slice;else{const mid=(lo+hi)>>1;node.left=tree(pts,lo,mid);node.right=tree(pts,mid,hi);}return node;}
function distance(x,y,root){let best=Infinity;const bound=n=>Math.max(n.minX-x,0,x-n.maxX)**2+Math.max(n.minY-y,0,y-n.maxY)**2;function visit(n){if(bound(n)>=best)return;if(n.points){for(let i=1;i<n.points.length;i++){const [a,b]=n.points[i-1],[c,d]=n.points[i],dx=c-a,dy=d-b,t=Math.max(0,Math.min(1,((x-a)*dx+(y-b)*dy)/(dx*dx+dy*dy)));best=Math.min(best,(x-a-t*dx)**2+(y-b-t*dy)**2);}}else if(bound(n.left)<bound(n.right)){visit(n.left);visit(n.right);}else{visit(n.right);visit(n.left);}}visit(root);return best;}
// Bit masks: lower left, lower right, upper left, upper right.
const legal=new Map([[15,{type:'block'}],[3,{type:'slab'}],[12,{type:'slab',flip:true}],[11,{type:'right'}],[7,{type:'left'}],[14,{type:'right',flip:true}],[13,{type:'left',flip:true}]]);
function columnTiles(x,low,high,onlyBlocks){
 if(Math.min(...high)-Math.max(...low)<.5)return null;
 const out=[];
 for(let y=Math.floor(Math.min(...low));y<Math.ceil(Math.max(...high));y++){
  let mask=0;for(let j=0;j<4;j++){const yy=y+(j<2?.25:.75),side=j%2;if(yy>low[side]&&yy<high[side])mask|=1<<j;}
  if(!mask)continue;const shape=legal.get(mask);if(!shape||(onlyBlocks&&mask!==15))return null;out.push({x,y,...shape});
 }return out;
}
function profiles(min,max,upper,onlyBlocks){const out=[];for(let y=Math.floor(min)-1;y<=Math.ceil(max)+1;y++){out.push([y,y]);if(!onlyBlocks)out.push([y+.5,y+.5],upper?[y+.5,y+1]:[y+.5,y],upper?[y+1,y+.5]:[y,y+.5]);}return out;}
export function measurePlacedRoof(blocks,c,layout){
 const top=tree(c.points),bottom=tree(c.inner),surfaces=new Map();
 for(const e of blocks){const mask=e.type==='block'?[1,1,1,1]:e.type==='slab'?[1,1,0,0]:e.type==='right'?[1,1,0,1]:[1,1,1,0];for(let x=0;x<2;x++)for(let z=0;z<2;z++)for(let y=0;y<2;y++){const side=e.axis==='z'?z:x;if(!mask[(e.flip?1-y:y)*2+side])continue;const xx=e.x+(x+.5)/2,zz=e.z+(z+.5)/2,key=xx+','+zz,low=e.y+y/2,high=low+.5,s=surfaces.get(key);if(s){s.low=Math.min(s.low,low);s.high=Math.max(s.high,high);}else surfaces.set(key,{x:xx,z:zz,low,high});}}
 let outer=0,inner=0;for(const s of surfaces.values()){const u=layout==='diagonal'?(s.x+s.z)/Math.SQRT2:layout==='hip'?Math.min(s.x,s.z):s.x;outer+=distance(u,s.high,top);inner+=distance(u,s.low,bottom);}return {outerRms:Math.sqrt(outer/surfaces.size),innerRms:Math.sqrt(inner/surfaces.size)};
}
export function solve(c,{onlyBlocks=false,diagonal=false,startThickness=null,maxThickness=null,startLow=null,allowGaps=false}={}){
 const outer=tree(c.points),inner=tree(c.inner),layers=[],n=diagonal?Math.max(1,Math.ceil(c.w*Math.SQRT2-1e-9)-1):Math.ceil(c.w-1e-9),thickness=c.thickness;
 const at=t=>c.fn(Math.max(0,Math.min(c.w,t)));
 const centre=diagonal?(n+1)/(2*Math.SQRT2):n/2;
 const symmetric=startThickness===null&&startLow===null&&Math.abs(centre-c.w/2)<1e-7&&c.points.every(([x,y],i)=>Math.abs(y-c.points[c.points.length-1-i][1])<1e-7);
 const count=symmetric?Math.ceil(n/2):n;
 for(let x=0;x<count;x++){
  const ys=[0,.25,.5,.75,1].map(t=>at(diagonal?(x+2*t)/Math.SQRT2:x+t)),min=Math.min(...ys),max=Math.max(...ys),top=profiles(min,max,true,onlyBlocks),bottom=profiles(min-thickness,max-thickness,false,onlyBlocks),opts=[];
  if(x===0&&startThickness!==null){top.push([startThickness,startThickness]);bottom.push([0,0]);}
  if(x===0&&startLow!==null){top.push([startLow+thickness,startLow+thickness]);bottom.push([startLow,startLow]);}
  const riserCache=new Map();
  function edgeError(a,b,xx,ref){const len=Math.abs(b-a);if(!len)return 0;const lo=Math.min(a,b),key=[lo,lo+len,xx,ref===outer?0:1].join(',');if(riserCache.has(key))return riserCache.get(key);const count=Math.max(1,Math.ceil(len*4));let cost=0;for(let j=0;j<count;j++)cost+=distance(xx,lo+len*(j+.5)/count,ref)*len/count;riserCache.set(key,cost);return cost;}
  function surface(profile,ref){let e=0;for(let j=0;j<8;j++){if(diagonal){for(let z=0;z<4;z++)e+=distance((x+(j+.5)/8+(z+.5)/4)/Math.SQRT2,profile[j<4?0:1],ref)/32;}else e+=distance(x+(j+.5)/8,profile[j<4?0:1],ref)/8;}if(diagonal){for(let z=0;z<4;z++)e+=edgeError(profile[0],profile[1],(x+.5+(z+.5)/4)/Math.SQRT2,ref)/4;return e;}return e+edgeError(profile[0],profile[1],x+.5,ref);}
  const tc=new Map(top.map(a=>[a,surface(a,outer)])),bc=new Map(bottom.map(a=>[a,surface(a,inner)]));
  for(const high of top)for(const low of bottom){if(maxThickness!==null&&Math.max(...high)-Math.min(...low)>maxThickness+1e-9)continue;if(x===0&&startLow!==null&&low[0]!==startLow)continue;if(x===0&&startThickness!==null&&(low.some(y=>y!==0)||high.some(y=>y!==startThickness)))continue;if(symmetric&&n%2&&x===count-1&&(high[0]!==high[1]||low[0]!==low[1]))continue;const tiles=columnTiles(x,low,high,onlyBlocks);if(!tiles)continue;const thick=(high[0]+high[1]-low[0]-low[1])/2;const unary=tc.get(high)+bc.get(low)+.008*(thick-thickness)**2+.0002*tiles.filter(t=>t.type!=='block').length;opts.push({high,low,tiles,unary:symmetric&&n%2&&x===count-1?unary/2:unary,cost:Infinity,prev:-1});}
  // DP is exact within these retained states, not over all possible builds.
  opts.sort((a,b)=>a.unary-b.unary);const kept=opts.slice(0,72);
  const bridge=opts.find(o=>Math.max(...o.low)<=Math.floor(min-thickness)&&Math.min(...o.high)>=Math.ceil(max));
  if(bridge&&!kept.includes(bridge))kept.push(bridge);
  const edgeCache=new Map();
  for(const o of kept){if(!x){o.cost=o.unary;continue;}for(let k=0;k<layers[x-1].length;k++){
   const q=layers[x-1][k];const overlap=Math.min(q.high[1],o.high[0])-Math.max(q.low[1],o.low[0]);if(!Number.isFinite(q.cost)||(!allowGaps&&overlap<.5))continue;
   if(diagonal&&Math.max(...[0,1].map(h=>Math.min(q.high[h],o.high[h])-Math.max(q.low[h],o.low[h])))<.5)continue;
   const key=diagonal?[...q.high,...o.high,...q.low,...o.low].join(','):[q.high[1],o.high[0],q.low[1],o.low[0]].join(',');let edge=edgeCache.get(key);if(edge===undefined){if(diagonal){edge=0;for(let j=0;j<4;j++){const u=(x+(j+.5)/4)/Math.SQRT2,h=j<2?0:1;edge+=(edgeError(q.high[1],o.high[0],u,outer)+edgeError(q.low[1],o.low[0],u,inner)+edgeError(q.high[h],o.high[h],u,outer)+edgeError(q.low[h],o.low[h],u,inner))/4;}}else edge=edgeError(q.high[1],o.high[0],x,outer)+edgeError(q.low[1],o.low[0],x,inner);edgeCache.set(key,edge);}
   const desired=diagonal?at((x+1)/Math.SQRT2)-at(x/Math.SQRT2):at(x+.5)-at(x-.5),dt=(o.high[0]+o.high[1]-q.high[0]-q.high[1])/2,db=(o.low[0]+o.low[1]-q.low[0]-q.low[1])/2;
   const cost=q.cost+o.unary+edge+(allowGaps&&overlap<.5?.5:0)+.008*((dt-desired)**2+(db-desired)**2)+.004*(Math.abs(o.high[0]-q.high[1])+Math.abs(o.low[0]-q.low[1]));
   if(cost<o.cost){o.cost=cost;o.prev=k;}
  }}layers.push(kept);
 }
 const last=layers.at(-1);let k=last.reduce((best,o,i)=>o.cost<last[best].cost?i:best,0);if(!Number.isFinite(last[k]?.cost))throw Error('No connected roof found. Increase thickness.');
 const cost=last[k].cost*(symmetric?2:1),columns=[];for(let x=count-1;x>=0;x--){const o=layers[x][k];columns.unshift(o);k=o.prev;}
 // Mirror complete legal elements, including stair handedness. The centre column is flat on both surfaces.
 if(symmetric)for(let x=count;x<n;x++){const source=columns[n-1-x],high=[...source.high].reverse(),low=[...source.low].reverse();columns.push({high,low,tiles:columnTiles(x,low,high,onlyBlocks)});}
 const blocks=columns.flatMap(o=>o.tiles);let outside=0,inside=0;for(let x=0;x<n;x++)for(let j=0;j<16;j++)for(let z=0;z<(diagonal?4:1);z++){const xx=diagonal?(x+(j+.5)/16+(z+.5)/4)/Math.SQRT2:x+(j+.5)/16;outside+=distance(xx,columns[x].high[j<8?0:1],outer);inside+=distance(xx,columns[x].low[j<8?0:1],inner);}
 const samples=n*16*(diagonal?4:1);
 const gaps=columns.slice(1).filter((o,i)=>Math.min(columns[i].high[1],o.high[0])-Math.max(columns[i].low[1],o.low[0])<.5).length;
 return {blocks,diagonal,gaps,columns:columns.map(({high,low})=>({high,low})),cost,outerRms:Math.sqrt(outside/samples),innerRms:Math.sqrt(inside/samples),rms:Math.sqrt((outside+inside)/(samples*2)),maxY:Math.max(c.h,...blocks.map(b=>b.y+1)),minY:Math.min(c.min,...blocks.map(b=>b.y))};
}

