// Import the required classes
import * as THREE from 'three';
import {WebGPURenderer} from 'three/webgpu';
import {instancedArray, Fn, compute, instanceIndex, float} from 'three/tsl';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
//import {GPUToolSet} from 'GPUEngine';
import {Test} from 'GPUEngine';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
//import JSZip from 'https://esm.sh/jszip@3.10.1';

//THREE.Node.captureStackTrace = true;

// Global variables
let scene, camera, renderer, controls;

/*
// Main canvas definition with wbGPU renderer
scene = new THREE.Scene();
scene.background = new THREE.Color(0xc0e6f5);
camera = new THREE.PerspectiveCamera(45,window.innerWidth/window.innerHeight,1,50000);
camera.position.set(4000,4000,500);
camera.up.set(0.0,0.0,1.0);
*/
renderer = new WebGPURenderer({antialias:true});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth,window.innerHeight);
document.body.appendChild( renderer.domElement );
//renderer.shadowMap.enabled = true;
//renderer.shadowMap.type = THREE.PCFSoftShadowMap;
await renderer.init();
//controls = new OrbitControls(camera, renderer.domElement);
//controls.enableDamping = true;
//controls.dampingFactor = 0.25;

/*
// Initiate GPUEngine
//const gpuToolSet = new GPUToolSet();
//const computeNode = gpuToolSet.shaderTest().compute(gpuToolSet.size*gpuToolSet.size);
const test = new Test();

// Basic scene elements
//const geometry = new THREE.BoxGeometry(1,1,1);
//const geometry = new THREE.PlaneGeometry (1,2);
//const material = new THREE.MeshBasicMaterial({map:gpuToolSet.storageTexture, side:THREE.DoubleSide});
//const material = new THREE.MeshBasicMaterial({color:0x000000, side:THREE.DoubleSide});

// Include Lighting
const directionalLight = new THREE.DirectionalLight (0xffffff,3.0);
//directionalLight.up = new THREE.Vector3(0.0,0.0,1.0);
directionalLight.position.set (5000.0,-5000.0,1000.0);
directionalLight.castShadow = true;
//directionalLight.shadow.camera.position.set(0.0,0.0,2500);
directionalLight.shadow.camera.near = 500;
directionalLight.shadow.camera.far = 10000;
directionalLight.shadow.camera.left = -5000;
directionalLight.shadow.camera.right = 5000;
directionalLight.shadow.camera.top = 5000;
directionalLight.shadow.camera.bottom = -5000;
directionalLight.shadow.mapSize.set(4096,4096);
//directionalLight.shadow.camera.updateProjectionMatrix();
scene.add(directionalLight);

// Load the terrain
const loader = new OBJLoader();
const terrain = await loader.loadAsync('static/Terrain_5km.obj');
terrain.material = new THREE.MeshStandardMaterial();
terrain.children[0].castShadow = true;
terrain.children[0].receiveShadow = true;
terrain.position.set(0.0,0.0,0);
scene.add(terrain);

// Add some helpers
scene.add(new THREE.AxesHelper(500));
const shadowHelper = new THREE.CameraHelper(directionalLight.shadow.camera);
const shadowHelper2 = new THREE.DirectionalLightHelper(directionalLight,500);
scene.add(shadowHelper);
scene.add(shadowHelper2);

// Load a bunch of modules
const nX = 100;
const nY = 1250;
const dX = 3.0;
const dY = 1.5;
const pvModule = new THREE.PlaneGeometry (1,2);
//const pvModule = new THREE.BoxGeometry(1,2,0.1);
const textureLoader = new THREE.TextureLoader();
const baseColorTexture = textureLoader.load('static/Poly_6x12_Front.jpg');
baseColorTexture.colorSpace = THREE.SRGBColorSpace;


//test.computeCells(3*12*100*1250);
//const arrayBuffer = await renderer.getArrayBufferAsync(test.dataBuffer);
const material = new THREE.MeshStandardMaterial({map:baseColorTexture, side:THREE.DoubleSide});
//const material = new THREE.MeshBasicNodeMaterial({side:THREE.DoubleSide});
//material.colorNode = vec4();

const instancedMesh = new THREE.InstancedMesh(pvModule, material, nX*nY);
const dummy = new THREE.Object3D();
for (let j=0; j<nY; j++){
    for (let i=0; i<nX; i++) {
        dummy.position.set(-0.5*(nX-1)*dX + dX*i,
                           -0.5*(nY-1)*dY + dY*j,
                            400);
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
instancedMesh.computeBoundingSphere();
scene.add(instancedMesh);
*/
//////////////////////////////////////////////////////
//////////////////////////////////////////////////////

const count = 1000;
const cpuData = new Float32Array(count);
//const storageAttribute = new THREE.StorageBufferAttribute(cpuData, 1);
//const myInstancedArray = instancedArray(storageAttribute);
const myInstancedArray = instancedArray(count,'float');
const computeKernel = Fn(() => {
  const index = instanceIndex;
  myInstancedArray.element(index).assign(index.toFloat().mul(2.5));
},count);

//await renderer.computeAsync(computeKernel);
renderer.compute(computeKernel);
//const arrayBuffer = await renderer.getArrayBufferAsync(storageAttribute);
//const resultData = new Float32Array(arrayBuffer);

//////////////////////////////////////////////////////
//////////////////////////////////////////////////////

/*
const computeNode = test.generateIndicesFn().compute(test.count);
await renderer.computeAsync(computeNode);
const arrayBuffer = await renderer.getArrayBufferAsync(test.storageAttr);
const resultFloats = new Float32Array(arrayBuffer);
const zip = new JSZip();
zip.file("floats_256.bin", resultFloats.buffer);
const zipBlob = await zip.generateAsync({ type: "blob",compression: "DEFLATE", compressionOptions: { level: 9 } });
const loadedZip = await JSZip.loadAsync(zipBlob);
const buffer = await loadedZip.file("floats_256.bin").async("arraybuffer");
const extractedFloats = new Float32Array(buffer);


const url = URL.createObjectURL(zipBlob);
const link = document.createElement('a');
link.href = url;
link.download = "data.zip";
document.body.appendChild(link);
link.click();
document.body.removeChild(link);
URL.revokeObjectURL(url);
*/

// Animation loop
/*
function animate() {
    controls.update();
    //renderer.compute(computeNode);
    renderer.render(scene,camera);
}
renderer.setAnimationLoop(animate);
*/