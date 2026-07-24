import {CoreObject} from "./Core.js"
import {FBO} from "./Core.js"

const coreObject = new CoreObject();
await coreObject.createGPUEnvironment();
coreObject.init();
coreObject.renderer.setAnimationLoop( coreObject.animate );

const test = {};

let N = 500000;
for (let n=0;n<N;n++){
    test[n] = new FBO(coreObject.gl,4096,4096);
    if (n==N-1)
        alert ("OK");
}