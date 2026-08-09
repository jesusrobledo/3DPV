// Import the required classes
import * as THREE from 'three';
import {Fn, textureStore, storage, instanceIndex, uvec2, vec4, float, sin, time} from 'three/tsl';

export class GPUToolSet{

    constructor(){
        this.size = 8;
        this.storageTexture = new THREE.StorageTexture(this.size, this.size);
        this.storageTexture.minFilter = THREE.NearestFilter;
        this.storageTexture.magFilter = THREE.NearestFilter;
        this.shaderTest = Fn(() => {
            const posX = instanceIndex.mod(this.size);
            const posY = instanceIndex.div(this.size);
            const coord2D = uvec2(posX,posY);
            const r = float(posX).div(this.size-1).mul(sin(time));
            const g = float(posY).div(this.size-1);
            const b = 0.0;
            textureStore(this.storageTexture, coord2D, vec4(r,g,b,1.0)).toWriteOnly();
        });
    }
}

export class Test{
    constructor(){
        this.count = 2048*2048;
        const floatArray = new Float32Array(this.count);
        this.storageAttr = new THREE.StorageBufferAttribute(floatArray, 1);
        this.storageBufferNode = storage(this.storageAttr, 'float', this.count);
        this.generateIndicesFn = Fn(() => {
            const idx = instanceIndex;
            this.storageBufferNode.element(idx).assign(3.14);
        });
    }
}