import * as THREE from 'three';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {positionView,positionWorld} from 'three/tsl';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

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
        this.updateShadowCamera(50,10000,-50,50,-50,50);
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
class PVmodule extends THREE.Group{
    constructor(){
        super();
    }
    loadMesh(fileName){
        const loader = new OBJLoader();
        const textureLoader = new THREE.TextureLoader();
        loader.load(fileName,async(group) =>{
            for (let i=0;i<group.children.length;i++){
                const child = group.children[i];
                if (child.isMesh){
                    const indexedGeometry = BufferGeometryUtils.mergeVertices(child.geometry);
                    child.geometry.dispose();
                    child.geometry = indexedGeometry;
                }
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
            //this.children[0].rotation.set(Math.PI/180*90,0,0);
        });
    }
}
class Terrain extends THREE.Group{
    constructor(){
        super();
    }
    loadMesh(fileName){
        const loader = new OBJLoader();
        const textureLoader = new THREE.TextureLoader();
        loader.load(fileName,async(group) =>{
            for (let i=0;i<group.children.length;i++){
                const child = group.children[i];
                if (child.isMesh){
                    const indexedGeometry = BufferGeometryUtils.mergeVertices(child.geometry);
                    child.geometry.dispose();
                    child.geometry = indexedGeometry;
                }
            }
            super.copy(group,true);
            this.children[0].material = new THREE.MeshStandardMaterial({color:0xffffff,
                                                                        map:textureLoader.load('static/textures/Terrain.jpg')});
            this.children[0].castShadow = true;
            this.children[0].receiveShadow = true;
        });
    }
    generateHeightMap(renderer){
        const targetOptions = {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            type: THREE.FloatType, // Store un-clipped 32-bit float values
            format: THREE.RGBAFormat
          };
        this.heightRenderTarget = new THREE.RenderTarget(2048, 2048, targetOptions);
        const scene = new THREE.Scene();
        const orthoCamera = new THREE.OrthographicCamera(-2500, 2500, 2500, -2500, 0.1, 1000);
        orthoCamera.up.set(0, 1, 0);
        orthoCamera.position.set(0, 0, 1000); // Above terrain facing down
        orthoCamera.lookAt(0, 0, 0);
        //orthoCamera.updateProjectionMatrix();
        orthoCamera.projectionMatrix.elements[5] *= -1;
        const geometry = this.children[0].geometry;
        const material = new THREE.MeshBasicNodeMaterial();
        material.colorNode = positionView.z.add(1000).div(1000);
        scene.add(new THREE.Mesh(geometry,material));
        renderer.setRenderTarget(this.heightRenderTarget);
        renderer.render(scene,orthoCamera);
        renderer.setRenderTarget(null);
        this.children[0].material = new THREE.MeshBasicMaterial();
        //this.children[0].material = new THREE.MeshBasicNodeMaterial();
        //this.children[0].material.colorNode = positionWorld.z.add(0).div(1000);
        //this.heightRenderTarget.texture.flipY = false;
        this.children[0].material.map = this.heightRenderTarget.texture;
    }
}
class PVstring extends THREE.Group{
    constructor(pvModule){
        super();
        const geometriesToMerge = [];
        const n = 30;
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
            geometry.applyMatrix4(matrix);
            geometriesToMerge.push(geometry);
            groups.push({start:36*i,count:6,materialIndex:0});
            groups.push({start:36*i+6,count:6,materialIndex:1});
            groups.push({start:36*i+12,count:6,materialIndex:2});
        }
        const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometriesToMerge,true);
        mergedGeometry.groups = groups;
        //pvModule.children[0].material.side = THREE.DoubleSide;
        const mesh = new THREE.Mesh(mergedGeometry,pvModule.children[0].material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.add(mesh);
    }
}
class PVplant extends THREE.Object3D{
    constructor(pvString){
        super();
        const nX = 500;
        const nY = 50;
        const dX = 5;
        const dY = 35;
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
        this.add(instancedMesh);
    }
}

export {Terrain, Sun, PVmodule, PVstring, PVplant}