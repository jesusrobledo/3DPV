import * as THREE from 'three';
import { WebGPURenderer, SpriteNodeMaterial } from 'three/webgpu';
import { Fn, storage, instanceIndex, vec4, uv, int, float, uniformArray} from 'three/tsl';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';

const nX = 15;
const height = 16;
const width = height*nX;

const cellPosition = uniformArray([
  84, 85, 108, 109, 132, 133,
  83, 86, 107, 110, 131, 134,
  82, 87, 106, 111, 130, 135,
  81, 88, 105, 112, 129, 136,
  80, 89, 104, 113, 128, 137,
  79, 90, 103, 114, 127, 138,
  78, 91, 102, 115, 126, 139,
  77, 92, 101, 116, 125, 140,
  76, 93, 100, 117, 124, 141,
  75, 94, 99, 118, 123, 142,
  74, 95, 98, 119, 122, 143,
  73, 96, 97, 120, 121, 144,
  1, 24, 25, 48, 49, 72,
  2, 23, 26, 47, 50, 71,
  3, 22, 27, 46, 51, 70,
  4, 21, 28, 45, 52, 69,
  5, 20, 29, 44, 53, 68,
  6, 19, 30, 43, 54, 67,
  7, 18, 31, 42, 55, 66,
  8, 17, 32, 41, 56, 65,
  9, 16, 33, 40, 57, 64,
  10, 15, 34, 39, 58, 63,
  11, 14, 35, 38, 59, 62,
  12, 13, 36, 37, 60, 61
]);

const PARTICLE_COUNT = width*height;
let renderer, arrayBuffer, cpuArray, scene, camera, controls;

renderer = new WebGPURenderer({ antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
await renderer.init();

let attribute = new THREE.StorageBufferAttribute(new Float32Array(PARTICLE_COUNT), 1);
const buffer = storage(attribute, 'float', PARTICLE_COUNT);
attribute.dispose();
const shader = Fn(() => {
    const x = instanceIndex.mod(width);
    const y = instanceIndex.div(height);
    buffer.element(instanceIndex).assign(x);
});
const node = shader().compute(PARTICLE_COUNT);
renderer.compute(node);
//arrayBuffer = await renderer.getArrayBufferAsync(attribute);
//cpuArray = new Float32Array(arrayBuffer);

// Three.js scene setup
scene = new THREE.Scene();
scene.background = new THREE.Color(0x888888);
camera = new THREE.PerspectiveCamera(45,window.innerWidth/window.innerHeight,0.1,1000);
camera.position.set(5,5,1);
camera.up.set(0.0,0.0,1.0);
controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.25;

// Test to use the information stored in the VRAM of the GPU to generate a texture
/*
const colorNode = Fn(() => {
    const x = int(uv().mul(height));
    const y = int(uv().mul(height));
    const index = y.mul(width).add(instanceIndex.mul(height).add(x));
    const value = buffer.element(index).div(width);
    //const grid = uv().mul(height).floor().div(height);
    return vec4(value,value,value,1.0);
    //return vec4(grid,0.0,1.0);
});
*/
const colorNode = Fn(() => {
    const x = uv().x.mul(6).floor();
    const y = uv().y.mul(24).floor();
    const index = int(y.mul(6).add(x));
    const value = float(instanceIndex).mul(144).add(cellPosition.element(index)).div(144*nX);
    //const value = cellPosition.element(index).div(144);
    //const value = float(instanceIndex).div(nX);
    return vec4(value,value,value,1.0);
});


// Basic scene

//let geometry = new THREE.PlaneGeometry(1,1);

let light = new THREE.DirectionalLight(0xffffff,3.0);
light.up = new THREE.Vector3(0.0,0.0,1.0);
light.position.set(0.0,-2.0,10.0);
let cube = new THREE.Mesh(new THREE.BoxGeometry(0.25,0.25,0.25), new THREE.MeshLambertMaterial());
let plane = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.5,0.01), new THREE.MeshLambertMaterial({color:0x00ff00}));
cube.position.set(0.0,0.0,1.0);
cube.castShadow = true;
cube.receiveShadow = true;
plane.castShadow = true;
plane.receiveShadow = true;
light.castShadow = true;
light.shadow.camera.near = 0.1;
light.shadow.camera.far = 100;
light.shadow.camera.left = -5;
light.shadow.camera.right = 5;
light.shadow.camera.top = 5;
light.shadow.camera.bottom = -5;
light.shadow.camera.updateProjectionMatrix();
light.shadow.mapSize.set(4096,4096);
plane.position.set(0.0,0.0,0.5);
const dX = 2;

const loader = new OBJLoader();
const textureLoader = new THREE.TextureLoader();
let material = new THREE.MeshBasicNodeMaterial();
let material2 = [new THREE.MeshPhongMaterial(),
                 new THREE.MeshPhongMaterial(),
                 new THREE.MeshPhongMaterial()];
material2[0].map = textureLoader.load('static/PV_modules/1/textures/Mono_6x24_Front.jpg');
material2[1].map = textureLoader.load('static/PV_modules/1/textures/Mono_6x24_Rear_Bifacial.jpg');
material2[2].map = textureLoader.load('static/PV_modules/1/textures/Aluminium.jpg');
let instancedMesh;
loader.load('/static/PV_modules/1/Test.obj',async(group) =>{
    let dummy = new THREE.Object3D();
    const L = dX*(nX-1);
    //instancedMesh = new THREE.Mesh(group.children[0].geometry,material2);
    material.colorNode = colorNode();

    instancedMesh = new THREE.InstancedMesh(group.children[0].geometry,material2,nX);

    for (let i=0;i<nX;i++){
        dummy.position.set(-L/2+i*dX,0,0);
        dummy.rotation.set(0.0,Math.PI*i,0.0);
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i,dummy.matrix);
    }

    scene.add(instancedMesh);
    instancedMesh.receiveShadow = true;
});


/*
material.colorNode = Fn(()=>{
    const value = float(instanceIndex).div(nX);
    return vec4(value,0.0,0.0,1.0);
})();
*/

scene.add(new THREE.AxesHelper(2));
scene.add(light);
scene.add(cube);
scene.add(plane);
scene.add(new THREE.CameraHelper(light.shadow.camera));
scene.add(new THREE.DirectionalLightHelper(light,500));

// Main render loop
function animate() {
    controls.update();
    renderer.render(scene,camera);
}
renderer.setAnimationLoop(animate);

const button1 = document.getElementById('button1');
const button2 = document.getElementById('button2');
const button3 = document.getElementById('button3');
button1.addEventListener('click', ()=>{
    instancedMesh.material = [material,material2[1],material2[2]];
});
button2.addEventListener('click', ()=>{
    instancedMesh.material = material2;
});


