import {createTerrainView} from './terrain-view.js';
import {createRavine} from './ravine.js';
const bridgeEl=id=>document.getElementById(id),bridgeView=createTerrainView(bridgeEl('ravine'));let ravineModel;
const ravineColors={rock:'#777777','rock-light':'#92928c','rock-dark':'#5a5b5c',strata:'#807c72',grass:'#687458',soil:'#786550',gravel:'#929084',riverbed:'#484848',water:'#5d7c92'};
// The terrain is built once, the first time the Bridge workspace is visible.
function showRavine(){if(!bridgeEl('ravine').getBoundingClientRect().width)return;if(!ravineModel)ravineModel=createRavine();bridgeView.update(ravineModel,36,{grid:false,groupColors:ravineColors});}
bridgeEl('perspective').onclick=()=>bridgeView.preset('outside');bridgeEl('front').onclick=()=>bridgeView.preset('front');bridgeEl('top').onclick=()=>bridgeView.preset('top');bridgeEl('minus').onclick=()=>bridgeView.zoom(1/1.3);bridgeEl('plus').onclick=()=>bridgeView.zoom(1.3);bridgeEl('fit').onclick=()=>bridgeView.fit();
new ResizeObserver(showRavine).observe(document.querySelector('main'));showRavine();
globalThis.bridgeState={capture:()=>({camera:bridgeView.getState()}),restore:s=>bridgeView.setState(s.camera)};
