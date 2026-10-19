export function curve(p){
 let w=p.width,h=p.height,fn;const base=4;
 if(p.type==='circle'){const a=p.extent*Math.PI/360,r=p.radius;w=2*r*Math.sin(a);h=r*(1-Math.cos(a));fn=x=>base+Math.sqrt(Math.max(0,r*r-(x-w/2)**2))-r*Math.cos(a);}
 else if(p.type==='ellipse')fn=x=>base+h*Math.sqrt(Math.max(0,1-(2*x/w-1)**2));
 else {const left=p.left??4,right=p.right??4,middle=p.middle??16,control=2*middle-(left+right)/2;fn=x=>{const t=x/w;return (1-t)**2*left+2*(1-t)*t*control+t*t*right;};}
 const thickness=p.thickness??2,points=Array.from({length:513},(_,i)=>[w*i/512,fn(w*i/512)]),inner=points.map(([x,y])=>[x,y-thickness]);
 return {w,h:Math.max(...points.map(a=>a[1])),min:Math.min(...inner.map(a=>a[1])),fn,points,inner,thickness,handles:[[0,fn(0)],[w/2,fn(w/2)],[w,fn(w)]]};
}
