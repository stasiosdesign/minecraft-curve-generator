import {curve} from './curves.js';
export const curveDefaults={type:'circle',radius:20,extent:120,width:32,height:12,left:4,middle:16,bend:50,right:4,thickness:2,extraEnabled:false,extraPosition:75,extraHeight:12};
export const curveSpecs={circle:[['radius','Radius',2,128,.5],['extent','Arc',10,180,1]],ellipse:[['width','Width',4,128,.5],['height','Rise',1,64,.5]],custom:[['width','Width',4,128,.5],['middle','Bend height',-32,96,.5],['right','End height',-32,96,.5],['bend','Bend position %',10,90,1]]};
const editClamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function changeCurveType(p,type,{lockStart=false}={}){const c=curve(p),base=lockStart?c.handles[0][1]:0;return {...p,type,extraEnabled:type==='custom'&&!!p.extraEnabled,width:editClamp(c.span??c.w,4,128),height:editClamp(c.h-c.handles[0][1],1,64),bend:100*(c.handles[1][0]-(c.offset??0))/(c.span??c.w),left:c.handles[0][1]-base,middle:c.handles[1][1]-base,right:c.handles[2][1]-base};}
export function mountCurveControls(container,p,onChange,{prefix='',centerLocked=false}={}){
 container.innerHTML=curveSpecs[p.type].map(([key,label,min,max,step])=>`<div class="control"><div class="control-head"><label for="${prefix}${key}-range">${label}</label><input id="${prefix}${key}-number" aria-label="${label}" type="number" min="${min}" max="${max}" step="${step}" value="${Number(p[key].toFixed(2))}"></div><input id="${prefix}${key}-range" aria-label="${label}" type="range" min="${min}" max="${max}" step="${step}" value="${p[key]}"></div>`).join('');
 for(const [key,,min,max]of curveSpecs[p.type])for(const suffix of ['range','number']){const input=container.querySelector('#'+prefix+key+'-'+suffix);input.disabled=key==='bend'&&centerLocked;input.oninput=()=>{if(input.value===''||!Number.isFinite(+input.value))return;const value=editClamp(+input.value,min,max);container.querySelector('#'+prefix+key+'-'+(suffix==='range'?'number':'range')).value=value;onChange(key,value);};}
}
export function editCurveHandle(original,index,dx,dy,{center=false,lockStart=false,originalCurve=curve(original)}={}){
 if(lockStart&&index===0)return {...original};
 let p;
 if(index===3){const w=originalCurve.span??originalCurve.w;return {...original,type:'custom',extraEnabled:true,extraPosition:separatePoint(editClamp((original.extraPosition??75)+100*dx/w,5,95),original.bend??50,original.extraPosition??75),extraHeight:editClamp((original.extraHeight??12)+dy,-32,96)};}
 if(index===1&&(center))dx=originalCurve.w/2-originalCurve.handles[1][0];
 p={...original};const w=editClamp((originalCurve.span??originalCurve.w)+(index===0?-dx:index===2?dx:0),4,128),hs=originalCurve.handles.map(a=>a[1]);
 if(index===1&&(original.type==='custom'||Math.abs(dx)>.2)){p.type='custom';p.width=w;p.left=hs[0];p.right=hs[2];p.middle=editClamp(hs[1]+dy,-32,96);p.bend=editClamp(100*(originalCurve.handles[1][0]-(originalCurve.offset??0)+dx)/w,10,90);}
 else if(index!==1&&Math.abs(dy)>.2){p.type='custom';p.width=w;p.bend=100*(originalCurve.handles[1][0]-(originalCurve.offset??0))/(originalCurve.span??originalCurve.w);p.left=hs[0];p.middle=hs[1];p.right=hs[2];p[index===0?'left':'right']=editClamp(hs[index]+dy,-32,96);}
 else if(p.type==='circle'){
  if(index===1){const rise=editClamp(hs[1]+dy-4,Math.max(.2,w*w/1024),w/2);p.radius=(w*w/4+rise*rise)/(2*rise);p.extent=4*Math.atan(2*rise/w)*180/Math.PI;}
  else p.radius=editClamp(w/(2*Math.sin(p.extent*Math.PI/360)),2,128);
 }else if(p.type==='ellipse'){p.width=w;if(index===1)p.height=editClamp(hs[1]+dy-4,1,64);}
 else{p.width=w;if(index===1)p.middle=editClamp(hs[1]+dy,-32,96);}
 if(p.extraEnabled)p.bend=separatePoint(p.bend,p.extraPosition,original.bend);
 if(lockStart&&p.type==='custom'){const base=p.left;p.left=0;p.middle-=base;p.right-=base;if(p.extraEnabled)p.extraHeight-=base;}
 return p;
}

function separatePoint(value,other,previous){return Math.abs(value-other)<2.5?other+(previous<other?-2.5:2.5):value;}
export function toggleExtraPoint(p,{lockStart=false}={}){if(p.extraEnabled)return {...p,extraEnabled:false};const c=curve(p),base=lockStart?c.handles[0][1]:0,extraPosition=(p.bend??50)>65?25:75;return {...changeCurveType(p,'custom',{lockStart}),extraEnabled:true,extraPosition,extraHeight:c.fn((c.offset??0)+(c.span??c.w)*extraPosition/100)-base};}
