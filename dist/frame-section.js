import {forEachVoxel} from './layout.js';
// True orthographic section on half-block cells (h = horizontal, y = vertical, both in half blocks).
// axis 'z': plane z = cut + 0.5 seen from the south, east on the right. axis 'x': plane x = cut + 0.5 seen from the west, south on the right.
export function frameSection(model,{axis='z',cut=12}={}){
 const front=axis==='z'?2*cut:2*cut+1,cutItems=[],farItems=[];
 model.blocks.forEach((block,id)=>{const cells=[],far=[];let distance=Infinity;
  forEachVoxel(block,(vx,vy,vz)=>{const d=axis==='z'?vz:vx,h=axis==='z'?vx:vz;if(d===front)cells.push([h,vy]);else if(axis==='z'?d<front:d>front){far.push([h,vy]);distance=Math.min(distance,Math.abs(d-front));}});
  if(cells.length)cutItems.push({id,block,cells});if(far.length)farItems.push({id,block,cells:far,distance});});
 // Each half-cell belongs to one element: the cut element, or else the nearest element beyond the plane.
 const cutOwner=new Map(),beyond=new Map();
 for(const item of cutItems)for(const [h,y]of item.cells)cutOwner.set(h+','+y,item);
 farItems.sort((a,b)=>a.distance-b.distance);
 for(const item of farItems)for(const [h,y]of item.cells){const k=h+','+y;if(!beyond.has(k))beyond.set(k,item);}
 return {axis,cut,cutOwner,beyond};
}
const shade=(hex,f)=>`rgb(${[1,3,5].map(i=>Math.round(parseInt(hex.slice(i,i+2),16)*f+8*(1-f)))})`;
const sides=[[1,0,1,0,1,1],[-1,0,0,0,0,1],[0,1,0,1,1,1],[0,-1,0,0,1,0]];
export function createSectionView(canvas,{onPick=()=>{},onHover=()=>{}}={}){
 const ctx=canvas.getContext('2d');let model=null,section=null,options={},zoom=1,offset=[0,0],drag=null,frame=0,hover=null;
 function geometry(){
  const rect=canvas.getBoundingClientRect(),w=rect.width,h=rect.height,axis=section.axis,minH=axis==='z'?model.minX:model.minZ,maxH=axis==='z'?model.maxX:model.maxZ,minY=model.minY,maxY=model.maxY,pad={l:48,r:18,t:64,b:34};
  const aw=Math.max(10,w-pad.l-pad.r),ah=Math.max(10,h-pad.t-pad.b),scale=Math.min(aw/(maxH-minH+2),ah/(maxY-minY+2))*zoom,cx=pad.l+aw/2+offset[0],cy=pad.t+ah/2+offset[1],hc=(minH+maxH)/2,yc=(minY+maxY)/2;
  return {w,h,minH,maxH,minY,maxY,pad,scale,cx,cy,sx:v=>cx+(v-hc)*scale,sy:v=>cy-(v-yc)*scale,hx:x=>(x-cx)/scale+hc,vy:y=>(cy-y)/scale+yc};
 }
 function paint(g,owners,fill,innerStroke,outerStroke,outerWidth){
  const half=g.scale/2,fills=new Map(),inner=new Path2D(),outer=new Path2D();
  for(const [k,item]of owners){const [h,y]=k.split(',').map(Number),c=fill(item);if(!fills.has(c))fills.set(c,new Path2D());fills.get(c).rect(g.sx(h/2),g.sy((y+1)/2),half,half);
   for(const [dh,dy,ax,ay,bx,by]of sides){const n=owners.get((h+dh)+','+(y+dy));if(n===item||(n&&dh+dy<0))continue;const p=n?inner:outer;p.moveTo(g.sx((h+ax)/2),g.sy((y+ay)/2));p.lineTo(g.sx((h+bx)/2),g.sy((y+by)/2));}}
  for(const [c,p]of fills){ctx.fillStyle=c;ctx.fill(p);}
  ctx.lineCap='square';ctx.strokeStyle=innerStroke;ctx.lineWidth=1;ctx.stroke(inner);ctx.strokeStyle=outerStroke;ctx.lineWidth=outerWidth;ctx.stroke(outer);
 }
 function draw(){
  if(!section||!model||canvas.hidden||!ctx)return;const g=geometry();if(!g.w||!g.h)return;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(g.w*dpr);canvas.height=Math.round(g.h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,g.w,g.h);
  const colors=options.groupColors??{},sel=options.selectedGroup,color=b=>colors[b.group]??'#b0b0b0';
  if(options.grid&&g.scale>4){ctx.strokeStyle='#1d1d1d';ctx.lineWidth=1;ctx.beginPath();for(let v=Math.floor(g.hx(0));v<=Math.ceil(g.hx(g.w));v++){const x=Math.round(g.sx(v))+.5;ctx.moveTo(x,0);ctx.lineTo(x,g.h);}for(let v=Math.floor(g.vy(g.h));v<=Math.ceil(g.vy(0));v++){const y=Math.round(g.sy(v))+.5;ctx.moveTo(0,y);ctx.lineTo(g.w,y);}ctx.stroke();}
  ctx.globalAlpha=options.pending?.45:1;
  // Elevation beyond the cut: muted, but still outlined block by block.
  paint(g,section.beyond,item=>sel?(item.block.group===sel?'#5c5c5c':'#141414'):shade(color(item.block),.34),'rgba(255,255,255,.08)','rgba(255,255,255,.2)',1);
  // Cut elements: full colour, dark joints between blocks, heavy light profile line.
  paint(g,section.cutOwner,item=>sel?(item.block.group===sel?'#e4e4e4':'#3a3a3a'):color(item.block),'rgba(0,0,0,.6)','#f0f0f0',1.6);
  if(hover){const own=hover.cut?section.cutOwner:section.beyond,p=new Path2D();for(const [h,y]of hover.item.cells){if(own.get(h+','+y)!==hover.item)continue;for(const [dh,dy,ax,ay,bx,by]of sides){if(own.get((h+dh)+','+(y+dy))===hover.item)continue;p.moveTo(g.sx((h+ax)/2),g.sy((y+ay)/2));p.lineTo(g.sx((h+bx)/2),g.sy((y+by)/2));}}ctx.strokeStyle='#ffffff';ctx.lineWidth=2.4;ctx.stroke(p);}
  ctx.globalAlpha=1;
  // Base line and axis labels on solid gutters so they stay legible while panning.
  ctx.setLineDash([5,4]);ctx.strokeStyle='#6b6b6b';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,Math.round(g.sy(model.elevation??g.minY))+.5);ctx.lineTo(g.w,Math.round(g.sy(model.elevation??g.minY))+.5);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='rgba(8,8,8,.88)';ctx.fillRect(0,0,g.pad.l-6,g.h);ctx.fillRect(0,g.h-g.pad.b+8,g.w,g.pad.b);
  ctx.font='11px system-ui,sans-serif';ctx.fillStyle='#9a9a9a';ctx.textBaseline='middle';
  const yStep=g.scale>=16?1:g.scale>=7?5:10;ctx.textAlign='right';for(let v=Math.ceil(g.minY/yStep)*yStep;v<g.maxY;v+=yStep){const y=g.sy(v+.5);if(y>g.pad.t-20&&y<g.h-g.pad.b)ctx.fillText('Y '+v,g.pad.l-12,y);}
  const hStep=g.scale>=22?1:g.scale>=11?2:5,label=section.axis==='z'?'x':'z';ctx.textAlign='center';for(let v=Math.ceil(g.minH/hStep)*hStep;v<g.maxH;v+=hStep){const x=g.sx(v+.5);if(x>g.pad.l&&x<g.w)ctx.fillText(v===Math.ceil(g.minH/hStep)*hStep?label+' '+v:String(v),x,g.h-g.pad.b/2+4);}
  canvas.dataset.cut=String(section.cutOwner.size);canvas.dataset.beyond=String(section.beyond.size);
 }
 function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);}
 function hit(e){if(!section||!model)return null;const r=canvas.getBoundingClientRect(),g=geometry(),k=Math.floor(g.hx(e.clientX-r.left)*2)+','+Math.floor(g.vy(e.clientY-r.top)*2),c=section.cutOwner.get(k);return c?{item:c,cut:true}:section.beyond.has(k)?{item:section.beyond.get(k),cut:false}:null;}
 function setHover(next){if((next?.item)===(hover?.item))return;hover=next;schedule();onHover(next?{block:next.item.block,cut:next.cut}:null);}
 canvas.oncontextmenu=e=>e.preventDefault();
 canvas.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,offset:[...offset],moved:false};canvas.setPointerCapture(e.pointerId);e.preventDefault();};
 canvas.onpointermove=e=>{if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.moved||=Math.hypot(dx,dy)>3;if(drag.moved){offset=[drag.offset[0]+dx,drag.offset[1]+dy];schedule();}return;}if(e.pointerType==='mouse')setHover(hit(e));};
 canvas.onpointerup=e=>{if(drag&&!drag.moved){const h=hit(e);if(h)onPick(h.item.block,h.cut);}drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);};
 canvas.onpointercancel=()=>drag=null;canvas.onpointerleave=()=>{if(!drag)setHover(null);};
 function zoomAt(factor,x,y){if(!section||!model)return;const g=geometry(),next=Math.max(.5,Math.min(16,zoom*factor)),f=next/zoom;offset=[x-(x-g.cx)*f-(g.cx-offset[0]),y-(y-g.cy)*f-(g.cy-offset[1])];zoom=next;schedule();}
 canvas.addEventListener('wheel',e=>{e.preventDefault();const r=canvas.getBoundingClientRect();zoomAt(Math.exp(-e.deltaY*.0015),e.clientX-r.left,e.clientY-r.top);},{passive:false});
 canvas.onkeydown=e=>{const d={ArrowLeft:[40,0],ArrowRight:[-40,0],ArrowUp:[0,40],ArrowDown:[0,-40]}[e.key];if(!d)return;e.preventDefault();offset=[offset[0]+d[0],offset[1]+d[1]];schedule();};
 return {update(m,s,o){if(s!==section)hover=null;model=m;section=s;options=o;schedule();},zoom(f){const r=canvas.getBoundingClientRect();zoomAt(f,r.width/2,r.height/2);},fit(){zoom=1;offset=[0,0];schedule();}};
}
