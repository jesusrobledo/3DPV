// Import the required classes
import * as THREE from 'three';
import {WebGPURenderer} from 'three/webgpu';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GPUToolSet} from 'GPUEngine';

// Global variables
let scene, camera, renderer, controls;

// Main canvas definition with wbGPU renderer
scene = new THREE.Scene();
camera = new THREE.PerspectiveCamera(60,window.innerWidth/window.innerHeight,0.1,1000);
camera.position.set(0,0,120);
renderer = new WebGPURenderer({antialias:true});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth,window.innerHeight);
document.body.appendChild( renderer.domElement );
controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.25;

// Initiate GPUEngine
const gpuToolSet = new GPUToolSet();
const computeNode = gpuToolSet.shaderTest().compute(gpuToolSet.size*gpuToolSet.size);

// Basic scene elements
const geometry = new THREE.BoxGeometry(1,1,1);
const material = new THREE.MeshBasicMaterial({map:gpuToolSet.storageTexture});

const nBoxes = 10000;
const instancedMesh = new THREE.InstancedMesh(geometry, material, nBoxes);
const dummy = new THREE.Object3D();
for (let i = 0; i < nBoxes; i++) {
  dummy.position.set((Math.random() - 0.5) * 100,
                     (Math.random() - 0.5) * 100,
                     (Math.random() - 0.5) * 100);
  dummy.updateMatrix();
  instancedMesh.setMatrixAt(i, dummy.matrix);
}

scene.add(instancedMesh);

// Animation loop
await renderer.init();
function animate() {
    controls.update();
    renderer.compute(computeNode);
    renderer.render(scene,camera);
}
renderer.setAnimationLoop(animate);
