// Seeded integer terrain: fixed river/top spans, with irregular ledges and ridgelines.
export function ravineGap(y){return Math.round(37+41*(Math.max(0,Math.min(49,y))/49)**.9);}
export function ravineEdges(y,z){
 const t=Math.max(0,Math.min(1,y/49)),gap=ravineGap(y),meander=Math.round(2*Math.sin(z*.19)),rough=Math.sin(Math.PI*t);
 const left=-Math.floor(gap/2)+meander-Math.round(rough*(2*Math.sin(z*.47+y*.24)+Math.sin(z*.91-y*.38)));
 const right=left+gap+Math.round(rough*(2*Math.sin(z*.32-y*.19)));
 return [left,right];
}
export function createRavine(){
 const blocks=[],occupied=new Map(),depth=36;
 const noise=(x,y,z)=>{const n=Math.sin(x*12.9898+y*37.719+z*78.233)*43758.5453;return n-Math.floor(n);};
 const add=(x,y,z,group)=>{const id=blocks.length;blocks.push({x,y,z,type:'block',group});occupied.set(`${x},${y},${z}`,id);};
 for(let z=0;z<depth;z++){
  for(let y=0;y<58;y++){
   let [left,right]=ravineEdges(y,z);
   // Above the nominal cliff rim the two sides form different broken summits.
   if(y>49){left-=Math.ceil((y-49)*(1.1+.3*Math.sin(z*.4)));right+=Math.ceil((y-49)*(1.2+.3*Math.cos(z*.3)));}
   const outerLeft=-Math.round(66-15*(y/50)**1.4+3*Math.sin(z*.25)+2*Math.sin(z*.67+y*.11));
   const outerRight=Math.round(66-15*(y/50)**1.4+4*Math.sin(z*.21+1.6)+2*Math.cos(z*.56-y*.15));
   for(let x=outerLeft;x<outerRight;x++)if(x<left||x>=right){const n=noise(x,y,z);add(x,y,z,n>.91?'rock-light':n<.1?'rock-dark':Math.sin(y*.55+z*.12+x*.04)>.8?'strata':'rock');}
  }
  const [left,right]=ravineEdges(0,z);
  for(let x=left;x<right;x++){add(x,-1,z,'riverbed');add(x,0,z,'water');}
 }
 // Weathered caps and thin soil on exposed upper terraces, not a flat roof.
 for(const b of blocks)if(b.y>30&&!occupied.has(`${b.x},${b.y+1},${b.z}`)){
  b.group=b.y>52?'rock-light':noise(b.x,0,b.z)>.18?'grass':'gravel';
  for(let d=1;d<=2;d++){const id=occupied.get(`${b.x},${b.y-d},${b.z}`);if(id!==undefined&&b.group==='grass')blocks[id].group='soil';}
 }
 const mesh=[];
 for(let id=0;id<blocks.length;id++){const b=blocks[id],p=[b.x,b.y,b.z];for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){const next=[...p];next[axis]+=sign;if(occupied.has(next.join(',')))continue;const axes=[0,1,2].filter(a=>a!==axis),pts=[[0,0],[1,0],[1,1],[0,1]].map(([u,v])=>{const q=[...p];q[axis]+=sign>0?1:0;q[axes[0]]+=u;q[axes[1]]+=v;return q;}),normal=[0,0,0];normal[axis]=sign;mesh.push({pts,normal,id,z:b.z});}}
 let minX=0,maxX=0,maxY=0;for(const b of blocks){minX=Math.min(minX,b.x);maxX=Math.max(maxX,b.x+1);maxY=Math.max(maxY,b.y+1);}
 return {blocks,mesh,placed:true,minX,maxX,minY:-1,maxY,minZ:0,maxZ:depth,groundY:-1,dimensions:{height:50,bottomGap:37,topGap:78,depth}};
}
