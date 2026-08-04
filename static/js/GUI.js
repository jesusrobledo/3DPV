//import {CoreObject} from "./Core.js"
//import {FBO} from "./Core.js"


import {GPUEngine} from "./Core.js"
import {FBO} from "./Core.js"
import {Scene3D} from "./Core.js"


//const coreObject = new CoreObject();
//await coreObject.createGPUEnvironment();

const width = 512;
const height = 512;

const toolSet = new GPUEngine();
await toolSet.createGPUEnvironment();
toolSet.FBO['fbo'] = new FBO(toolSet.gl,width,height);
//toolSet.FBO['test2'] = new FBO(toolSet.gl,width,height);


let points = [];

let position = [];
for (let i=0;i<height;i++){
    for (let j=0;j<width;j++){
        position.push(-1+1/width+j*2/width,-1+1/width+i*2/width,0.0);
    }
}

let id = [];
for (let i=0;i<height;i++){
    for (let j=0;j<width;j++)
        id.push(i*width+j);
}
toolSet.shaders.test.createWebGL2BufferArrays(toolSet.gl,{1:{name:1,vertexData:{position:position},nVertices:width*height}});
toolSet.shaders.test2.createWebGL2BufferArrays(toolSet.gl,{1:{name:1,vertexData:{id:id},nVertices:width*height}});
toolSet.shaders.test.executeGPUCode(toolSet.gl,toolSet.FBO.fbo,{color:[1.0,0.0,0.0]});
toolSet.shaders.test2.executeGPUCode(toolSet.gl,toolSet.FBO.fbo,{size:512});

/*
let scene3D = new Scene3D();
scene3D.init();
scene3D.renderer.setAnimationLoop( scene3D.animate );
//
//scene3D.scene.children[0].material.map.__webglInit = true;
//toolSet.downloadTexture('test2','Delete');
/*
let uniforms = {color:[0.0,0.0,0.0]};
let r = 0.0;
let g = 0.0;
let b = 0.0;
let nR = 10;
let nG = 10;
let nB = 10;
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
            //toolSet.downloadTexture(count,'Test_'+count);
            count += 1;
        }
    }
}
const t2 = Date.now();

alert ((t2-t1)/1000);
delete (toolSet.FBO);

const button = document.querySelector('#myButton');
button.addEventListener('click', (event) => {
    const imageBitmap = await createImageBitmap(document.getElementById("canvas"));
    const textureProperties = scene3D.renderer.properties.get(scene3D.myTexture);
    textureProperties.__webglTexture = toolSet.FBO.fbo.texture;

    scene3D.scene.children[0].material.map.image = imageBitmap;
});
*/