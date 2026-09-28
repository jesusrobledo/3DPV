import * as THREE from 'three';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {positionView,positionWorld} from 'three/tsl';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { uv, Fn } from 'three/tsl';

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

export {Terrain, Sun, PVmodule, PVstring, PVplant}