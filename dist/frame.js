// 25 x 25 frame of three concentric column shells on a paved ring. Heights count occupied blocks, including the base block.
export const frameSize=25;
export const frameStops={outer:[0,6,10,14,18,24],inner:[6,10,14,18],center:[10,14]};
export const frameDefaults={outerHeight:8,innerHeight:12,centerHeight:18,centerLift:3,beamLevel:5,curveSide:2};
// Rings counted from the outer edge: 0-6 are solid pathway, 7 is a stair ring stepping down to the hollow centre.
export const pathRings=7;
const ring=(stops)=>{const lo=stops[0],hi=stops[stops.length-1],seen=new Set(),out=[];for(const t of stops)for(const [x,z]of [[t,lo],[t,hi],[lo,t],[hi,t]]){const key=x+','+z;if(!seen.has(key)){seen.add(key);out.push([x,z]);}}return out;};
export function createFrame({innerHeight=frameDefaults.innerHeight,outerHeight=frameDefaults.outerHeight,centerHeight=frameDefaults.centerHeight,centerLift=frameDefaults.centerLift,beamLevel=frameDefaults.beamLevel,elevation=20,roof=null,curveSide=frameDefaults.curveSide,gables=null}={}){
 const integer=(v,min,max)=>Math.max(min,Math.min(max,Math.round(Number(v)||0)));
 innerHeight=integer(innerHeight,1,64);outerHeight=integer(outerHeight,1,64);centerHeight=integer(centerHeight,1,64);centerLift=integer(centerLift,0,32);beamLevel=integer(beamLevel,1,64);elevation=integer(elevation,0,64);
 // Curve width grows symmetrically: curveSide blocks either side of the centre line.
 curveSide=integer(curveSide,0,15);const curveWidth=curveSide*2+1;
 const last=frameSize-1,mid=last/2,outer=ring(frameStops.outer),inner=ring(frameStops.inner),center=ring(frameStops.center);
 const cells=new Map();
 const add=(x,y,z,group,extra={})=>cells.set(`${x},${y},${z}`,{x,y,z,type:'block',axis:'x',group,pillar:false,...extra});
 const lo=pathRings,hi=last-pathRings;
 for(let x=0;x<=last;x++)for(let z=0;z<=last;z++){
  const r=Math.min(x,z,last-x,last-z);
  if(r<pathRings)add(x,elevation,z,'path');
  else if(r===pathRings){
   // Upright stairs: tall half against the pathway, low step facing the hollow centre. Corners use inner-corner stairs.
   const cornerX=x===lo||x===hi,cornerZ=z===lo||z===hi;
   if(cornerX&&cornerZ)add(x,elevation,z,'steps',{type:'corner',lowX:x===lo?1:0,lowZ:z===lo?1:0});
   else if(cornerX)add(x,elevation,z,'steps',{type:x===hi?'right':'left',axis:'x'});
   else add(x,elevation,z,'steps',{type:z===hi?'right':'left',axis:'z'});
  }
 }
 // Horizontal beam wrapping the whole outer perimeter, on the beamLevel-th block (counting the base block as 1).
 const beamY=elevation+beamLevel-1;
 for(let t=0;t<=last;t++)for(const [x,z]of [[t,0],[t,last],[0,t],[last,t]])add(x,beamY,z,'beam');
 for(const [pillars,height,base,group]of [[outer,outerHeight,elevation,'outer'],[inner,innerHeight,elevation,'inner'],[center,centerHeight,elevation+centerLift,'center']])for(const [x,z]of pillars)for(let y=base;y<base+height;y++)add(x,y,z,group,{pillar:true});
 const surfaceY=elevation+centerLift+centerHeight,rim=frameStops.center[1]+1;
 // Keep structure and all four wings independent, including intentional intersections.
 const structure=[...cells.values()].map(b=>({...b,layer:'structure'})),wings=[];
 const across=mid-curveSide;
 if(roof)for(let side=0;side<4;side++)for(const e of roof.blocks)for(let t=across;t<across+curveWidth;t++){
  let x=rim+e.x,z=t,axis='x',type=e.type;
  for(let turn=0;turn<side;turn++){[x,z]=[last-z,x];if(axis==='z')type=type==='left'?'right':type==='right'?'left':type;axis=axis==='x'?'z':'x';}
  wings.push({...e,x,z,y:surfaceY+e.y,axis,type,group:'curves',wing:['east','south','west','north'][side],layer:'wing-'+side});
 }
 // Corner gables: at every corner, one arm along each outer face, standing on the outer column tops (so they follow the
 // outer column height). Cell 0 of the arm profile is the post on the corner column; cells past the corner (overhang) repeat it.
 // depth layers run from `overhang` blocks outside the wall inward. Where the two arms of a corner meet in one cell with
 // different pieces, the cell becomes a full block.
 const gableCells=new Map();let gableBase=null;
 if(gables?.profile){
  const depth=integer(gables.depth??2,1,4),overhang=integer(gables.overhang??1,0,3),byCell=new Map(),reach=gables.profile.columns.length-1;gableBase=elevation+outerHeight;
  for(const t of gables.profile.blocks){if(!byCell.has(t.x))byCell.set(t.x,[]);byCell.get(t.x).push(t);}
  const mirror=type=>type==='left'?'right':type==='right'?'left':type;
  const place=(x,y,z,t,axis,flipSide,corner)=>{const key=`${x},${y},${z}`,type=flipSide?mirror(t.type):t.type,old=gableCells.get(key);
   if(old){if(old.type!==type||old.axis!==axis||!!old.flip!==!!t.flip){old.type='block';old.flip=false;}return;}
   gableCells.set(key,{x,y,z,type,flip:!!t.flip,axis,group:'gables',wing:corner,layer:'gables'});};
  for(const [cx,cz,corner]of [[0,0,'north-west'],[last,0,'north-east'],[0,last,'south-west'],[last,last,'south-east']]){
   const sx=cx===0?1:-1,sz=cz===0?1:-1;
   for(let i=-overhang;i<=reach;i++)for(let k=0;k<depth;k++)for(const t of byCell.get(Math.max(0,i))??[]){
    place(cx+sx*i,gableBase+t.y,cz-sz*(overhang-k),t,'x',sx<0,corner);
    place(cx-sx*(overhang-k),gableBase+t.y,cz+sz*i,t,'z',sz<0,corner);}
  }
 }
 const gableBlocks=[...gableCells.values()];
 const blocks=[...structure,...wings,...gableBlocks],intersections=wings.filter(b=>cells.has(`${b.x},${b.y},${b.z}`)).length;
 const bounds={minX:0,maxX:frameSize,minZ:0,maxZ:frameSize,minY:elevation,maxY:elevation};for(const b of blocks){bounds.minX=Math.min(bounds.minX,b.x);bounds.maxX=Math.max(bounds.maxX,b.x+1);bounds.minZ=Math.min(bounds.minZ,b.z);bounds.maxZ=Math.max(bounds.maxZ,b.z+1);bounds.minY=Math.min(bounds.minY,b.y);bounds.maxY=Math.max(bounds.maxY,b.y+1);}
 return {blocks,inner,outer,center,innerHeight,outerHeight,centerHeight,centerLift,beamLevel,beamY,elevation,surfaceY,curveSide,curveWidth,gableBase,gableCount:gableBlocks.length,intersections,placed:true,...bounds,groundY:0};
}
