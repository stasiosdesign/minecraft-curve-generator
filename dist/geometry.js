// Occupied half-cell masks, bottom row first. No sideways slabs or wedges.
export const shapes={block:[1,1,1,1],slab:[1,1,0,0],right:[1,1,0,1],left:[1,1,1,0]};
export function polygon(e){const {x,y,type,flip}=e;let pts=type==='block'?[[0,0],[1,0],[1,1],[0,1]]:type==='slab'?[[0,0],[1,0],[1,.5],[0,.5]]:type==='right'?[[0,0],[1,0],[1,1],[.5,1],[.5,.5],[0,.5]]:[[0,0],[1,0],[1,.5],[.5,.5],[.5,1],[0,1]];return pts.map(([a,b])=>[x+a,y+(flip?1-b:b)]);}
export function elements(columns,ceiling,flip){const out=[];columns.forEach((c,x)=>{for(let y=0;y<c.base;y++)out.push({x,y,type:'block'});if(c.type!=='empty')out.push({x,y:c.base,type:c.type});});return out.map(e=>flip?{...e,y:ceiling-1-e.y,flip:true}:e);}
