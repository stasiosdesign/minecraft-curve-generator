// Compact, deterministic ravine: integer blocks, 50 high, 26/50 wide openings.
export function ravineGap(y){return 2*(13+Math.floor(12*Math.max(0,Math.min(49,y))/49));}
export function createRavine(){
 const blocks=[],occupied=new Map(),depth=20;
 const add=(x,y,z,group)=>{const id=blocks.length;blocks.push({x,y,z,type:'block',group});occupied.set(`${x},${y},${z}`,id);};
 for(let z=0;z<depth;z++){
  for(let y=0;y<50;y++){const half=ravineGap(y)/2;for(let x=-34;x<34;x++)if(x< -half||x>=half)add(x,y,z, y===49?'ridge':(Math.floor(y/5)+Math.floor(z/6))%3===0?'rock-light':'rock');}
  for(let x=-13;x<13;x++){add(x,-1,z,'riverbed');add(x,0,z,'water');}
 }
 const mesh=[];
 for(let id=0;id<blocks.length;id++){const b=blocks[id],p=[b.x,b.y,b.z];for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){const next=[...p];next[axis]+=sign;if(occupied.has(next.join(',')))continue;const axes=[0,1,2].filter(a=>a!==axis),pts=[[0,0],[1,0],[1,1],[0,1]].map(([u,v])=>{const q=[...p];q[axis]+=sign>0?1:0;q[axes[0]]+=u;q[axes[1]]+=v;return q;}),normal=[0,0,0];normal[axis]=sign;mesh.push({pts,normal,id,z:b.z});}}
 return {blocks,mesh,placed:true,minX:-34,maxX:34,minY:-1,maxY:50,minZ:0,maxZ:depth,groundY:-1,dimensions:{height:50,bottomGap:26,topGap:50,depth}};
}
