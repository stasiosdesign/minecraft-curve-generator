// Dimensions and heights count occupied blocks, including the perimeter layer.
export function createFrame({innerHeight=15,outerHeight=6,centerHeight=20,elevation=20,roof=null}={}){
 const integer=(v,min,max)=>Math.max(min,Math.min(max,Math.round(Number(v)||0)));
 innerHeight=integer(innerHeight,1,64);outerHeight=integer(outerHeight,1,64);centerHeight=integer(centerHeight,1,64);elevation=integer(elevation,0,64);
 const inner=[],outer=[],center=[[8,8],[8,12],[12,8],[12,12]],positions=[4,8,12,16],seen=new Set();
 for(const t of positions)for(const [x,z]of [[t,4],[t,16],[4,t],[16,t]]){const key=x+','+z;if(!seen.has(key)){seen.add(key);inner.push([x,z]);}}
 for(const t of positions)outer.push([t,0],[t,20],[0,t],[20,t]);
 const cells=new Map();
 const add=(x,y,z,group,pillar=false)=>cells.set(`${x},${y},${z}`,{x,y,z,type:'block',axis:'x',group,pillar});
 for(let x=0;x<21;x++)for(let z=0;z<21;z++)if(x<=4||x>=16||z<=4||z>=16)add(x,elevation,z,'deck');
 for(let t=8;t<=12;t++)for(const [x,z]of [[t,8],[t,12],[8,t],[12,t]])add(x,elevation,z,'center');
 for(const [pillars,height,group]of [[inner,innerHeight,'inner'],[outer,outerHeight,'outer'],[center,centerHeight,'center']])for(const [x,z]of pillars)for(let y=elevation;y<elevation+height;y++)add(x,y,z,group,true);
 const surfaceY=elevation+centerHeight;
 for(let x=8;x<=12;x++)for(let z=8;z<=12;z++)add(x,surfaceY-1,z,'center');
 let intersections=0;
 // Each wing is five blocks wide; the first column rests on the platform rim.
 if(roof)for(const e of roof.blocks)for(let t=8;t<=12;t++)for(const [x,z,axis,reverse,wing]of [[12+e.x,t,'x',false,'east'],[8-e.x,t,'x',true,'west'],[t,12+e.x,'z',false,'south'],[t,8-e.x,'z',true,'north']]){
  const b={...e,x,z,y:surfaceY+e.y,axis,group:'curves',wing,type:reverse?(e.type==='left'?'right':e.type==='right'?'left':e.type):e.type},key=`${x},${b.y},${z}`;
  if(cells.has(key)){if(cells.get(key).group!=='curves')intersections++;continue;}cells.set(key,b);
 }
 const blocks=[...cells.values()];
 return {blocks,inner,outer,center,innerHeight,outerHeight,centerHeight,elevation,surfaceY,intersections,placed:true,minX:Math.min(0,...blocks.map(b=>b.x)),maxX:Math.max(21,...blocks.map(b=>b.x+1)),minZ:Math.min(0,...blocks.map(b=>b.z)),maxZ:Math.max(21,...blocks.map(b=>b.z+1)),minY:Math.min(elevation,...blocks.map(b=>b.y)),maxY:Math.max(...blocks.map(b=>b.y+1)),groundY:0};
}
