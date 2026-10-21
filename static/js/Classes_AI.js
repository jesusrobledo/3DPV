import * as THREE from 'three';
import {OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { storage,
         instanceIndex,
         Fn,
         Loop,
         instancedArray,
         vec3,
         texture3D,
         Var,
         int,
         vec2,
         float,
         uniformArray,
         attribute,
         vec4,
         exp} from 'three/tsl';
import JSZip from 'https://esm.sh/jszip@3.10.1';

function linspace(min,max,size){
    if (size <2)
        throw new Error ('size must be >=2');
    const out = new Float32Array(size);
    const step = (max-min)/(size-1);
    for (let i=0;i<size;i++)
        out[i] = min+ step*i;
    return out;
}
const CELL_ATTRIBUTES = {
    irradiance: {size:1},
    temperature: {size:1},
    voltage: {size: 'IVsize'}
}

class GPUArray {
    constructor ({key,IVsize,nModules,module,bounds,lut}){
        this.key = key;
        this.IVsize = IVsize;
        this.module = module;
        this.nCells = module.nCellsPerChain *
                      module.nChainsPerDiode *
                      module.nDiodes *
                      nModules;
        this.ImaxCell = module.ImaxCell;
        this.IminCell = module.IminCell;
        this.VchainMin = module.VchainMin;
        this.VchainMax = module.VchainMax;
        this.currentVector = instancedArray(
            linspace(this.IminCell, this.ImaxCell, IVsize),
            'float'
        );
        this.currentVector = instancedArray(
            linspace(this.VchainMin,this.VchaimMax, IVsize),
            'float'
        );
    }
    this.cell = {attribute:{},node:{}};
    for (const [name, spec] of Object.entries(CELL_ATTRIBUTES)){
        const count = this.nCells * (spec.size === 'IVsize'? IVsize: spec.size);
        const attr = new THREE.StorageBufferAttribute(new Float32Array(count),1);
        this.cell.attribute[name] = attr;
        this.cell.node[name] = storage(attr, 'float', count);
    }
}
class GPUEngine {
    constructor() {
        this.arrays = new Map();
        this.normalizeValue = Fn(([x.min,max]) => x.sub(min).div(max.sub(min)));
    }
    createArray(data){
        const gpuArray = new GPUArray(data);
        this.arrays.set(gpuArray.key,gpuArray);
        gpuArray.cellsVoltage = this.#createCellsVoltageKernel(gpuArray);
        return gpuArray;
    }
    #createCellsVoltageKernel(gpuArray){
        const {cell, currentVector, IVsize, LUT} = gpuArray;
        const normalize = this.normalizeValue;

        return Fn (() => {
            const irradiance = normalize(
                cell.node.irradiance.element(instanceIndex),
                gpuArray.Gmin,
                gpuArray.Gmax
            );
            const temperature = normalize(
                cell.node.temperature.element(instanceIndex),
                gpuArray.Tmin,
                gpuArray.Tmax
            );
            Loop({start:0,end:IVsize},({i}) =>{
                const current = normalize(
                    currentVector.element(i),
                    gpuArray.IminCell,
                    gpuArray.ImaxCell
                );
                const sample = vec3(temperature, irradiance, current);
                const globalIndex = instanceIndex.mul(IVsize).add(i);
                cell.node.voltage.element(globalIndex).assign(texture3D(LUT,sample).r);
            });
        })
    }
}


export {GPUengine}