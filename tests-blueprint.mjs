import assert from 'node:assert/strict';
import {encodeBlueprint,decodeBlueprint,validateBlueprint,appendVersion,readVersions,versionsKey} from './dist/blueprint.js';
import {curveDefaults,toggleExtraPoint} from './dist/curve-editor.js';
import {frameCurveDefaults,frameCurve} from './dist/frame-curve.js';
import {createFrame} from './dist/frame.js';
const camera={yaw:.5,pitch:.4,zoom:1.3,offset:[12,-7]},params=toggleExtraPoint(frameCurveDefaults,{lockStart:true});
const state={activeTab:'frame',curves:{params:{...curveDefaults},layout:'hip',depth:8,mode3d:true,mono:true,locked:false,zoom:1.3,pan:[1,2],camera,display:{reference:false,grid:true,handles:true,baseline:false}},house:{params,pillars:{outer:6,inner:13,center:18},curveWidth:7,enabled:true,locked:true,grid:false,reference:true,group:'curves',editor:'curves',camera},bridge:{camera}};
const text=encodeBlueprint(state),loaded=decodeBlueprint(text);assert.deepEqual(loaded.state,state);
const geometry=s=>createFrame({outerHeight:s.house.pillars.outer,innerHeight:s.house.pillars.inner,centerHeight:s.house.pillars.center,curveWidth:s.house.curveWidth,roof:frameCurve(s.house.params).roof}).blocks;
assert.deepEqual(geometry(state),geometry(loaded.state));
let values=new Map();const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};appendVersion(storage,{id:'test',name:'Roof',savedAt:'2026-10-28',blueprint:loaded});assert.deepEqual(readVersions(storage)[0].blueprint,loaded);
for(const edit of [b=>b.version=99,b=>b.state.house.params.width=-1,b=>b.state.house.pillars.center=1.5,b=>b.state.bridge.camera.zoom=1e9,b=>b.state.house.params.extraHeight=Infinity]){const bad=structuredClone(loaded);edit(bad);assert.throws(()=>validateBlueprint(bad));}
assert.throws(()=>decodeBlueprint('{oops'));assert.throws(()=>decodeBlueprint(' '.repeat(1048577)));assert.throws(()=>appendVersion({getItem:()=>null,setItem:()=>{throw new Error('quota');}},{id:'x',blueprint:loaded}));
values.set(versionsKey,'broken');assert.throws(()=>readVersions(storage));
console.log('Blueprint editable state/geometry round-trip, local versions, validation and storage failures passed.');
