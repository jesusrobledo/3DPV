import * as THREE from 'three';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {positionView,positionWorld} from 'three/tsl';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { uint, uv, vec3, texture3D, storage, Fn, instanceIndex, uniform, array, Loop, instancedArray, Var, float } from 'three/tsl';
//import * as JSZip from 'jszip';
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

        // Basic array definition
        /*
        module = {model:"test",
                  nDiodes:3,
                  nChainsPerDiode:1,
                  nCellsPerDiode:20
                  };
        nModules = 1;
        */

        // LUT definition
        /*
        nT: 16,
        nG: 32,
        nI: 512,
        Tmin: -10,
        Tmax: 80,
        Gmin: 0,
        Gmax: 1200,
        Imin: 0,
        Imax: 10
        */
    });
    createArray(data){
        const key = data.key;
        const IVsize = 100;

        this.array[key] = {};

        // Load the Look Up Table for the IV curves
        loadLUT(data.fileName,key);

        // Create the structure required //////////////////////////////////////

        // Individual cells
        const cellAttribute = {'irradiance':{size:1},
                              'temperature':{size:1},
                              'voltage':{size:IVsize}
                              };
        this.array[key]['nCells'] = data.module.nCellsPerDiode * data.module.nDiodes * data.nModules;
        this.array[key]['cellAttribute'] = {};
        this.array[key]['cellStorage'] = {};
        for (let keyAttr of cellAttribute){
            this.array[key].cellAttribute[keyAttr] = new THREE.StorageBufferAttribute(new Float32Array(this.array[key].nCells),cellAttribute[keyAttr].size);
            this.array[key].cellStorage[keyAttr] = storage(this.cellAttribute[key],'float',this.array[key].nCells);
        }

        // Individual chains
        const chainAttribute = {'voltage':{size:IVsize}};
        this.array[key]['nChains'] = data.module.nChainsPerDiode * data.module.nDiodes * data.nModules;
        this.array[key]['chainAttribute'] = {};
        this.array[key]['chainStorage'] = {};
        for (let keyAttr of chainAttribute){
            this.array[key].chainAttribute[keyAttr] = new THREE.StorageBufferAttribute(new Float32Array(this.array[key].nChains),chainAttribute[keyAttr].size);
            this.array[key].chainStorage[keyAttr] = storage(this.chainAttribute[key],'float',this.array[key].nChains);
        }

        // IV formatting
        this.array[key].IVsize = IVsize;

        const current = new Float32Array(IVsize);
        for (let i=0;i<IVsize;i++)
            current[i] = 10.0/(IVsize-1)*i;
        this.array[key]['IVcurrent'] = instancedArray( current, 'float' );

        const chainVoltage = new Float32Array(IVsize);
        for (let i=0;i<IVsize;i++)
            chainVoltage[i] = -1.0 + 15.0/(IVsize-1)*i;
        this.array[key]['IVchainVoltage'] = instancedArray( chainVoltage, 'float' );

    }

    constructor(options = {}){

        // LUT upload - In the
        Object.assign(this,GPUengine.DEFAULTS,options);
        //this.loadLUT(options.fileName);

        // Main attributes
        this.array = {};



        /*
        this.nCells = null;
        this.cellAttr = {};
        this.cellStorage = {};
        this.chainAttr = {};
        this.chainStorage = {};
        this.cellsPerChain = 20;
        this.nVoltage = 100;
        */
        ///////////////////////////////////////////////////////////////////////
        // Test for the uniform values on the current
        /*
        const current = new Float32Array(100);
        for (let i=0;i<100;i++){
            current[i] = 0.1*i;
        }
        this.current = instancedArray( current, 'float' );
        */
        const irradiance = new Float32Array(40);
        for (let i=0;i<40;i++){
            irradiance[i] = 900.0;
        }
        irradiance[0] = 900.0;
        irradiance[20] = irradiance[21] = 600.0;
        this.irradiance = instancedArray (irradiance,'float');

        ///////////////////////////////////////////////////////////////////////

        // Shaders definition
        /*
        //this.uniformIrradiance = uniform(900.0);
        //this.uniformTemperature = uniform(25.0);
        */
        // General purpose
        this.normalizeValue = Fn (([x,min,max]) => {
            return x.sub(min).div(max.sub(min));
        });

        // Memory transfer from CPU to GPU
        this.cellsIrradiance = Fn(() => {
            this.array.baseline.cellStorage.irradiance.element(instanceIndex).assign(this.irradiance.element(instanceIndex));
        });
        this.cellsTemperature = Fn(() => {
            this.cellStorage.temperature.element(instanceIndex).assign(this.uniformTemperature);
        });

        this.cellsVoltage = Fn(() => {
            // Normalizing
            //const irradiance = this.normalizeValue(this.cellStorage.irradiance.element(instanceIndex),this.Gmin,this.Gmax);
            //const temperature = this.normalizeValue(this.cellStorage.temperature.element(instanceIndex),this.Tmin,this.Tmax);
            const irradiance = this.normalizeValue(this.array.baseline.cellStorage.irradiance.element(instanceIndex),this.array.baseline.Gmin,this.array.baseline.Gmax);
            const temperature = this.normalizeValue(this.array.baseline.cellStorage.temperature.element(instanceIndex),this.array.baseline.Tmin,this.array.baseline.Tmax);

            Loop({start:0,end:this.array.baseline.IVsize},({i}) => {
                const current = this.normalizeValue(this.current.element(i),this.array.baseline.Imin,this.array.baseline.Imax);
                const data = vec3(temperature,irradiance,current);
                const value = texture3D(this.LUT,data).r;
                const globalIndex = instanceIndex.mul(this.array.baseline.IVsize).add(i);
;               this.array.baseline.cellStorage.voltageArray.element(globalIndex).assign(value);
            });

        });
        this.chainsVoltage = Fn(() =>{
            Loop({start:0,end:this.array.baseline.IVsize},({i:i1}) =>{
                const _i1 = i1.toVar();
                const value = Var(0.0);
                Loop({start:0,end:this.array.baseline.nCellsPerDiode},({i:i2}) => {
                    const cellIndex = instanceIndex.mul(this.array.baseline.nCellsPerDiode*this.array.baseline.IVsize).
                                      add(i2.mul(this.array.baseline.IVsiz)).
                                      add(_i1);
                    value.addAssign(this.array.baseline.cellStorage.voltage.element(cellIndex));
                });
                const chainIndex = instanceIndex.mul(this.array.baseline.IVsize).add(i1);
                this.array.baseline.chainStorage.voltage.element(chainIndex).assign(value);
            });
        });
    }

    async loadLUT(fileName,key){
        const response = await fetch(fileName);
        const blob = await response.blob();
        const zip = await JSZip.loadAsync(blob);
        const binBuffer = await zip.file('lut_data.bin').async('arraybuffer');
        const floatData = new Float32Array(binBuffer);
        this.array[key].LUT = new THREE.Data3DTexture(floatData,this.nT,this.nG,this.nI);
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
    async test(shader,renderer,LUT){
        switch (shader){
            case "temperature":
                await renderer.computeAsync(this.cellsTemperature().compute(this.nCells));
                break;
            case "irradiance":
                await renderer.computeAsync(this.cellsIrradiance().compute(this.nCells));
                break;
            case "voltage":
                await renderer.computeAsync(this.cellsVoltage().compute(this.nCells));

                //const data = await renderer.getArrayBufferAsync(this.cellAttr.voltageArray);
                //return new Float32Array(data);

                break;
            case "chainVoltage":
                await renderer.computeAsync(this.chainsVoltage().compute(this.nChains));
                const data = await renderer.getArrayBufferAsync(this.chainAttr.voltageArray);
                return new Float32Array(data);
                break;
        }
    }
    addArray(nCells,nChains){
        this.nCells = nCells;
        this.nChains = nChains;
        this.cellAttr = {};
        this.cellStorage = {};
        const cellAttributes = ['irradiance','temperature'];
        for (let key of cellAttributes){
            this.cellAttr[key] = new THREE.StorageBufferAttribute(new Float32Array(this.nCells),1);
            this.cellStorage[key] = storage(this.cellAttr[key],'float',this.nCells);
        }
        this.cellAttr['voltageArray'] = new THREE.StorageBufferAttribute(new Float32Array(this.nCells*100),1);
        this.cellStorage['voltageArray'] = storage(this.cellAttr['voltageArray'],'float',this.nCells*100);

        this.chainAttr['voltageArray'] = new THREE.StorageBufferAttribute(new Float32Array(this.nChains*100),1);
        this.chainStorage['voltageArray'] = storage(this.chainAttr['voltageArray'],'float',this.nChains*100);
    }
}

///////////////////////////////////////////////////////////////////////////////
class PVcell{
    static DEFAULTS = Object.freeze({
        nT: 32,
        nG: 64,
        nI: 2048,
        Tmin: -10,
        Tmax: 80,
        Gmin: 0,
        Gmax: 1200,
        Imin: 0,
        Imax: 10
    });
    constructor(options = {}){
        Object.assign(this,PVcell.DEFAULTS,options);
        this.loadLUT(options.fileName);
    }
    async loadLUT(fileName){
        const response = await fetch(fileName);
        const blob = await response.blob();
        const zip = await JSZip.loadAsync(blob);
        const binBuffer = await zip.file('lut_data.bin').async('arraybuffer');
        const floatData = new Float32Array(binBuffer);
        this.LUT = new THREE.Data3DTexture(floatData,this.nT,this.nG,this.nI);
        this.LUT.format = THREE.RedFormat;
        this.LUT.type = THREE.FloatType;
        this.LUT.minFilter = THREE.LinearFilter;
        this.LUT.magFilter = THREE.LinearFilter;
        this.LUT.wrapS = THREE.ClampToEdgeWrapping;
        this.LUT.wrapT = THREE.ClampToEdgeWrapping;
        this.LUT.wrapR = THREE.ClampToEdgeWrapping;
        this.LUT.needsUpdate = true;
        alert ("LUT loaded");
    }
}
class PVarray{
    constructor(){

    }
}
class _PVcell{
    constructor(nT,nG,nI,fileName){
        this.nT = nT;
        this.nG = nG;
        this.nI = nI;
        this.Tmin = -10;
        this.Tmax = 80;
        this.Gmin = 0;
        this.Gmax = 1200;
        this.Imin = 0;
        this.Imax = 10;
        this.LUT = null;
        this.loadLUT(fileName);
        /*
        this.sampleLUT = (posCoords) => {
            const size = vec3(this.nT,this.nG,this.nI);
            const normalizedUV = posCoords.div(size);
            return texture3D(this.LUT,normalizedUV).r;
        }
        */
        this.n = 10;
        const inputData = new Float32Array(3*this.n);
        const outputData = new Float32Array(this.n);
        this.attrData = new THREE.StorageBufferAttribute(outputData,1);
        this.inputData = storage(
            new THREE.StorageBufferAttribute(inputData,3),
            'vec3',
            this.n
        );
        this.outputData = storage(
            this.attrData,
            'float',
            this.n
        );
        this.sampleLUT = Fn(() => {
            const posCoords = this.inputData.element(instanceIndex);
            const value = texture3D(this.LUT,posCoords).r;
            this.outputData.element(instanceIndex).assign(value);
        });
    }
    async test(data,renderer){
        this.inputData = storage(
            new THREE.StorageBufferAttribute(data,3),
            'vec3',
            this.n
        );
        await renderer.computeAsync(this.sampleLUT().compute(10));
        const check = await renderer.getArrayBufferAsync(this.attrData);
        const result = new Float32Array(check);
        return result;
    }
    async loadLUT(fileName){
        const response = await fetch(fileName);
        const blob = await response.blob();
        const zip = await JSZip.loadAsync(blob);
        const binBuffer = await zip.file('lut_data.bin').async('arraybuffer');
        const floatData = new Float32Array(binBuffer);
        this.LUT = new THREE.Data3DTexture(floatData,this.nT,this.nG,this.nI);
        this.LUT.format = THREE.RedFormat;
        this.LUT.type = THREE.FloatType;
        this.LUT.minFilter = THREE.LinearFilter;
        this.LUT.magFilter = THREE.LinearFilter;
        this.LUT.wrapS = THREE.ClampToEdgeWrapping;
        this.LUT.wrapT = THREE.ClampToEdgeWrapping;
        this.LUT.wrapR = THREE.ClampToEdgeWrapping;
        this.LUT.needsUpdate = true;
        alert ("Data loaded");
    }
    /*
    voltage (T,G,I){
        const data = vec3((T-this.Tmin)/(this.Tmax-this.Tmin)*this.nT,
                          (G-this.Gmin)/(this.Gmax-this.Gmin)*this.nG,
                          (I-this.Imin)/(this.Imax-this.Imin)*this.nI);
        const test = this.sampleLUT(data);
        return test;
    }
    */
}
class PVmodule extends THREE.Group{
    constructor(){
        super();
    }
    loadMesh(fileName){
        const loader = new OBJLoader();
        const textureLoader = new THREE.TextureLoader();
        loader.load(fileName,async(group) =>{
            if (group.children.length == 1){
                const indexedGeometry = BufferGeometryUtils.mergeVertices(group.children[0].geometry);
                group.children[0].geometry.dispose();
                group.children[0].geometry = indexedGeometry;
            }
            else{
                // Report some error
            }
            super.copy(group,true);
            this.children[0].material[0].map = textureLoader.load('static/PV_modules/1/textures/Mono_6x24_Front.jpg');
            this.children[0].material[1].map = textureLoader.load('static/PV_modules/1/textures/Mono_6x24_Rear_Bifacial.jpg');
            this.children[0].material[2].map = textureLoader.load('static/PV_modules/1/textures/Aluminium.jpg');
            //this.children[0].material[0].map = textureLoader.load('static/PV_modules/2/textures/Mono_6x24_Front.jpg');
            //this.children[0].material[1].map = textureLoader.load('static/PV_modules/2/textures/Mono_6x24_Rear_Bifacial.jpg');
            //this.children[0].material[2].map = textureLoader.load('static/PV_modules/2/textures/Aluminium.jpg');
            this.children[0].castShadow = true;
            this.children[0].receiveShadow = true;
        });
    }
}
class PVstring extends THREE.Group{
    constructor(pvModule){
        super();
        const geometriesToMerge = [];
        const n = 5;
        const d = 1.15;
        const groups = [];
        /*
        for (const material of pvModule.children[0].material)
            material.side = THREE.DoubleSide;
        */
        for (let i=0;i<n;i++){
            const position = new THREE.Vector3(-d*(n-1)/2+d*i,0.0,0.0);
            const rotation = new THREE.Euler(0.0,0.0,0.0);
            const scale = new THREE.Vector3(1,1,1);
            const quaternion = new THREE.Quaternion().setFromEuler(rotation);
            const matrix = new THREE.Matrix4();
            matrix.compose(position,quaternion,scale);
            const geometry = pvModule.children[0].geometry.clone();
            const uvArray = new Float32Array(pvModule.children[0].geometry.attributes.uv.array.length);
            uvArray.set(pvModule.children[0].geometry.attributes.uv.array);
            ///////////////////////////////////////////////////////////////////
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

            groups.push({start:36*i,count:6,materialIndex:0});
            groups.push({start:36*i+6,count:6,materialIndex:1});
            groups.push({start:36*i+12,count:24,materialIndex:2});

            //groups.push({start:588*i,count:216,materialIndex:0});
            //groups.push({start:588*i+216,count:216,materialIndex:1});
            //groups.push({start:588*i+432,count:156,materialIndex:2});

        }
        const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometriesToMerge,true);
        mergedGeometry.groups = groups;
        //pvModule.children[0].material[0].side = THREE.DoubleSide;
        //pvModule.children[0].material[1].side = THREE.DoubleSide;
        //pvModule.children[0].material[2].side = THREE.DoubleSide;
        /*
        const materialTest = new THREE.MeshStandardNodeMaterial({
          roughness: 0.3,
          metalness: 0.1
        });
        materialTest.colorNode = Fn(() =>{
            return vec4(1.0,0.0,0.0,1.0);
        });
        */
        //const mesh = new THREE.Mesh(mergedGeometry,pvModule.children[0].material);

        const mesh = new THREE.Mesh(mergedGeometry,pvModule.children[0].material);

        mesh.castShadow = true;
        //mesh.receiveShadow = false;
        mesh.receiveShadow = true;
        //mesh.position.set(0.0,0.0,275.0);
        //mesh.rotation.set(Math.PI/4,0.0,0.0);
        this.add(mesh);
    }
}
class PVplant extends THREE.Object3D{
    constructor(pvString){
        super();
        const nX = 3;
        const nY = 1;
        const dX = -5;
        const dY = 6;
        const instancedMesh = new THREE.InstancedMesh(pvString.children[0].geometry, pvString.children[0].material, nX*nY);
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
        //instancedMesh.receiveShadow = false;
        this.add(instancedMesh);
    }
}
///////////////////////////////////////////////////////////////////////////////

export {Terrain, Sun, PVcell, PVmodule, PVstring, PVplant, PVarray, GPUengine}