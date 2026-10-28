// All dimensions count occupied blocks, including the base perimeter layer.
export function createFrame({innerHeight=15,outerHeight=6,elevation=20}={}){
 const integer=(v,min,max)=>Math.max(min,Math.min(max,Math.round(Number(v)||0)));
 innerHeight=integer(innerHeight,1,64);outerHeight=integer(outerHeight,1,64);elevation=integer(elevation,0,64);
 const inner=[],outer=[],positions=[4,8,13,17],seen=new Set();
 for(const t of positions)for(const [x,z]of [[t,4],[t,17],[4,t],[17,t]]){const key=x+','+z;if(!seen.has(key)){seen.add(key);inner.push([x,z]);}}
 for(const t of positions)outer.push([t,0],[t,21],[0,t],[21,t]);
 const cells=new Map();
 const add=(x,y,z,group,pillar=false)=>cells.set(`${x},${y},${z}`,{x,y,z,type:'block',axis:'x',group,pillar});
 for(const [lo,hi,group]of [[0,21,'outer'],[4,17,'inner']])for(let t=lo;t<=hi;t++)for(const [x,z]of [[t,lo],[t,hi],[lo,t],[hi,t]])add(x,elevation,z,group);
 for(const [pillars,height,group]of [[inner,innerHeight,'inner'],[outer,outerHeight,'outer']])for(const [x,z]of pillars)for(let y=elevation;y<elevation+height;y++)add(x,y,z,group,true);
 return {blocks:[...cells.values()],inner,outer,innerHeight,outerHeight,elevation,placed:true,minX:0,maxX:22,minZ:0,maxZ:22,minY:elevation,maxY:elevation+Math.max(innerHeight,outerHeight),groundY:0};
}
