// Only integer world positions and cardinal stair directions are used.
export function placeRoof(roof,depth,layout='straight',run=null){
 const blocks=[];
 if(layout==='diagonal'){
  const bands=Math.max(2,Math.ceil(depth*Math.SQRT2));
  for(const e of roof.blocks)for(let t=e.x%2;t<bands;t+=2)blocks.push({...e,x:(e.x-t)/2,z:(e.x+t)/2,axis:'x',band:e.x});
 }else if(layout==='hip'){
  // Both wings use the complete edited profile. A half-span here silently
  // discarded the right endpoint and made the 3D design differ from the editor.
  const size=Math.max(1,Math.min(roof.columns.length,Math.ceil(run??roof.columns.length))),columns=new Map();for(const e of roof.blocks){if(!columns.has(e.x))columns.set(e.x,[]);columns.get(e.x).push(e);}
  for(let x=0;x<size;x++)for(let z=0;z<size;z++)for(const e of columns.get(Math.min(x,z))??[]){const seam=x===z,stair=e.type==='left'||e.type==='right';blocks.push({...e,x,z,axis:x<=z?'x':'z',...(seam&&stair?{type:'block',flip:false,seam:true}:{})});}
 }else for(let z=0;z<depth;z++)for(const e of roof.blocks)blocks.push({...e,z,axis:'x'});
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,minZ=Infinity,maxZ=-Infinity;for(const e of blocks){minX=Math.min(minX,e.x);maxX=Math.max(maxX,e.x+1);minY=Math.min(minY,e.y);maxY=Math.max(maxY,e.y+1);minZ=Math.min(minZ,e.z);maxZ=Math.max(maxZ,e.z+1);}
 return {blocks,placed:true,layout,minX,maxX,minY,maxY,minZ,maxZ};
}
export function occupiedVoxels(blocks){
 const voxels=new Map();blocks.forEach((e,id)=>{const mask=e.type==='block'?[1,1,1,1]:e.type==='slab'?[1,1,0,0]:e.type==='right'?[1,1,0,1]:[1,1,1,0];for(let a=0;a<2;a++)for(let y=0;y<2;y++)for(let b=0;b<2;b++){const side=e.axis==='z'?b:a,localY=e.flip?1-y:y;if(mask[localY*2+side])voxels.set(`${e.x*2+a},${e.y*2+y},${e.z*2+b}`,id);}});return voxels;
}
export function placementDirection(e){return e.type==='left'||e.type==='right'?(e.type==='right'?'+':'-')+(e.axis==='z'?'Z':'X'):'';}
