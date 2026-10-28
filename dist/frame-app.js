import {createFrame} from './frame.js';
import {createRoof3D} from './view3d.js';
const el=id=>document.getElementById(id);
let frameModel,group=null;
const frameView=createRoof3D(el('frame-canvas'),block=>{
 group=block.group;el('selection').textContent=(group==='inner'?'12 inner':'16 outer')+' pillars selected';
 for(const g of ['inner','outer'])el(g+'-label').classList.toggle('active',g===group);
 updateFrame(false);el(group+'-height').focus({preventScroll:true});
});
function updateFrame(rebuild=true){
 if(rebuild)frameModel=createFrame({innerHeight:el('inner-height').value,outerHeight:el('outer-height').value,elevation:el('elevation').value});
 frameView.update(frameModel,22,{grid:true,selectedGroup:group});
 el('frame-count').textContent=frameModel.blocks.length+' blocks · base Y '+frameModel.elevation;
}
for(const id of ['inner-height','outer-height','elevation']){
 el(id).oninput=()=>{if(el(id).value!==''&&el(id).validity.valid)updateFrame();};
 el(id).onchange=()=>{const input=el(id);input.value=Math.max(+input.min,Math.min(+input.max,Math.round(+input.value)));updateFrame();};
}
el('reset-frame').onclick=()=>{el('inner-height').value=15;el('outer-height').value=6;el('elevation').value=20;group=null;for(const g of ['inner','outer'])el(g+'-label').classList.remove('active');el('selection').textContent='Tap a pillar to select its group';updateFrame();frameView.preset('outside');};
el('orbit').onclick=()=>frameView.preset('outside');el('top-frame').onclick=()=>frameView.preset('top');
el('minus-frame').onclick=()=>frameView.zoom(1/1.3);el('plus-frame').onclick=()=>frameView.zoom(1.3);el('fit-frame').onclick=()=>frameView.fit();
el('export-frame').onclick=()=>{const rows=['x,y,z,element,group',...frameModel.blocks.map(b=>`${b.x},${b.y},${b.z},block,${b.group}`)],url=URL.createObjectURL(new Blob([rows.join('\n')],{type:'text/csv'})),a=document.createElement('a');a.href=url;a.download='minecraft-frame.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
new ResizeObserver(()=>updateFrame(false)).observe(el('viewport'));updateFrame();
