import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {Terrain, Sun, PVmodule, PVstring, PVplant } from 'classes';


// Renderer initialization
let renderer = new WebGPURenderer({ antialias: true });
const width = 1300;
const height = 900;
renderer.setSize(width,height);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
await renderer.init();

// Three.js scene setup
let scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
let camera = new THREE.PerspectiveCamera(45,width/height,1,40000);
camera.position.set(5000.0,5000.0,2000.0);
camera.up.set(0.0,0.0,1.0);
let controls = new OrbitControls(camera, renderer.domElement);
let sceneIndices = {};

// Basic scene
scene.add(new THREE.AxesHelper(2000));
sceneIndices['localAxis'] = scene.children[scene.children.length-1].id;
let sun = new Sun();
/*
const shadowHelper = new THREE.CameraHelper(sun.light.shadow.camera);
const shadowHelper2 = new THREE.DirectionalLightHelper(sun.light,500);
scene.add(shadowHelper);
scene.add(shadowHelper2);
*/
scene.add(sun.light);
let terrain = new Terrain();
terrain.loadMesh('/static/Terrain_5km_UV.obj');
let pvModule = new PVmodule();
pvModule.loadMesh('/static/PV_modules/1/Test.obj');
//pvModule.loadMesh('/static/PV_modules/2/Standard_Mono144.obj');
let pvString;
let pvPlant;

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
        scene.getObjectById(sceneIndices.pvPlant).position.z += 1;
    }
    if (keysPressed['KeyX']) {
        scene.getObjectById(sceneIndices.pvPlant).position.z -= 1;
    }
}
function identifyPointerPosition(event){
    const mouse = new THREE.Vector3();
    const raycaster = new THREE.Raycaster();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects([terrain.children[0],pvPlant.children[0]]);
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
const button1 = document.getElementById('button1');
const button2 = document.getElementById('button2');
button1.addEventListener('click', ()=>{
    scene.add(terrain);
    pvString = new PVstring(pvModule);
    //scene.add(pvString);
    //scene.add(pvModule);
    pvPlant = new PVplant(pvString);
    scene.add(pvPlant);
    sceneIndices['pvPlant'] = scene.children[scene.children.length-1].children[0].id;
});
button2.addEventListener('click', ()=>{
    terrain.generateHeightMap(renderer);
});
