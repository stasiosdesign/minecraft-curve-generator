// Dimensions and heights count occupied blocks, including the perimeter layer.
export function createFrame({innerHeight=9,outerHeight=5,centerHeight=11,elevation=20,roof=null,curveWidth=5}={}){
 const integer=(v,min,max)=>Math.max(min,Math.min(max,Math.round(Number(v)||0)));
 innerHeight=integer(innerHeight,1,64);outerHeight=integer(outerHeight,1,64);centerHeight=integer(centerHeight,1,64);elevation=integer(elevation,0,64);
 curveWidth=integer(curveWidth,1,21);
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
 // Keep structure and all four wings independent, including intentional intersections.
 const structure=[...cells.values()].map(b=>({...b,layer:'structure'})),wings=[];
 const across=10-Math.floor((curveWidth-1)/2);
 if(roof)for(let side=0;side<4;side++)for(const e of roof.blocks)for(let t=across;t<across+curveWidth;t++){
  let x=13+e.x,z=t,axis='x',type=e.type;
  for(let turn=0;turn<side;turn++){[x,z]=[20-z,x];if(axis==='z')type=type==='left'?'right':type==='right'?'left':type;axis=axis==='x'?'z':'x';}
  wings.push({...e,x,z,y:surfaceY+e.y,axis,type,group:'curves',wing:['east','south','west','north'][side],layer:'wing-'+side});
 }
 const blocks=[...structure,...wings],intersections=wings.filter(b=>cells.has(`${b.x},${b.y},${b.z}`)).length;
 return {blocks,inner,outer,center,innerHeight,outerHeight,centerHeight,elevation,surfaceY,curveWidth,intersections,placed:true,minX:Math.min(0,...blocks.map(b=>b.x)),maxX:Math.max(21,...blocks.map(b=>b.x+1)),minZ:Math.min(0,...blocks.map(b=>b.z)),maxZ:Math.max(21,...blocks.map(b=>b.z+1)),minY:Math.min(elevation,...blocks.map(b=>b.y)),maxY:Math.max(...blocks.map(b=>b.y+1)),groundY:0};
}
