///////////////////////////////////////////////////////////////////////////////
// Libraries and classes imported
import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {Terrain, Sun, PVcell, PVmodule, PVstring, PVplant, PVarray, GPUengine } from 'classes';
import { uv, Fn, int, uniformArray, vec4, attribute, instanceIndex, compute, storage, texture3D, vec3} from 'three/tsl';

// Renderer initialization ////////////////////////////////////////////////////
// TO DO - Responsive window
let renderer = new WebGPURenderer({ antialias: true });
const width = document.getElementById('canvas3D').clientWidth;
const height = window.innerHeight-62;
renderer.setSize(width,height);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
await renderer.init();
document.getElementById("canvas3D").appendChild(renderer.domElement );

// Three.js scene setup ///////////////////////////////////////////////////////
let scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera(45,width/height,1,40000);
let sceneIndices = {};
camera.position.set(5000.0,5000.0,2000.0);
camera.up.set(0.0,0.0,1.0);
let controls = new OrbitControls(camera, renderer.domElement);
scene.background = new THREE.Color(0x87CEEB);

// Basic scene ////////////////////////////////////////////////////////////////
// TO DO - Adapt scene filed of view and shadow field of view

const sun = new Sun();
const terrain = new Terrain('/static/Terrain_5km_UV.obj','/static/textures/Terrain.jpg');
const shadowHelper = new THREE.CameraHelper(sun.light.shadow.camera);

scene.add(sun.light);
scene.add(shadowHelper);
sceneIndices['sunFOV'] = scene.children[scene.children.length-1].id;

scene.add(terrain);
sceneIndices['terrain'] = scene.children[scene.children.length-1].id;

scene.add(new THREE.AxesHelper(2000));
sceneIndices['localAxis'] = scene.children[scene.children.length-1].id;

//let pvCell = new PVcell({nT:16,nG:32,nI:512,fileName:'static/Test.zip'});
let gpuEngine = new GPUengine({nT:32,nG:64,nI:2048,fileName:'static/Test.zip'});
//let pvArray = new PVarray(1000);
/*
let pvModule = new PVmodule();
pvModule.loadMesh('/static/PV_modules/1/Test.obj');
pvModule.position.set(0.0,0.0,250.0);
let material = new THREE.MeshBasicNodeMaterial();
let material2 = [new THREE.MeshPhongMaterial(),
                 new THREE.MeshPhongMaterial(),
                 new THREE.MeshPhongMaterial()];
const textureLoader = new THREE.TextureLoader();
material2[0].map = textureLoader.load('static/PV_modules/1/textures/Mono_6x24_Front.jpg');
material2[1].map = textureLoader.load('static/PV_modules/1/textures/Mono_6x24_Rear_Bifacial.jpg');
material2[2].map = textureLoader.load('static/PV_modules/1/textures/Aluminium.jpg');
const colorNode = Fn(() => {
    const analysisUv = attribute('analysisUv', 'vec2');
    const x = analysisUv.x.floor().div(30);
    const index = instanceIndex.mul(24);
    const y = analysisUv.y.add(index).floor().div(72);
    return vec4(y,x,0.0,1.0);
});
material.colorNode = colorNode();
//pvModule.loadMesh('/static/PV_modules/2/Standard_Mono144.obj');
let pvString;
let pvPlant;
*/

// Interface control
const keysPressed = {};

window.addEventListener('keydown', (event) => {
    keysPressed[event.code] = true;
});
window.addEventListener('keyup', (event) => {
    keysPressed[event.code] = false;
});
window.addEventListener('mousedown', (event) =>{
    if (event.which == 2)
        event.preventDefault();
});
window.addEventListener('auxclick', (event) =>{
    if (event.which == 2)
        identifyPointerPosition(event);
});

function handleKeyboard(){
    // Arrow keys or WASD controls
    if (keysPressed['KeyW']) {
        sun.elevation += 1;
        sun.updatePosition(sun.azimuth,sun.elevation);
    }
    if (keysPressed['KeyS']) {
        sun.elevation -= 1;
        sun.updatePosition(sun.azimuth,sun.elevation);
    }
    if (keysPressed['KeyA']) {
        sun.azimuth -= 1;
        sun.updatePosition(sun.azimuth,sun.elevation);
    }
    if (keysPressed['KeyD']) {
        sun.azimuth += 1;
        sun.updatePosition(sun.azimuth,sun.elevation);
    }
    if (keysPressed['KeyZ']) {
        scene.getObjectById(sceneIndices.test).position.z += 1;
    }
    if (keysPressed['KeyX']) {
        scene.getObjectById(sceneIndices.test).position.z -= 1;
    }
}
function identifyPointerPosition(event){
    const mouse = new THREE.Vector3();
    const raycaster = new THREE.Raycaster();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY-58) / (window.innerHeight-75) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    //const intersects = raycaster.intersectObjects([terrain.children[0],pvPlant.children[0]]);
    //const intersects = raycaster.intersectObjects([terrain.children[0],pvString.children[0]]);
    const intersects = raycaster.intersectObjects([terrain.children[0]]);
    if (intersects.length){
        scene.getObjectById(sceneIndices.localAxis).position.copy(intersects[0].point);
        controls.target = intersects[0].point;
    }
}

// Main render loop
function animate() {
    controls.update();
    handleKeyboard();
    renderer.render(scene,camera);
}

renderer.setAnimationLoop(animate);

// GUI interactions
const button0 = document.getElementById('button0');
const button1 = document.getElementById('button1');
const button2 = document.getElementById('button2');
const button3 = document.getElementById('button3');
button0.addEventListener('click', async ()=>{
    gpuEngine.addArray(10);
    await gpuEngine.test('irradiance',renderer);
    await gpuEngine.test('temperature',renderer);
    gpuEngine.test('voltage',renderer).then(result => {
        var x=Array.from(result);
        var x = 0;
    });
    /*
    const response = await fetch('/load_case',{
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({name:"5Km"})
    });
    if (!response.ok)
        throw new Error('Server error: ${response.status}');
    const result = await response.json();
    const x = 0;
    */
});
button1.addEventListener('click', ()=>{
    /*
    //scene.add(terrain);
    pvString = new PVstring(pvModule);
    //scene.add(pvString);
    //scene.add(pvModule);
    pvPlant = new PVplant(pvString);
    scene.add(pvPlant);
    //sceneIndices['pvPlant'] = scene.children[scene.children.length-1].children[0].id;
    sceneIndices['test'] = scene.children[scene.children.length-1].children[0].id;
    */
});
button2.addEventListener('click', ()=>{
    /*
    material.needsUpdate = true;
    pvPlant.children[0].material = [material,material2[1],material2[2]];
    */
});
button3.addEventListener('click', ()=>{
    /*
    pvPlant.children[0].material = material2;
    */
});
button4.addEventListener('click', ()=>{
    /*
    //test();
    const data = new Float32Array([0.3889,0.9000,0.1,
                                   0.3889,0.9000,0.2,
                                   0.3889,0.9000,0.3,
                                   0.3889,0.9000,0.4,
                                   0.3889,0.9000,0.5,
                                   0.3889,0.9000,0.6,
                                   0.3889,0.9000,0.7,
                                   0.3889,0.9000,0.8,
                                   0.3889,0.9000,0.9,
                                   0.3889,0.9000,1.0]);
    cell.test(data,renderer).then(result => {
        const x = result;
    });
    */
});
async function test(){
    /*
    const data = new Float32Array([0.3889,0.9000,0.1,
                                   0.3889,0.9000,0.2,
                                   0.3889,0.9000,0.3,
                                   0.3889,0.9000,0.4,
                                   0.3889,0.9000,0.5,
                                   0.3889,0.9000,0.6,
                                   0.3889,0.9000,0.7,
                                   0.3889,0.9000,0.8,
                                   0.3889,0.9000,0.9,
                                   0.3889,0.9000,1.0]);
    cell.inputData = storage(
        new THREE.StorageBufferAttribute(data,3),
        'vec3',
        cell.n
    );
    const bufferEntrada = storage(
        new THREE.StorageBufferAttribute(data, 3),
        'vec3',
        10
    );

    const arraySalida = new Float32Array(10);
    const attrSalida = new THREE.StorageBufferAttribute(arraySalida, 1);
    const bufferSalida = storage(
        attrSalida,
        'float',
        10
    );
    const computeKernel = Fn(() => {
        const posCoords = bufferEntrada.element(instanceIndex);
        //const posCoords = vec3(0.3889,0.5000,0.2);
        const valorV = texture3D(cell.LUT, posCoords).r;
        bufferSalida.element(instanceIndex).assign(valorV);
      })
    const computeNode = computeKernel().compute(10)
    await renderer.computeAsync(computeNode);
    //const computeNode = cell.sampleLUT(data).compute(10);
    //await renderer.computeAsync(computeNode);
    //await renderer.computeAsync(cell.sampleLUT(data).compute(10));
    //const test = await renderer.getArrayBufferAsync(attrSalida);
    //const test = await renderer.getArrayBufferAsync(cell.attrData);
    //const result = new Float32Array(test);
    await cell.test(data,renderer);
    var x = 0;
    */
}

///////////////////////////////////////////////////////////////////////////////
// To be checked later
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
///////////////////////////////////////////////////////////////////////////////
