import {curve} from './curves.js';
import {solve} from './optimizer.js';
export const frameCurveDefaults={run:9,middle:-4.5,end:-6,bend:50,thickness:2};
export function frameCurve(p){
 const c=curve({type:'custom',width:p.run,left:p.thickness,middle:p.thickness+p.middle,right:p.thickness+p.end,bend:p.bend,thickness:p.thickness});
 return {c,roof:solve(c,{maxThickness:p.thickness,startLow:0,allowGaps:true})};
}
