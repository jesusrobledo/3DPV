//import {CoreObject} from "./Core.js"
//import {FBO} from "./Core.js"

import {GPUEngine} from "./Core.js"
import {FBO} from "./Core.js"

//const coreObject = new CoreObject();
//await coreObject.createGPUEnvironment();

const width = 2048;
const height = 2048;

const toolSet = new GPUEngine();
await toolSet.createGPUEnvironment();
toolSet.FBO['test'] = new FBO(toolSet.gl,width,height);


let points = [];

let position = [];
for (let i=0;i<height;i++){
    for (let j=0;j<width;j++){
        position.push(-1+1/width+j*2/width,-1+1/width+i*2/width,0.0);
    }
}
toolSet.shaders.test.createWebGL2BufferArrays(toolSet.gl,{1:{name:1,vertexData:{position:position},nVertices:width*height}});
let uniforms = {color:[0.0,0.0,0.0]};
let r = 0.0;
let g = 0.0;
let b = 0.0;
let nR = 2;
let nG = 2;
let nB = 2;
const t1 = Date.now();
let count = 0;
for (let ir=0;ir<nR;ir++){
    r = ir*1.0/(nR-1);
    for (let ig=0;ig<nG;ig++){
        g = ig*1.0/(nG-1);
        for (let ib=0;ib<nB;ib++){
            b = ib*1.0/(nB-1);
            toolSet.FBO[count] = new FBO(toolSet.gl,width,height);
            toolSet.shaders.test.executeGPUCode(toolSet.gl,toolSet.FBO[count],{color:[r,g,b]});
            toolSet.downloadTexture(count,'Test_'+count);
            count += 1;
        }
    }
}
const t2 = Date.now();

alert ((t2-t1)/1000);
delete (toolSet.FBO);
