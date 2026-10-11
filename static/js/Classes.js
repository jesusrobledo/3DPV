import * as THREE from 'three';
import {OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { storage, instanceIndex, Fn, Loop, instancedArray, vec3, texture3D, Var, int, vec2, If, Break, float } from 'three/tsl';
import JSZip from 'https://esm.sh/jszip@3.10.1';

class Sun{
    constructor(){
        this.light = new THREE.DirectionalLight(0xffffff,3.0);
        this.d = 5000;
        this.azimuth = 45;
        this.elevation = 45;
        this.v = [];
        this.light.up = new THREE.Vector3(0.0,0.0,1.0);
        this.light.castShadow = true;
        this.light.shadow.mapSize.set(4096,4096);
        this.updatePosition(this.azimuth,this.elevation);
        this.updateShadowCamera(50,10000,-5000,5000,-5000,5000);
    }
    updatePosition(azimuth,elevation){
        this.elevation = elevation;
        this.azimuth = azimuth;
        this.v = [Math.cos(this.elevation*Math.PI/180)*Math.cos(this.azimuth*Math.PI/180),
                  Math.cos(this.elevation*Math.PI/180)*Math.sin(this.azimuth*Math.PI/180),
                  Math.sin(this.elevation*Math.PI/180)];
        this.light.position.set(this.d*this.v[0],this.d*this.v[1],this.d*this.v[2]);
    }
    updateShadowCamera(near,far,left,right,bottom,top){
        this.light.shadow.camera.position.set(0.0,0.0,2500);
        this.light.shadow.camera.near = near;
        this.light.shadow.camera.far = far;
        this.light.shadow.camera.left = left;
        this.light.shadow.camera.right = right;
        this.light.shadow.camera.top = top;
        this.light.shadow.camera.bottom = bottom;
        this.light.shadow.camera.updateProjectionMatrix();
    }
}
class Terrain extends THREE.Group{
    constructor(objFileName,textureFileName){
        super();
        this.loadTerrain();
    }
    async loadTerrain(){
        try{
            const response = await fetch('/load_terrain',{
                method: 'POST',
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({name:"5Km"})
            });
            if (!response.ok)
                throw new Error('Server error: ${response.status}');
            const result = await response.json();
            this.loadMesh(result.objFileName,result.textureFileName);
        } catch(error){
            console.error(error);
        }
    }
    loadMesh(objFileName,textureFileName){
        const loader = new OBJLoader();
        const textureLoader = new THREE.TextureLoader();
        loader.load(objFileName,async(group) =>{
            // Conver the mesh from OBJ loader into an indexed geometry
            for (let i=0;i<group.children.length;i++){
                const child = group.children[i];
                if (child.isMesh){
                    const indexedGeometry = BufferGeometryUtils.mergeVertices(child.geometry);
                    child.geometry.dispose();
                    child.geometry = indexedGeometry;
                }
            }
            super.copy(group,true);
            this.children[0].material = new THREE.MeshPhongMaterial({map:textureLoader.load(textureFileName)});
            this.children[0].castShadow = true;
            this.children[0].receiveShadow = true;
        });
    }
}
class GPUengine{
    static DEFAULTS = Object.freeze({
        // LUT definition
        nT: 16,
        nG: 32,
        nI: 512,
        Tmin: -10,
        Tmax: 80,
        Gmin: 0,
        Gmax: 1200,
        Imin: 0,
        Imax: 10
    });
    constructor(){
        this.array = {};

        // Shaders ////////////////////////////////////////////////////////////

        // General purpose
        this.normalizeValue = Fn (([x,min,max]) => {

            return x.sub(min).div(max.sub(min));
        });
        this.binarySearchDecrease = Fn(([nodeIndex,target,bufferNode,n]) => {
            const targetVal = target.toVar();
            const low = int(0).toVar();
            const high = n.sub(1);
            const foundIndex = int(-1).toVar();
            const maxIterations = Math.ceil(Math.log2(this.array.baseline.IVsize));
            Loop({start:0,end:maxIterations}, () =>{
                If(low.add(1).greaterThanEqual(high), () => {
                    Break();
                });
                const mid = low.add(high).div(2).toVar();
                const flatIndex = nodeIndex.mul(n).add(mid);
                const value = bufferNode.element(flatIndex);
                If (value.greaterThan(targetVal), () => {
                    low.assign(mid);
                }).Else(() => {
                    high.assign(mid);
                });
            });
            const flatLow = nodeIndex.mul(n).add(low);
            const flatHigh = nodeIndex.mul(n).add(high);
            const valLow = bufferNode.element(flatLow);
            const valHigh = bufferNode.element(flatHigh);
            const factor = targetVal.sub(valHigh).div(valLow.sub(valHigh));
            return vec2(high,factor);
        });

        // Cells operation
        this.cellsVoltage = Fn(([key]) => {
            
            // Normalizing
            const irradiance = this.normalizeValue(this.array[key].cell.node.irradiance.element(instanceIndex),
                                                   this.array[key].Gmin,
                                                   this.array[key].Gmax);
            const temperature = this.normalizeValue(this.array[key].cell.node.temperature.element(instanceIndex),
                                                    this.array[key].Tmin,
                                                    this.array[key].Tmax);

            Loop({start:0,end:this.array[key].IVsize},({i}) => {
                const current = this.normalizeValue(this.array[key].currentVector.element(i),
                                                    this.array[key].Imin,
                                                    this.array[key].Imax);
                const data = vec3(temperature,irradiance,current);
                const value = texture3D(this.array[key].LUT,data).r;
                const globalIndex = instanceIndex.mul(this.array[key].IVsize).add(i);
;               this.array[key].cell.node.voltage.element(globalIndex).assign(value);
            });
        });

        // Chains operation
        this.chainsVoltage = Fn(([key]) => {
            Loop({start:0,end:this.array[key].IVsize},({i:i1}) =>{
                const _i1 = i1.toVar();
                const value = Var(0.0);
                Loop({start:0,end:this.array[key].nCellsPerDiode},({i:i2}) => {
                    const cellIndex = instanceIndex.mul(this.array[key].nCellsPerDiode*this.array[key].IVsize).
                                      add(i2.mul(this.array[key].IVsize)).
                                      add(_i1);
                    value.addAssign(this.array[key].cell.node.voltage.element(cellIndex));
                });
                const globalIndex = instanceIndex.mul(this.array[key].IVsize).add(i1);
                this.array[key].chain.node.voltage.element(globalIndex).assign(value);
            });
        });
        this.chainsCurrent = Fn(([key]) => {
            Loop({start:0,end:this.array[key].IVsize},({i}) => {
                const dummy = Var(this.array[key].IVsize).sub(1);
                const voltage = Var(-1.0).add(float(i).mul(15.0).div(dummy));
                const data = this.binarySearchDecrease(instanceIndex,voltage,this.array[key].chain.node.voltage,this.array[key].IVsize);
                const globalIndex = instanceIndex.mul(this.array[key].IVsize).add(i);
                const value = (data.x).sub(data.y).mul(0.10101);
                this.array[key].chain.node.current.element(globalIndex).assign(value);
            });
        });
    }
    async loadLUT(fileName,key){
        const response = await fetch(fileName);
        const blob = await response.blob();
        const zip = await JSZip.loadAsync(blob);
        const binBuffer = await zip.file('lut_data.bin').async('arraybuffer');
        const floatData = new Float32Array(binBuffer);
        this.array[key].LUT = new THREE.Data3DTexture(floatData,this.array[key].nT,this.array[key].nG,this.array[key].nI);
        this.array[key].LUT.format = THREE.RedFormat;
        this.array[key].LUT.type = THREE.FloatType;
        this.array[key].LUT.minFilter = THREE.LinearFilter;
        this.array[key].LUT.magFilter = THREE.LinearFilter;
        this.array[key].LUT.wrapS = THREE.ClampToEdgeWrapping;
        this.array[key].LUT.wrapT = THREE.ClampToEdgeWrapping;
        this.array[key].LUT.wrapR = THREE.ClampToEdgeWrapping;
        this.array[key].LUT.needsUpdate = true;
        alert ("LUT loaded");
    }
    createArray(data){
        const key = data.key;
        const IVsize = 100;

        // Create the structure required //////////////////////////////////////

        this.array[key] = {};
        this.array[key]['IVsize'] = IVsize;

        const currentVector = new Float32Array(IVsize);
        for (let i=0;i<currentVector.length;i++)
            currentVector[i] = 10/(IVsize-1)*i;
        this.array[key]['currentVector'] = instancedArray(currentVector,'float');

        const voltageVector = new Float32Array(IVsize);
        for (let i=0;i<voltageVector.length;i++)
            voltageVector[i] = -1.0 + 15/(IVsize-1)*i;
        this.array[key]['voltageVector'] = instancedArray(voltageVector,'float');

        // Individual cells
        const cellAttribute = {'irradiance':{size:1},
                               'temperature':{size:1},
                               'voltage':{size:IVsize}
                               };
        this.array[key]['nCellsPerDiode'] = data.module.nCellsPerDiode;
        this.array[key]['nCells'] = data.module.nCellsPerDiode * data.module.nDiodes * data.nModules;
        this.array[key]['cell'] = {attribute:{},node:{}};
        for (let keyAttr in cellAttribute){
            this.array[key].cell.attribute[keyAttr] = new THREE.StorageBufferAttribute(new Float32Array(this.array[key].nCells*cellAttribute[keyAttr].size),1);
            this.array[key].cell.node[keyAttr] = storage(this.array[key].cell.attribute[keyAttr],'float',this.array[key].nCells*cellAttribute[keyAttr].size);
        }

        // Individual chains
        const chainAttribute = {'voltage':{size:IVsize},
                                'current':{size:IVsize}};
        this.array[key]['nChains'] = data.module.nChainsPerDiode * data.module.nDiodes * data.nModules;
        this.array[key]['chain'] = {attribute:{},node:{}};
        for (let keyAttr in chainAttribute){
            this.array[key].chain.attribute[keyAttr] = new THREE.StorageBufferAttribute(new Float32Array(this.array[key].nChains*chainAttribute[keyAttr].size),1);
            this.array[key].chain.node[keyAttr] = storage(this.array[key].chain.attribute[keyAttr],'float',this.array[key].nChains*chainAttribute[keyAttr].size);
        }

        // Upload the Lookup table used for that array
        this.array[key].nT = 32;
        this.array[key].nG = 64;
        this.array[key].nI = 2048;
        this.array[key].Tmin = -10;
        this.array[key].Tmax = 80;
        this.array[key].Gmin = 0;
        this.array[key].Gmax = 1200;
        this.array[key].Imin = 0;
        this.array[key].Imax = 10;
        this.loadLUT(data.module.fileName,key);
    }
    updateBuffer(keyArray,element,keyAttr,data){
        switch(element){
            case "cell":
                this.array[keyArray].cell.attribute[keyAttr].set(data);
                this.array[keyArray].cell.attribute[keyAttr].needsUpdate = true;
                break;
        }
    }
    async computeShader(renderer,shader,key){
        switch (shader){
            case 'cellsVoltage':
                await renderer.computeAsync(this.cellsVoltage(key).compute(this.array[key].nCells));
                break;
            case 'chainsVoltage':
                await renderer.computeAsync(this.chainsVoltage(key).compute(this.array[key].nChains));
                //const data = await renderer.getArrayBufferAsync(this.array[key].chain.attribute.voltage);
                //return new Float32Array(data);
                break;
            case 'chainsCurrent':
                await renderer.computeAsync(this.chainsCurrent(key).compute(this.array[key].nChains));
                const data = await renderer.getArrayBufferAsync(this.array[key].chain.attribute.current);
                return new Float32Array(data);
                break;

        }
    }
}
class PVmodule extends THREE.Group{
    constructor(){
        super();
    }
    loadMesh(data){
        const loader = new OBJLoader();
        const textureLoader = new THREE.TextureLoader();
        loader.load(data.fileName,async(group) =>{
            if (group.children.length == 1){
                const indexedGeometry = BufferGeometryUtils.mergeVertices(group.children[0].geometry);
                group.children[0].geometry.dispose();
                group.children[0].geometry = indexedGeometry;
            }
            else{
                // Report some error
            }
            super.copy(group,true);
            this.children[0].material[0].map = textureLoader.load(data.frontTexture);
            this.children[0].material[1].map = textureLoader.load(data.rearTexture);
            this.children[0].material[2].map = textureLoader.load(data.lateralTexture);
            this.children[0].castShadow = true;
            this.children[0].receiveShadow = true;
        });
    }
}
class PVlayout extends THREE.Group{
    constructor(data){
        super();
        const geometriesToMerge = [];
        const d = 1.15;
        const groups = [];
        for (let i=0;i<data.nModules;i++){
            // TODO: Adapt with proper allocation of the modules in the space
            const position = new THREE.Vector3(-d*(data.nModules-1)/2+d*i,0.0,0.0);
            const rotation = new THREE.Euler(0.0,0.0,0.0);
            const scale = new THREE.Vector3(1,1,1);
            const quaternion = new THREE.Quaternion().setFromEuler(rotation);
            const matrix = new THREE.Matrix4();
            matrix.compose(position,quaternion,scale);
            const geometry = data.pvModule.children[0].geometry.clone();
            const uvArray = new Float32Array(data.pvModule.children[0].geometry.attributes.uv.array.length);
            uvArray.set(data.pvModule.children[0].geometry.attributes.uv.array);
            ///////////////////////////////////////////////////////////////////
            // TODO: Adapt for the proper definition of the UV coordinates in the module definition file
            uvArray[0] = (i-1)*6;
            uvArray[2] = i*6;
            uvArray[4] = (i-1)*6;
            uvArray[5] = 24;
            uvArray[6] = i*6;
            uvArray[7]  = 24;
            ///////////////////////////////////////////////////////////////////
            geometry.setAttribute('analysisUv',new THREE.BufferAttribute(uvArray,2));
            geometry.applyMatrix4(matrix);
            geometriesToMerge.push(geometry);
            // TODO: Adapt for the proper definition of the UV coordinates in the module definition file
            groups.push({start:36*i,count:6,materialIndex:0});
            groups.push({start:36*i+6,count:6,materialIndex:1});
            groups.push({start:36*i+12,count:24,materialIndex:2});
        }
        const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometriesToMerge,true);
        mergedGeometry.groups = groups;
        const mesh = new THREE.Mesh(mergedGeometry,data.pvModule.children[0].material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.add(mesh);
    }
}
class PVarray extends THREE.Object3D{
    constructor(data){
        super();
        const nX = data.nX;
        const nY = data.nY;
        const dX = data.dX;
        const dY = data.dY;
        const instancedMesh = new THREE.InstancedMesh(data.pvLayout.children[0].geometry,
                                                      data.pvLayout.children[0].material,
                                                      nX*nY);
        const dummy = new THREE.Object3D();
        for (let j=0; j<nY; j++){
            for (let i=0; i<nX; i++) {
                dummy.position.set(-0.5*(nX-1)*dX + dX*i,
                                   -0.5*(nY-1)*dY + dY*j,
                                    300);
                dummy.rotation.order = 'ZYX';
                dummy.rotation.set(45.0*Math.PI/180,
                                   0.0,
                                   Math.PI/2);
                dummy.updateMatrix();
                instancedMesh.setMatrixAt(j*nX+i, dummy.matrix);
            }
        }
        instancedMesh.castShadow = true;
        instancedMesh.receiveShadow = true;
        this.add(instancedMesh);
    }
}

export {Terrain, Sun, GPUengine, PVmodule, PVlayout, PVarray}