// Import the required classes
import * as THREE from 'three';
import {Fn, textureStore, storage, instanceIndex, instancedArray, uvec2, vec4, float, sin, time, floor, uv, vec2} from 'three/tsl';

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
        this.w = 3;
        this.h = 12;
        this.n = 100*1250;
        const storageBuffer = new THREE.StorageBufferAttribute(new Float32Array(this.w*this.h*this.n), 1);
        this.dataBuffer = instancedArray(storageBuffer);
        this.computeCells = Fn(() => {
            const x = elementIndex.mod(this.w);
            const y = elementIndex.div(this.h);
            const offset = instanceIndex.mul(this.w*this.h).add(elementIndex);
            this.dataBuffer.element(offset).assign(1.0);
            //this.dataBuffer.element(offset).assign(vec4(1.0, 0.5, 0.0, 1.0));
            //this.dataBuffer.element(elementIndex).assign(vec4(1.0, 0.5, 0.0, 1.0));
        });
        this.assignCell = (() => {
            const gridUV = floor(uv().mul(vec2(this.w,this.h)));
            const localPixelIndex = gridUV.y.mul(this.w).add(gridUV.x);
            const globalOffset = instanceIndex.mul(this.w*this.h).add(localPixelIndex);
            //const dummy = instanceIndex;
            const dummy = this.dataBuffer.element(globalOffset).toFloat();
            return vec4(0.5,1.0,0.0,1.0);
            //return vec4(dummy/(this.w*this.h*this.n),0.5,0.0, 1.0);
        });
    }
}