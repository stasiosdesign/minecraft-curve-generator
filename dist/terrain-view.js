import {createRoof3D,cameraPreset} from './view3d.js';
// GPU view for large block terrain: one draw call with a depth buffer, so merged faces need no sorting.
// Block outlines and a slight per-block tint come from the fragment shader, keeping the block look
// without one polygon per block. Same camera model and API as createRoof3D, which is the fallback.
const vertexSource=`attribute vec3 aPos;attribute vec3 aColor;attribute vec3 aNormal;
uniform vec3 uCenter;uniform vec4 uRot;uniform vec2 uScale;uniform vec2 uShift;uniform float uDepth;
varying vec3 vColor;varying vec3 vPos;varying vec3 vNormal;
void main(){vec3 p=aPos-uCenter;float xx=uRot.y*p.x+uRot.x*p.z,zz=uRot.x*p.x-uRot.y*p.z;
gl_Position=vec4(xx*uScale.x+uShift.x,(uRot.w*p.y-uRot.z*zz)*uScale.y+uShift.y,-(uRot.w*zz+uRot.z*p.y)*uDepth,1.);
vColor=aColor;vPos=aPos;vNormal=aNormal;}`;
const fragmentSource=derivatives=>`${derivatives?'#extension GL_OES_standard_derivatives : enable\n':''}#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec3 vColor;varying vec3 vPos;varying vec3 vNormal;uniform float uPixel;uniform float uLines;
float hash(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}
void main(){vec3 n=abs(vNormal);vec2 uv=n.x>.5?vPos.yz:n.y>.5?vPos.xz:vPos.xy;
vec2 w=max(${derivatives?'fwidth(uv)':'vec2(uPixel)'},vec2(1e-4)),g=abs(fract(uv-.5)-.5)/w;
float line=(1.-clamp(min(g.x,g.y),0.,1.))*uLines;
gl_FragColor=vec4(vColor*(.95+.08*hash(floor(vPos-vNormal*.5)))*(1.-.26*line),1.);}`;
// A model is {mesh:[{pts,normal,material}], materials:[name], minX..maxZ, groundY}.
export function createTerrainView(canvas){
 let gl=null;try{gl=canvas.getContext('webgl',{antialias:true,alpha:true,premultipliedAlpha:true});}catch{}
 if(!gl)return canvasFallback(canvas);
 let yaw=-.62,pitch=.38,zoom=1,offset=[0,0],drag=null,model=null,colorKey='',options={},frame=0,program=null,buffer=null,count=0,lost=false,uniforms={},attributes={};
 function compile(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s)??'Shader failed');return s;}
 function init(){
  const derivatives=!!gl.getExtension('OES_standard_derivatives');program=gl.createProgram();
  gl.attachShader(program,compile(gl.VERTEX_SHADER,vertexSource));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragmentSource(derivatives)));gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program)??'Program failed');
  for(const name of ['uCenter','uRot','uScale','uShift','uDepth','uPixel','uLines'])uniforms[name]=gl.getUniformLocation(program,name);
  for(const name of ['aPos','aColor','aNormal'])attributes[name]=gl.getAttribLocation(program,name);
  buffer=gl.createBuffer();colorKey='';
 }
 // Interleaved position, lit colour and normal; two triangles per merged face.
 function upload(){
  const palette=options.groupColors??{},key=JSON.stringify(palette);if(!model||key===colorKey)return;colorKey=key;
  const rgb=model.materials.map(name=>{const hex=palette[name]??'#888888';return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);});
  const data=new Float32Array(model.mesh.length*6*9);let o=0;
  for(const f of model.mesh){const [nx,ny,nz]=f.normal,light=.72+.24*Math.max(0,ny)+.12*Math.max(0,-nz)+.07*Math.max(0,-nx),c=rgb[f.material];
   for(const k of [0,1,2,0,2,3]){const p=f.pts[k];data.set([p[0],p[1],p[2],c[0]*light,c[1]*light,c[2]*light,nx,ny,nz],o);o+=9;}}
  count=model.mesh.length*6;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
 }
 function draw(){
  if(!model||lost||canvas.hidden)return;const rect=canvas.getBoundingClientRect(),w=rect.width,h=rect.height;if(!w||!h)return;
  const dpr=Math.min(devicePixelRatio||1,2),W=Math.round(w*dpr),H=Math.round(h*dpr);if(canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H;}
  upload();gl.viewport(0,0,W,H);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
  const low=Math.min(model.minY,model.groundY??model.minY),cx=(model.minX+model.maxX)/2,cy=(low+model.maxY)/2,cz=(model.minZ+model.maxZ)/2;
  const radius=Math.hypot(model.maxX-model.minX,model.maxY-low,model.maxZ-model.minZ)/2,scale=Math.min(w,h)/(radius*2.35)*zoom;
  gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  [['aPos',0],['aColor',3],['aNormal',6]].forEach(([name,at])=>{gl.enableVertexAttribArray(attributes[name]);gl.vertexAttribPointer(attributes[name],3,gl.FLOAT,false,36,at*4);});
  gl.uniform3f(uniforms.uCenter,cx,cy,cz);gl.uniform4f(uniforms.uRot,Math.sin(yaw),Math.cos(yaw),Math.sin(pitch),Math.cos(pitch));
  gl.uniform2f(uniforms.uScale,2*scale/w,2*scale/h);gl.uniform2f(uniforms.uShift,2*offset[0]/w,-2*offset[1]/h);gl.uniform1f(uniforms.uDepth,1/(radius*1.05));
  // Outlines fade out once a block is only a few pixels wide.
  gl.uniform1f(uniforms.uPixel,1/(scale*dpr));gl.uniform1f(uniforms.uLines,Math.max(0,Math.min(1,(scale-3)/6)));
  gl.drawArrays(gl.TRIANGLES,0,count);
  Object.assign(canvas.dataset,{renderer:'webgl',faces:String(model.mesh.length),yaw:String(yaw),pitch:String(pitch)});
 }
 function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);}
 try{init();}catch{return canvasFallback(canvas,true);}
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;});
 canvas.addEventListener('webglcontextrestored',()=>{lost=false;init();schedule();});
 canvas.oncontextmenu=e=>e.preventDefault();
 canvas.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,yaw,pitch,offset:[...offset],pan:e.shiftKey||e.button===2};canvas.setPointerCapture(e.pointerId);e.preventDefault();};
 canvas.onpointermove=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(drag.pan)offset=[drag.offset[0]+dx,drag.offset[1]+dy];else{yaw=drag.yaw+dx*.008;pitch=Math.max(-1.5,Math.min(1.5,drag.pitch+dy*.008));}schedule();};
 canvas.onpointerup=canvas.onpointercancel=e=>{drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);};
 canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.3,Math.min(12,zoom*Math.exp(-e.deltaY*.001)));schedule();},{passive:false});
 canvas.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();yaw+=e.key==='ArrowLeft'?-.12:e.key==='ArrowRight'?.12:0;pitch=Math.max(-1.5,Math.min(1.5,pitch+(e.key==='ArrowUp'?.12:e.key==='ArrowDown'?-.12:0)));schedule();};
 return {renderer:'webgl',getState:()=>({yaw,pitch,zoom,offset:[...offset]}),setState(s){({yaw,pitch,zoom}=s);offset=[...s.offset];schedule();},
  update(m,_depth,o={}){if(m!==model){model=m;colorKey='';}options=o;schedule();},
  zoom(f){zoom=Math.max(.3,Math.min(12,zoom*f));schedule();},fit(){zoom=1;offset=[0,0];schedule();},preset(name){({yaw,pitch,zoom,offset}=cameraPreset(name));schedule();}};
}
// Without WebGL, the Canvas 2D roof view draws the same terrain from smaller faces (painter's sorting needs them).
function canvasFallback(canvas,usedWebGL=false){
 // A canvas that already handed out a WebGL context cannot switch to 2D, so swap in a fresh one.
 if(usedWebGL){const fresh=canvas.cloneNode(false);canvas.replaceWith(fresh);canvas=fresh;}
 const view=createRoof3D(canvas,()=>{});let source=null,adapted=null;
 return {...view,renderer:'canvas',update(m,depth,o){if(m!==source){source=m;adapted=m&&{...m,blocks:m.materials.map(group=>({group,type:'block'})),mesh:(m.meshWith?.(2)??m.mesh).map(f=>({...f,id:f.material,z:f.pts[0][2]}))};}view.update(adapted,depth,o);}};
}
