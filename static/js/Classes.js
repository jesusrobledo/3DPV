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
         If,
         Break,
         float,
         uniformArray,
         attribute,
         vec4,
         exp} from 'three/tsl';
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
        IminCell: 0,
        ImaxCell: 10
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
        this.diodeCurrent = Fn (([Vd]) =>{
            const Is = float(1e-12);
            const n = float(1.0);
            const T = float(298);
            const k = float(1.380649e-23);
            const q = float(1.60218e-19);
            const Vt = k.mul(T).div(q);
            const exponent = Vd.div(n.mul(Vt));
            const Id = Is.mul(exp(exponent).sub(1.0));
            return float(Id);
        });

        // Strings operation
        this.stringsVoltage = Fn(([key]) => {
            Loop({start:0,end:this.array[key].IVsize},({i:i1}) =>{
                const _i1 = i1.toVar();
                const value = Var(0.0);
                Loop({start:0,end:this.array[key].nBlocksPerString},({i:i2}) => {
                    const stringIndex = instanceIndex.mul(this.array[key].nBlocksPerString*this.array[key].IVsize).
                                      add(i2.mul(this.array[key].IVsize)).
                                      add(_i1);
                    value.addAssign(this.array[key].block.node.voltage.element(stringIndex));
                });
                const globalIndex = instanceIndex.mul(this.array[key].IVsize).add(i1);
                this.array[key].string.node.voltage.element(globalIndex).assign(value);
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
        this.array[key]['ImaxCell'] = data.module.ImaxCell;
        for (let i=0;i<currentVector.length;i++)
            currentVector[i] = this.array[key]['ImaxCell']/(IVsize-1)*i;
        this.array[key]['currentVector'] = instancedArray(currentVector,'float');

        const voltageVector = new Float32Array(IVsize);
        this.array[key]['VchainMin'] = data.module.VchainMin;
        this.array[key]['VchainMax'] = data.module.VchainMax;
        for (let i=0;i<voltageVector.length;i++){
            voltageVector[i] = this.array[key]['VchainMin']  +
                               (this.array[key]['VchainMax']-this.array[key]['VchainMin'])/(IVsize-1)*i;
        }
        this.array[key]['voltageVector'] = instancedArray(voltageVector,'float');

        // Individual cells
        const cellAttribute = {'irradiance':{size:1},
                               'temperature':{size:1},
                               'voltage':{size:IVsize}
                               };
        this.array[key]['nCellsPerChain'] = data.module.nCellsPerChain;
        this.array[key]['nCells'] = data.module.nCellsPerChain * data.module.nChainsPerDiode * data.module.nDiodes * data.nModules;
        this.array[key]['cell'] = {attribute:{},node:{}};
        for (let keyAttr in cellAttribute){
            this.array[key].cell.attribute[keyAttr] = new THREE.StorageBufferAttribute(new Float32Array(this.array[key].nCells*cellAttribute[keyAttr].size),1);
            this.array[key].cell.node[keyAttr] = storage(this.array[key].cell.attribute[keyAttr],'float',this.array[key].nCells*cellAttribute[keyAttr].size);
        }

        // Individual chains
        const chainAttribute = {
                                'voltage':{size:IVsize},
                                'current':{size:IVsize}
                                };
        this.array[key]['nChainsPerDiode'] = data.module.nChainsPerDiode;
        this.array[key]['nChains'] = data.module.nChainsPerDiode * data.module.nDiodes * data.nModules;
        this.array[key]['chain'] = {attribute:{},node:{}};
        for (let keyAttr in chainAttribute){
            this.array[key].chain.attribute[keyAttr] = new THREE.StorageBufferAttribute(new Float32Array(this.array[key].nChains*chainAttribute[keyAttr].size),1);
            this.array[key].chain.node[keyAttr] = storage(this.array[key].chain.attribute[keyAttr],'float',this.array[key].nChains*chainAttribute[keyAttr].size);
        }

        // Individual blocks
        const blockAttribute = {
                                'voltage':{size:IVsize},
                                'current':{size:IVsize}
                                };
        this.array[key]['nBlocks'] = data.module.nDiodes * data.nModules;
        this.array[key]['ImaxBlock'] = data.module.nChainsPerDiode*this.array[key].ImaxCell;
        this.array[key]['block'] = {attribute:{},node:{}};
        for (let keyAttr in blockAttribute){
            this.array[key].block.attribute[keyAttr] = new THREE.StorageBufferAttribute(new Float32Array(this.array[key].nBlocks*blockAttribute[keyAttr].size),1);
            this.array[key].block.node[keyAttr] = storage(this.array[key].block.attribute[keyAttr],'float',this.array[key].nBlocks*blockAttribute[keyAttr].size);
        }

        // Individual strings
        const stringAttribute = {
                                'voltage':{size:IVsize},
                                'current':{size:IVsize}
                                };
        this.array[key]['nBlocksPerString'] = data.nModules*data.module.nDiodes;
        this.array[key]['strings'] = data.strings;
        this.array[key]['string'] = {attribute:{},node:{}};
        for (let keyAttr in stringAttribute){
            this.array[key].string.attribute[keyAttr] = new THREE.StorageBufferAttribute(new Float32Array(this.array[key].strings.length*stringAttribute[keyAttr].size),1);
            this.array[key].string.node[keyAttr] = storage(this.array[key].string.attribute[keyAttr],'float',this.array[key].strings.length*stringAttribute[keyAttr].size);
        }

        // Upload the Lookup table used for that array
        this.array[key].nT = 32;
        this.array[key].nG = 64;
        this.array[key].nI = 2048;
        this.array[key].Tmin = -10;
        this.array[key].Tmax = 80;
        this.array[key].Gmin = 0;
        this.array[key].Gmax = 1200;
        this.array[key].IminCell = 0;
        this.array[key].ImaxCell = 10;
        //this.loadLUT(data.module.fileName,key);
        this.loadLUT(data.module.fileLUT,key);

        // Create the shaders required ////////////////////////////////////////
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
                                                    this.array[key].IminCell,
                                                    this.array[key].ImaxCell);
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
                Loop({start:0,end:this.array[key].nCellsPerChain},({i:i2}) => {
                    const cellIndex = instanceIndex.mul(this.array[key].nCellsPerChain*this.array[key].IVsize).
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
                const deltaVoltage = this.array[key].VchainMax - this.array[key].VchainMin;
                const voltage = Var(this.array[key].VchainMin).
                                add(float(i).mul(deltaVoltage).
                                div(this.array[key].IVsize-1));
                const data = this.binarySearchDecrease(instanceIndex,voltage,this.array[key].chain.node.voltage,this.array[key].IVsize);
                const globalIndex = instanceIndex.mul(this.array[key].IVsize).add(i);
                const value = (data.x).sub(data.y).mul(this.array[key].ImaxCell/(this.array[key].IVsize-1));
                this.array[key].chain.node.current.element(globalIndex).assign(value);
            });
        });

        // Blocks operation
        this.blocksCurrent = Fn(([key]) => {
            Loop({start:0,end:this.array[key].IVsize},({i:i1}) =>{
                const _i1 = i1.toVar();
                const value = Var(0.0);
                Loop({start:0,end:this.array[key].nChainsPerDiode},({i:i2}) => {
                    const chainIndex = instanceIndex.mul(this.array[key].nChainsPerDiode*this.array[key].IVsize).
                                      add(i2.mul(this.array[key].IVsize)).
                                      add(_i1);
                    value.addAssign(this.array[key].chain.node.current.element(chainIndex));
                });
                value.addAssign(this.diodeCurrent(this.array[key].voltageVector.element(i1).mul(-1)));
                const globalIndex = instanceIndex.mul(this.array[key].IVsize).add(i1);
                this.array[key].block.node.current.element(globalIndex).assign(value);
            });
        });
        this.blocksVoltage = Fn(([key]) => {
            Loop({start:0,end:this.array[key].IVsize},({i}) => {
                //const dummy = Var(this.array[key].IVsize).sub(1);
                const current = float(i).mul(this.array[key].nChainsPerDiode*this.array[key].ImaxCell).div(this.array[key].IVsize-1);
                const data = this.binarySearchDecrease(instanceIndex,current,this.array[key].block.node.current,this.array[key].IVsize);
                const globalIndex = instanceIndex.mul(this.array[key].IVsize).add(i);
                const value = (data.x).sub(data.y).mul((0.19191)).sub(1);
                this.array[key].block.node.voltage.element(globalIndex).assign(value);
            });
        });
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
                //const data = await renderer.getArrayBufferAsync(this.array[key].chain.attribute.current);
                //return new Float32Array(data);
                break;
            case 'blocksCurrent':
                await renderer.computeAsync(this.blocksCurrent(key).compute(this.array[key].nBlocks));
                //const data = await renderer.getArrayBufferAsync(this.array[key].block.attribute.current);
                //return new Float32Array(data);
                break;
            case 'blocksVoltage':
                await renderer.computeAsync(this.blocksVoltage(key).compute(this.array[key].nBlocks));
                //const data = await renderer.getArrayBufferAsync(this.array[key].block.attribute.voltage);
                //return new Float32Array(data);
                break;
            case 'stringsVoltage':
                await renderer.computeAsync(this.stringsVoltage(key).compute(this.array[key].nStrings));
                //const data = await renderer.getArrayBufferAsync(this.array[key].string.attribute.voltage);
                //return new Float32Array(data);
                break;
        }
    }
}
class PVmodule extends THREE.Group{
    constructor(){
        super();
    }
    async loadMesh(data){
        const loader = new OBJLoader();
        const textureLoader = new THREE.TextureLoader();
        const group = await loader.loadAsync(data.fileName);
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
    }
}
class PVlayout extends THREE.Group{
    constructor(data){
        super();
        const geometriesToMerge = [];
        const d = 1.15;
        const groups = [];
        this.nModules = data.nModules;
        //for (let i=0;i<data.nModules;i++){
        for (let i=0;i<data.position.length;i++){
            // TODO: Adapt with proper allocation of the modules in the space
            //const position = new THREE.Vector3(-d*(data.nModules-1)/2+d*i,0.0,0.0);
            //const rotation = new THREE.Euler(0.0,0.0,0.0);
            const position = new THREE.Vector3(data.position[i][0],data.position[i][1],data.position[i][2]);
            const rotation = new THREE.Euler(data.rotation[i][0]*Math.PI/180,
                                             data.rotation[i][1]*Math.PI/180,
                                             data.rotation[i][2]*Math.PI/180);
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
        this.pvLayout = data.pvLayout;
        const instancedMesh = new THREE.InstancedMesh(data.pvLayout.children[0].geometry,
                                                      data.pvLayout.children[0].material,
                                                      data.position.length);
        const dummy = new THREE.Object3D();
        for (let i=0;i<data.position.length;i++){
            dummy.position.set(data.position[i][0],data.position[i][1],data.position[i][2]);
            dummy.rotation.order = 'ZYX';
            dummy.rotation.set(data.rotation[i][0]*Math.PI/180,
                               data.rotation[i][1]*Math.PI/180,
                               data.rotation[i][2]*Math.PI/180);
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);
        }
        instancedMesh.castShadow = true;
        instancedMesh.receiveShadow = true;
        this.add(instancedMesh);

        this.analysisMaterial = new THREE.MeshBasicNodeMaterial();
        this.cellPosition = uniformArray([36, 37, 84, 85, 132, 133,
                                          35, 38, 83, 86, 131, 134,
                                          34, 39, 82, 87, 130, 135,
                                          33, 40, 81, 88, 129, 136,
                                          32, 41, 80, 89, 128, 137,
                                          31, 42, 79, 90, 127, 138,
                                          30, 43, 78, 91, 126, 139,
                                          29, 44, 77, 92, 125, 140,
                                          28, 45, 76, 93, 124, 141,
                                          27, 46, 75, 94, 123, 142,
                                          26, 47, 74, 95, 122, 143,
                                          25, 48, 73, 96, 121, 144,
                                          1, 24, 49, 72, 97, 120,
                                          2, 23, 50, 71, 98, 119,
                                          3, 22, 51, 70, 99, 118,
                                          4, 21, 52, 69, 100, 117,
                                          5, 20, 53, 68, 101, 116,
                                          6, 19, 54, 67, 102, 115,
                                          7, 18, 55, 66, 103, 114,
                                          8, 17, 56, 65, 104, 113,
                                          9, 16, 57, 64, 105, 112,
                                          10, 15, 58, 63, 106, 111,
                                          11, 14, 59, 62, 107, 110,
                                          12, 13, 60, 61, 108, 109
                                          ]);
        this.colorNode = Fn(() => {
            const analysisUv = attribute('analysisUv', 'vec2');
            const iModule = analysisUv.x.div(6).floor();
            const x = analysisUv.x.floor().sub(iModule.mul(6));
            const y = analysisUv.y.floor();
            const value = this.cellPosition.element(y.mul(6).add(x));
            //const x = analysisUv.x.floor().div(6*this.pvLayout.nModules);
            //const index = instanceIndex.mul(24);
            //const y = analysisUv.y.add(index).floor().div(72);
            //return vec4(y,x,0.0,1.0);
            //return (x.div(6),y.div(24),0.0,1.0);
            return (1.0,1.0,0.0,1.0);
        });
        this.analysisMaterial.colorNode = this.colorNode();
    }
}

export {Terrain, Sun, GPUengine, PVmodule, PVlayout, PVarray}