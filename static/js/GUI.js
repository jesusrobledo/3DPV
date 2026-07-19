import {CoreObject} from "./Core.js"

const coreObject = new CoreObject();
await coreObject.createGPUEnvironment();
coreObject.init();
coreObject.renderer.setAnimationLoop( coreObject.animate );