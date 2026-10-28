import {placeRoof,occupiedVoxels} from './layout.js';
export function roofMesh(blocks,depth=1,placed=false){
 const placements=placed?blocks:placeRoof({blocks},depth).blocks,voxels=occupiedVoxels(placements),groups=new Map(),faces=[];
 for(const [key,id]of voxels){const p=key.split(',').map(Number);for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){const next=[...p];next[axis]+=sign;if(voxels.has(next.join(',')))continue;const plane=p[axis]+(sign>0?1:0),axes=[0,1,2].filter(a=>a!==axis),u=p[axes[0]],v=p[axes[1]],k=[id,axis,sign,plane].join(',');if(!groups.has(k))groups.set(k,{id,axis,sign,plane,axes,cells:new Set()});groups.get(k).cells.add(u+','+v);}}
 for(const g of groups.values())while(g.cells.size){const [u,v]=g.cells.values().next().value.split(',').map(Number);let w=1,h=1;while(g.cells.has((u+w)+','+v))w++;while(Array.from({length:w},(_,i)=>g.cells.has((u+i)+','+(v+h))).every(Boolean))h++;for(let i=0;i<w;i++)for(let j=0;j<h;j++)g.cells.delete((u+i)+','+(v+j));
 const pts=[[u,v],[u+w,v],[u+w,v+h],[u,v+h]].map(([a,b])=>{const p=[];p[g.axis]=g.plane/2;p[g.axes[0]]=a/2;p[g.axes[1]]=b/2;return p;}),normal=[0,0,0];normal[g.axis]=g.sign;faces.push({pts,normal,id:g.id,z:placements[g.id].z});}
 return faces;
}
export function createRoof3D(canvas,onSelect){
 const ctx=canvas.getContext('2d');let yaw=-.62,pitch=.38,zoom=1,offset=[0,0],drag=null,roof,depth=12,mesh=[],options={},projected=[],frame;
 const colors={block:'#a5b691',slab:'#d3b981',left:'#6b8a66',right:'#6b8a66'};
 function draw(){if(!roof||canvas.hidden||!ctx)return;const rect=canvas.getBoundingClientRect(),w=rect.width,h=rect.height;if(!w||!h)return;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  const minX=roof.minX??0,maxX=roof.maxX??Math.max(...roof.blocks.map(b=>b.x+1)),minZ=roof.minZ??0,maxZ=roof.maxZ??depth,width=maxX-minX,cy=(Math.min(roof.minY,roof.groundY??roof.minY)+roof.maxY)/2,sy=Math.sin(yaw),co=Math.cos(yaw),sp=Math.sin(pitch),cp=Math.cos(pitch),radius=Math.hypot(width,roof.maxY-Math.min(roof.minY,roof.groundY??roof.minY),maxZ-minZ)/2,scale=Math.min(w,h)/(radius*2.35)*zoom;
  const camera=[sy*cp,sp,-co*cp];
  function project([x,y,z]){x-=(minX+maxX)/2;y-=cy;z-=(minZ+maxZ)/2;const xx=co*x+sy*z,zz=sy*x-co*z;return [w/2+offset[0]+xx*scale,h/2+offset[1]-(cp*y-sp*zz)*scale,cp*zz+sp*y];}
  function path(pts){ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();}
  if(options.grid){ctx.strokeStyle='#304337';ctx.lineWidth=.7;const floor=roof.groundY??(roof.minY-1),pad=3,step=width>100?4:1;for(let x=minX-pad;x<=maxX+pad;x+=step){const a=project([x,floor,minZ-pad]),b=project([x,floor,maxZ+pad]);ctx.beginPath();ctx.moveTo(...a.slice(0,2));ctx.lineTo(...b.slice(0,2));ctx.stroke();}for(let z=minZ-pad;z<=maxZ+pad;z+=step){const a=project([minX-pad,floor,z]),b=project([maxX+pad,floor,z]);ctx.beginPath();ctx.moveTo(...a.slice(0,2));ctx.lineTo(...b.slice(0,2));ctx.stroke();}}
  projected=mesh.filter(f=>f.normal.reduce((s,n,i)=>s+n*camera[i],0)>.0001).map(f=>{const pts=f.pts.map(project);return {...f,pts,d:pts.reduce((s,p)=>s+p[2],0)/4};}).sort((a,b)=>a.d-b.d);
  ctx.globalAlpha=options.pending?.45:1;
  for(const face of projected){const e=roof.blocks[face.id],hex=options.selectedGroup&&e.group===options.selectedGroup?'#e8c98c':options.mono?'#9eaf8e':e.group==='outer'?'#88a9b6':colors[e.type],light=.72+.24*Math.max(0,face.normal[1])+.12*Math.max(0,-face.normal[2])+.07*Math.max(0,-face.normal[0]);const rgb=[1,3,5].map(i=>Math.round(parseInt(hex.slice(i,i+2),16)*light));path(face.pts);ctx.fillStyle=`rgb(${rgb})`;ctx.fill();ctx.strokeStyle='rgba(54,73,45,.27)';ctx.lineWidth=.55;ctx.stroke();}
  ctx.globalAlpha=1;
  canvas.dataset.faces=String(projected.length);canvas.dataset.depth=String(depth);canvas.dataset.yaw=String(yaw);canvas.dataset.pitch=String(pitch);
 }
 function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);}
 canvas.oncontextmenu=e=>e.preventDefault();canvas.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,yaw,pitch,offset:[...offset],pan:e.shiftKey||e.button===2,moved:false};canvas.setPointerCapture(e.pointerId);e.preventDefault();};canvas.onpointermove=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.moved||=Math.hypot(dx,dy)>3;if(drag.pan)offset=[drag.offset[0]+dx,drag.offset[1]+dy];else{yaw=drag.yaw+dx*.008;pitch=Math.max(-1.5,Math.min(1.5,drag.pitch+dy*.008));}schedule();};
 canvas.onpointerup=e=>{if(drag&&!drag.moved){const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;for(let i=projected.length-1;i>=0;i--){const f=projected[i];let inside=false;for(let j=0,k=f.pts.length-1;j<f.pts.length;k=j++){const a=f.pts[j],b=f.pts[k];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}if(inside){onSelect(roof.blocks[f.id],f.z);break;}}}drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);};canvas.onpointercancel=()=>drag=null;
 canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.3,Math.min(12,zoom*Math.exp(-e.deltaY*.001)));schedule();},{passive:false});canvas.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();yaw+=e.key==='ArrowLeft'?-.12:e.key==='ArrowRight'?.12:0;pitch=Math.max(-1.5,Math.min(1.5,pitch+(e.key==='ArrowUp'?.12:e.key==='ArrowDown'?-.12:0)));schedule();};
 return {update(r,d,o){if(r!==roof||d!==depth){roof=r;depth=d;mesh=r?roofMesh(r.blocks,d,!!r.placed):[];if(!r&&ctx)ctx.clearRect(0,0,canvas.width,canvas.height);}options=o;schedule();},zoom(factor){zoom=Math.max(.3,Math.min(12,zoom*factor));schedule();},fit(){zoom=1;offset=[0,0];schedule();},preset(name){yaw=name==='front'||name==='top'?0:-.62;pitch=name==='top'?Math.PI/2:name==='inside'?-.6:name==='front'?0:.38;zoom=1;offset=[0,0];schedule();}};
}


