import {createRoof3D} from './view3d.js';
import {createRavine} from './ravine.js';
const bridgeEl=id=>document.getElementById(id),bridgeView=createRoof3D(bridgeEl('ravine'),()=>{});let ravineModel;
function showRavine(){if(!bridgeEl('ravine').getBoundingClientRect().width)return;if(!ravineModel)ravineModel=createRavine();bridgeView.update(ravineModel,20,{grid:false,groupColors:{rock:'#777777','rock-light':'#898989',ridge:'#9c9c9c',riverbed:'#484848',water:'#647b8c'}});}
bridgeEl('perspective').onclick=()=>bridgeView.preset('outside');bridgeEl('front').onclick=()=>bridgeView.preset('front');bridgeEl('top').onclick=()=>bridgeView.preset('top');bridgeEl('minus').onclick=()=>bridgeView.zoom(1/1.3);bridgeEl('plus').onclick=()=>bridgeView.zoom(1.3);bridgeEl('fit').onclick=()=>bridgeView.fit();
new ResizeObserver(showRavine).observe(document.querySelector('main'));showRavine();
globalThis.bridgeState={capture:()=>({camera:bridgeView.getState()}),restore:s=>bridgeView.setState(s.camera)};
