import * as THREE from 'three';
import { WebGPURenderer, SpriteNodeMaterial } from 'three/webgpu';
import { Fn, storage, instanceIndex, vec4, uv, int, float} from 'three/tsl';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

const nX = 128;
const height = 512;
const width = height*nX;

const PARTICLE_COUNT = width*height;
let renderer, arrayBuffer, cpuArray, scene, camera, controls;

renderer = new WebGPURenderer({ antialias: true });
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
const colorNode = Fn(() => {
    const x = int(uv().mul(height));
    const y = int(uv().mul(height));
    const index = y.mul(width).add(instanceIndex.mul(height).add(x));
    const value = buffer.element(index).div(width);
    //const grid = uv().mul(height).floor().div(height);
    return vec4(value,value,value,1.0);
    //return vec4(grid,0.0,1.0);
});

// Basic scene
let material = new THREE.MeshBasicNodeMaterial({color:0xff0000});
let geometry = new THREE.PlaneGeometry(1,1);
let dummy = new THREE.Object3D();
const dX = 2;

const L = dX*(nX-1);
const instancedMesh = new THREE.InstancedMesh(geometry,material,nX);
material.colorNode = colorNode();
/*
material.colorNode = Fn(()=>{
    const value = float(instanceIndex).div(nX);
    return vec4(value,0.0,0.0,1.0);
})();
*/
for (let i=0;i<nX;i++){
    dummy.position.set(-L/2+i*dX,0,0);
    dummy.updateMatrix();
    instancedMesh.setMatrixAt(i,dummy.matrix);
}
scene.add(instancedMesh);
scene.add(new THREE.AxesHelper(2));

// Main render loop
function animate() {
    controls.update();
    renderer.render(scene,camera);
}
renderer.setAnimationLoop(animate);

