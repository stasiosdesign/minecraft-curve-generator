// Chunky terraced ravine on a typed voxel grid.
// The envelope matches the original design: 37-block river gap, 78-block gap at the rim (Y 49),
// summits up to Y 57, outer flanks about 66-71 blocks from the centre, 36 blocks along the river.
// Detail is deliberately coarse: cliffs step in 4-block terraces, relief changes every 6 blocks along
// the river and materials follow bands, so equal faces merge into a few large quads.
export const ravineDepth=36;
const rim=49,band=4,chunk=6,chunks=ravineDepth/chunk,top=57;
export const ravineMaterials=['','rock','rock-light','rock-dark','strata','grass','soil','gravel','riverbed','water'];
const id=Object.fromEntries(ravineMaterials.map((name,i)=>[name,i]));
// Summit heights for each 6-block stretch along the river (left, right flank), taken from the original terrain.
const peaks={left:[57,57,57,54,57,57],right:[57,56,54,56,57,57]},summitWidth=5;
export function ravineGap(y){return Math.round(37+41*(Math.max(0,Math.min(rim,y))/rim)**.9);}
const terrace=y=>y<=0?0:Math.floor((Math.min(y,rim)-1)/band)+1;
const terraceBase=y=>{const t=terrace(y);return t?band*(t-1)+1:0;};
const stretch=z=>Math.max(0,Math.min(chunks-1,Math.floor(z/chunk)));
// Inner cliff edges: [first open x, first rock x on the right]. Constant across each terrace and stretch.
export function ravineEdges(y,z){
 const base=terraceBase(y),t=terrace(y),c=stretch(z),gap=ravineGap(base),rough=Math.sin(Math.PI*base/rim);
 const meander=Math.round(2*Math.sin((c*chunk+chunk/2)*.19));
 const left=-Math.floor(gap/2)+meander-Math.round(rough*2*Math.sin(c*1.7+t*.9));
 const right=-Math.floor(gap/2)+meander+gap+Math.round(rough*2*Math.sin(c*2.3-t*.7+1));
 return [left,right];
}
// Outer flank: tapers from about 66 blocks out at the river to about 51 at the summits.
function outerEdge(y,c,side){const lean=side<0?3*Math.sin(c*1.5)+2:3*Math.sin(c*1.2+1.6)+2;return Math.round(66-15*(Math.min(y,top)/50)**1.4+lean);}
const hash=(a,b,c)=>{const n=Math.sin(a*12.9898+b*37.719+c*78.233)*43758.5453;return n-Math.floor(n);};
export function createRavine(){
 const minX=-73,maxX=74,minY=-1,maxY=top+1,nx=maxX-minX,ny=maxY-minY,nz=ravineDepth,cells=new Uint8Array(nx*ny*nz);
 const index=(x,y,z)=>(x-minX)+nx*((y-minY)+ny*z);
 const set=(x,y,z,m)=>{cells[index(x,y,z)]=m;};
 const at=(x,y,z)=>x<minX||x>=maxX||y<minY||y>=maxY||z<0||z>=nz?0:cells[index(x,y,z)];
 // Rock body: each flank is a stack of terraces; above the rim the summits narrow in 2-block tiers.
 const body=y=>y<=3?id['rock-dark']:y>=53?id['rock-light']:y%14>=8&&y%14<=9?id.strata:id.rock;
 for(let z=0;z<nz;z++){
  const c=stretch(z),zc=c*chunk+chunk/2;
  for(let y=0;y<=top;y++){
   let [left,right]=ravineEdges(y,z);const tierY=y>rim?rim+2*Math.ceil((y-rim)/2):terraceBase(y);
   if(y>rim){const rise=tierY-rim;left-=Math.ceil(rise*(1.1+.3*Math.sin(zc*.4)));right+=Math.ceil(rise*(1.2+.3*Math.cos(zc*.3)));}
   const outerLeft=-outerEdge(tierY,c,-1),outerRight=outerEdge(tierY,c,1);
   // Summits keep a crest instead of thinning out below their designed height.
   if(y>rim){left=Math.max(left,outerLeft+summitWidth);right=Math.min(right,outerRight-summitWidth);}
   if(y<=peaks.left[c])for(let x=outerLeft;x<left;x++)set(x,y,z,body(y));
   if(y<=peaks.right[c])for(let x=right;x<outerRight;x++)set(x,y,z,body(y));
  }
  const [left,right]=ravineEdges(0,z);
  for(let x=left;x<right;x++){set(x,-1,z,id.riverbed);set(x,0,z,id.water);}
 }
 // Exposed upper ledges: grass with a soil band beneath, gravel patches per terrace, bare rock on the summits.
 for(let z=0;z<nz;z++)for(let x=minX;x<maxX;x++)for(let y=top;y>30;y--){
  if(!at(x,y,z))continue;
  const cover=y>52?id['rock-light']:hash(stretch(z),terrace(y),Math.sign(x))<.25?id.gravel:id.grass;set(x,y,z,cover);
  if(cover===id.grass)for(let d=1;d<=2;d++)if(at(x,y-d,z))set(x,y-d,z,id.soil);
  break;
 }
 const mesh=greedyMesh(at,[minX,minY,0],[maxX,maxY,nz]);
 let solid=0,water=0;for(const m of cells){if(m)solid++;if(m===id.water)water++;}
 let lo=Infinity,hi=-Infinity;for(const f of mesh)for(const p of f.pts){lo=Math.min(lo,p[0]);hi=Math.max(hi,p[0]);}
 return {materials:ravineMaterials,materialAt:(x,y,z)=>ravineMaterials[at(x,y,z)],mesh,meshWith:limit=>greedyMesh(at,[minX,minY,0],[maxX,maxY,nz],limit),solid,water,placed:true,minX:lo,maxX:hi,minY,maxY,minZ:0,maxZ:nz,groundY:minY,dimensions:{height:50,bottomGap:37,topGap:78,depth:nz}};
}
// Merge exposed faces of equal material into rectangles, one plane at a time. `max` limits a rectangle's
// side (the Canvas fallback sorts faces by depth, which needs small faces); the WebGL view uses no limit.
export function greedyMesh(at,min,max,limit=Infinity){
 const faces=[],size=[0,1,2].map(a=>max[a]-min[a]);
 for(let d=0;d<3;d++){
  const u=(d+1)%3,v=(d+2)%3,du=size[u],dv=size[v],mask=new Uint8Array(du*dv),p=[0,0,0];
  for(const sign of [-1,1])for(let s=0;s<size[d];s++){
   p[d]=min[d]+s;
   for(let j=0;j<dv;j++)for(let i=0;i<du;i++){p[u]=min[u]+i;p[v]=min[v]+j;const m=at(p[0],p[1],p[2]);let open=false;if(m){p[d]+=sign;open=!at(p[0],p[1],p[2]);p[d]-=sign;}mask[i+j*du]=open?m:0;}
   const plane=min[d]+s+(sign>0?1:0);
   for(let j=0;j<dv;j++)for(let i=0;i<du;){
    const m=mask[i+j*du];if(!m){i++;continue;}
    let w=1;while(i+w<du&&w<limit&&mask[i+w+j*du]===m)w++;
    let h=1;grow:while(j+h<dv&&h<limit){for(let k=0;k<w;k++)if(mask[i+k+(j+h)*du]!==m)break grow;h++;}
    for(let b=0;b<h;b++)mask.fill(0,i+(j+b)*du,i+w+(j+b)*du);
    const corner=(a,b)=>{const q=[0,0,0];q[d]=plane;q[u]=min[u]+a;q[v]=min[v]+b;return q;},normal=[0,0,0];normal[d]=sign;
    faces.push({pts:[corner(i,j),corner(i+w,j),corner(i+w,j+h),corner(i,j+h)],normal,material:m});
    i+=w;
   }
  }
 }
 return faces;
}
