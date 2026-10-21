export function curve(p){
 let w=p.width,h=p.height,fn,bend=.5;const base=4;
 if(p.type==='circle'){const a=p.extent*Math.PI/360,r=p.radius;w=2*r*Math.sin(a);h=r*(1-Math.cos(a));fn=x=>base+Math.sqrt(Math.max(0,r*r-(x-w/2)**2))-r*Math.cos(a);}
 else if(p.type==='ellipse')fn=x=>base+h*Math.sqrt(Math.max(0,1-(2*x/w-1)**2));
 else {bend=Math.max(.1,Math.min(.9,(p.bend??50)/100));const left=p.left??4,right=p.right??4,middle=p.middle??16,control=2*middle-(left+right)/2;fn=x=>{const u=x/w;
 // Monotone parameter mapping moves the bend without loops or a tangent seam.
 const t=(1-bend)*u/(bend+(1-2*bend)*u);return (1-t)**2*left+2*(1-t)*t*control+t*t*right;};}
 // Centre symmetric references on a valid grid reflection axis without changing their shape.
 const symmetric=p.type!=='custom'||(Math.abs((p.left??4)-(p.right??4))<1e-9&&Math.abs(bend-.5)<1e-9);
 const span=w,gridWidth=symmetric?(p.layout==='diagonal'?(Math.max(1,Math.ceil(w*Math.SQRT2-1e-9)-1)+1)/Math.SQRT2:Math.ceil(w-1e-9)):w,offset=(gridWidth-span)/2,raw=fn;
 fn=x=>raw(Math.max(0,Math.min(span,x-offset)));
 const thickness=p.thickness??2,points=Array.from({length:513},(_,i)=>[offset+span*i/512,fn(offset+span*i/512)]),inner=points.map(([x,y])=>[x,y-thickness]);
 return {w:gridWidth,span,offset,symmetric,h:Math.max(...points.map(a=>a[1])),min:Math.min(...inner.map(a=>a[1])),fn,points,inner,thickness,handles:[[offset,fn(offset)],[offset+span*bend,fn(offset+span*bend)],[offset+span,fn(offset+span)]]};
}
