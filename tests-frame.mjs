import assert from 'node:assert/strict';
import {createFrame} from './dist/frame.js';
import {frameSection} from './dist/frame-section.js';
import {frameCurve,frameCurveDefaults,cornerGableProfile,gableDefaults} from './dist/frame-curve.js';
import {houseGableDefaults} from './dist/blueprint.js';
import {occupiedVoxels,placementDirection} from './dist/layout.js';
import {roofMesh} from './dist/view3d.js';
const base=createFrame();assert.equal(base.maxX,25);
assert.deepEqual([base.outerHeight,base.innerHeight,base.centerHeight,base.centerLift,base.beamLevel,base.curveSide],[8,12,18,3,5,2],'default heights 8 / 12 / 18');
assert.equal(base.outer.length,20);assert.equal(base.inner.length,12);assert.equal(base.center.length,4);
const sides=(cols,lo)=>[...new Set(cols.filter(([,z])=>z===lo).map(([x])=>x))].sort((a,b)=>a-b);
assert.deepEqual(sides(base.outer,0),[0,6,10,14,18,24],'outer side spacing 0/6/10/14/18/24');assert.deepEqual(sides(base.inner,6),[6,10,14,18],'middle 13x13 with 3-block gaps');assert.deepEqual(sides(base.center,10),[10,14],'centre 5x5 corners');
for(const [cols,lo,hi]of [[base.outer,0,24],[base.inner,6,18],[base.center,10,14]])assert(cols.every(([x,z])=>[x,z].every(v=>v>=lo&&v<=hi)&&(x===lo||x===hi||z===lo||z===hi)),'columns lie on their square perimeter');
const at=new Map(base.blocks.filter(b=>b.layer==='structure').map(b=>[[b.x,b.y,b.z].join(','),b]));
const colY=(x,z,group)=>base.blocks.filter(b=>b.x===x&&b.z===z&&b.group===group).map(b=>b.y);
assert.deepEqual([Math.min(...colY(0,0,'outer')),colY(0,0,'outer').length],[20,8]);assert.deepEqual([Math.min(...colY(6,6,'inner')),colY(6,6,'inner').length],[20,12]);assert.deepEqual([Math.min(...colY(10,10,'center')),colY(10,10,'center').length],[23,18],'centre starts 3 higher');
// Pathway: rings 0-6 solid, ring 7 a stair ring, everything inside hollow.
for(let x=0;x<25;x++)for(let z=0;z<25;z++){const r=Math.min(x,z,24-x,24-z),b=at.get(`${x},20,${z}`);
 if(r<7)assert(b?.type==='block','solid pathway '+x+','+z);else if(r===7)assert(b?.group==='steps'&&['left','right','corner'].includes(b.type),'stair ring '+x+','+z);else assert(!b,'hollow centre '+x+','+z);}
assert(base.blocks.filter(b=>b.group==='path').length+base.blocks.filter(b=>b.y===20&&['outer','inner'].includes(b.group)).length===625-121,'every pathway cell is paved (columns stand on it)');
assert.equal(base.blocks.filter(b=>b.group==='steps').length,40);
const tall=(b,dir)=>placementDirection(b)===dir;
assert(tall(at.get('17,20,12'),'+X')&&tall(at.get('7,20,12'),'-X')&&tall(at.get('12,20,17'),'+Z')&&tall(at.get('12,20,7'),'-Z'),'stairs step down toward the centre');
for(const [k,dir]of [['17,20,17','+X+Z'],['7,20,7','-X-Z'],['17,20,7','+X-Z'],['7,20,17','-X+Z']]){const c=at.get(k);assert.equal(c.type,'corner');assert.equal(placementDirection(c),dir);assert.equal(occupiedVoxels([c]).size,7,'inner corner stair');}
assert(!base.blocks.some(b=>b.layer==='structure'&&b.y<23&&b.x>=8&&b.x<=16&&b.z>=8&&b.z<=16),'centre floats over a hollow');
for(let t=0;t<25;t++)for(const [x,z]of [[t,0],[t,24],[0,t],[24,t]])assert(at.has(`${x},24,${z}`),'beam wraps perimeter on the 5th block');
const sv=occupiedVoxels(base.blocks);for(const key of sv.keys()){const [x,y,z]=key.split(',').map(Number);assert(sv.has(`${49-z},${y},${x}`),'four-way structure symmetry');}
const custom=createFrame({outerHeight:12,beamLevel:7,centerLift:0});assert(custom.blocks.some(b=>b.group==='beam'&&b.y===26));assert.equal(Math.min(...custom.blocks.filter(b=>b.group==='center').map(b=>b.y)),20);
// Section through the middle: symmetric, shows the paved ring, the stair profile, the hollow, and columns beyond.
const sec=frameSection(base,{axis:'z',cut:12});
for(const k of sec.cutOwner.keys()){const [h,y]=k.split(',').map(Number);assert(sec.cutOwner.has(`${49-h},${y}`),'section is mirror-symmetric');}
assert.equal(sec.cutOwner.get('6,40')?.block.group,'path');assert(sec.cutOwner.has('14,41')&&!sec.cutOwner.has('15,41')&&sec.cutOwner.has('15,40'),'stair steps down toward the centre');
for(let h=16;h<=33;h++)assert(!sec.cutOwner.has(`${h},40`)&&!sec.cutOwner.has(`${h},41`),'hollow in the cut');
assert.equal(sec.beyond.get('20,46')?.block.group,'center','centre column visible beyond the cut');
assert.equal(frameSection(base,{axis:'x',cut:12}).cutOwner.size,sec.cutOwner.size,'both cut directions agree');
assert(frameSection(base,{axis:'z',cut:10}).cutOwner.get('20,46')?.block.group==='center','cut through the columns');
const def=frameCurve(frameCurveDefaults);assert.equal(frameCurveDefaults.thickness,1.5,'classic stair-roof proportions by default');assert(def.roof.columns[0].low[0]<=0&&def.roof.columns[0].high[0]>0,'default roof starts against the centre columns');assert.equal(def.roof.gaps,0);assert(def.c.fn(4.5)<(def.c.fn(0)+def.c.fn(9))/2,'default convex');
// Half-block cells of a roof, and how far the drawn line strays from them.
const cellsOf=blocks=>{const cells=[],m={block:[1,1,1,1],slab:[1,1,0,0],right:[1,1,0,1],left:[1,1,1,0]};for(const b of blocks)for(let yy=0;yy<2;yy++)for(let s=0;s<2;s++)if(m[b.type][(b.flip?1-yy:yy)*2+s])cells.push([b.x+s/2,b.y+yy/2]);return cells;};
// Worst case skips the half-block joints at each end (anchor lift, and hooks finer than a half-step); the mean covers the whole line.
const stray=(r,c)=>{const cells=cellsOf(r.blocks);let worst=0,sum=0;for(let i=0;i<300;i++){const x=c.w*(i+.5)/300,y=c.fn(x),d=Math.min(...cells.map(([cx,cy])=>Math.hypot(Math.max(cx-x,0,x-cx-.5),Math.max(cy-y,0,y-cy-.5))));if(x>=.5&&x<=c.w-.5)worst=Math.max(worst,d);sum+=d;}return {worst,mean:sum/300};};
// Straight slopes are built like hand-made stair roofs: constant thickness, parallel faces, regular steps.
const pieceStack=(r,x)=>r.blocks.filter(b=>b.x===x).sort((a,b)=>a.y-b.y).map(b=>(b.flip?'inv-':'')+b.type).join(' ');
const twoToOne=frameCurve({...frameCurveDefaults,left:0,middle:-9,right:-18,width:9,thickness:1.12}).roof;
twoToOne.columns.forEach((col,x)=>{assert.deepEqual([col.high[0]-col.low[0],col.high[1]-col.low[1]],[2.5,2.5],'2:1 slope keeps 2.5 blocks of thickness');if(x)assert.equal(twoToOne.columns[x-1].high[0]-col.high[0],2,'2:1 slope drops 2 per column');assert.equal(pieceStack(twoToOne,x),'inv-right block left','upside-down stair, block, stair on every column');});
for(const [edit,t]of [[{left:0,middle:-5,right:-10,width:10},1.25],[{left:0,middle:-3,right:-6,width:12},1.25],[{left:0,middle:-9,right:-18,width:9},1.5]]){const r=frameCurve({...frameCurveDefaults,...edit,thickness:t}).roof,heights=r.columns.flatMap(c=>[c.high[0]-c.low[0],c.high[1]-c.low[1]]);assert.equal(new Set(heights).size,1,'straight slope keeps one thickness throughout: '+JSON.stringify(edit));}
const thinnest=frameCurve({...frameCurveDefaults,middle:-3,right:-14,thickness:.5}),lean=thinnest.roof.blocks.length;assert(lean<=26,'thinnest steep roof stays lean: '+lean);
for(const thickness of [.5,1,1.5,2,4])for(const edit of [{},{middle:-3,right:-14},{middle:12,right:-12,bend:70,width:6},{width:6,middle:-1,right:-20},{width:4,middle:-30,right:-32},{type:'circle',radius:10,extent:120}]){
 const p={...frameCurveDefaults,...edit,thickness},{c,roof:r}=frameCurve(p);
 assert.equal(r.gaps,0,'every column shares a face with the next');
 for(let i=1;i<r.columns.length;i++){const a=r.columns[i-1],b=r.columns[i];assert(Math.min(a.high[1],b.high[0])-Math.max(a.low[1],b.low[0])>=.5);}
 const off=stray(r,c);assert(off.worst<=.7&&off.mean<=.1,'the roof hugs the drawn line: worst '+off.worst.toFixed(2)+', mean '+off.mean.toFixed(3));
 assert(r.columns[0].low[0]<=0&&r.columns[0].high[0]>=.5,'first column holds the anchor');
 if(thickness===.5||thickness===1.5)for(const onlyBlocks of [true])assert(frameCurve({...p,onlyBlocks}).roof.blocks.every(b=>b.type==='block'),'full blocks only');
 for(const side of [0,2,3,5]){
  const model=createFrame({roof:r,curveSide:side}),wings=model.blocks.filter(b=>b.group==='curves');assert.equal(wings.length,r.blocks.length*(2*side+1)*4,'retain every source element');
  const east=[...new Set(wings.filter(b=>b.wing==='east').map(b=>b.z))].sort((a,b)=>a-b);assert.deepEqual(east,Array.from({length:2*side+1},(_,i)=>12-side+i),'width grows equally on both sides');
  assert(wings.every(b=>!(b.x>=10&&b.x<=14&&b.z>=10&&b.z<=14)),'full 5x5 roof opening');
  assert(wings.every(b=>[b.x,b.y,b.z].every(Number.isInteger)));
  const voxels=occupiedVoxels(wings);for(const key of voxels.keys()){const [x,y,z]=key.split(',').map(Number);assert(voxels.has(`${49-z},${y},${x}`),'four-way geometry symmetry');}
  const changed=createFrame({roof:r,curveSide:side,innerHeight:40,outerHeight:40});assert.deepEqual(changed.blocks.filter(b=>b.group==='curves'),wings,'structure must not modify roof');
 }
}
// Corner gables: a post on each corner column sweeping down both outer faces onto the column 'reach' blocks along.
assert.deepEqual(houseGableDefaults,gableDefaults,'saved-design defaults match the gable defaults');
for(const g of [gableDefaults,{...gableDefaults,height:12,reach:10,flare:90,thickness:2},{...gableDefaults,height:3,reach:2,flare:0,thickness:.5}]){
 const profile=cornerGableProfile(g),cols=profile.columns;
 assert.equal(cols.length,g.reach+1);assert.deepEqual(cols[0].low,[0,0],'post stands on the corner column');assert(Math.min(...cols[g.reach].low)===0,'arm lands on the column top');
 assert(Math.abs(Math.max(...cols[0].high)-g.height)<=1,'peak reaches the set height');
 for(let i=1;i<cols.length;i++)assert(Math.min(cols[i-1].high[1],cols[i].high[0])-Math.max(cols[i-1].low[1],cols[i].low[0])>=.5,'arm has no gaps');
 for(const outerHeight of [4,8,15]){
  const m=createFrame({outerHeight,gables:{profile,depth:g.depth,overhang:g.overhang}}),gb=m.blocks.filter(b=>b.group==='gables');
  assert.equal(Math.min(...gb.map(b=>b.y)),20+outerHeight,'gables sit on the outer column tops');assert.equal(new Set(gb.map(b=>b.wing)).size,4,'all four corners');
  const v=occupiedVoxels(gb);for(const key of v.keys()){const [x,y,z]=key.split(',').map(Number);assert(v.has(`${49-z},${y},${x}`),'four-way gable symmetry');}
  assert(gb.every(b=>Math.min(b.x,b.z,24-b.x,24-b.z)>=-g.overhang&&(Math.min(b.x,24-b.x)<=g.reach||Math.min(b.z,24-b.z)<=g.reach)),'gables stay at the corners');
  assert(gb.every(b=>Math.min(b.x,b.z,24-b.x,24-b.z)<=g.depth-1-g.overhang),'gables stay on the outer faces');
 }
}
assert.equal(createFrame({gables:null}).blocks.filter(b=>b.group==='gables').length,0,'gables can be turned off');
// Independently meshed layers preserve surfaces even when they occupy the same cell.
const b={x:0,y:0,z:0,type:'block',axis:'x'};assert.equal(roofMesh([{...b,layer:'structure'},{...b,type:'slab',layer:'roof'}],1,true).length,12);
console.log('25x25 shells, pathway, stair ring, hollow centre, beam, section cuts, symmetric curve width, gap-free line-following roofs and four-way symmetry passed.');
