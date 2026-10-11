///////////////////////////////////////////////////////////////////////////////
// Libraries and classes imported
import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {Terrain, Sun, GPUengine, PVmodule, PVlayout, PVarray} from 'classes';
import { Fn, attribute, vec4, instanceIndex } from 'three/tsl';


// Renderer initialization ////////////////////////////////////////////////////
// TODO - Responsive window
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
// TODO - Adapt scene filed of view and shadow field of view
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

// Default graph definition ///////////////////////////////////////////////////
const graph_layout = {margin:{l:40,r:20,b:30,t:60,pad:0},
                      paper_bgcolor: 'rgba(0,0,0,0)',
                      plot_bgcolor: 'rgba(0,0,0,0)',
                      xaxis:{gridcolor:"#888888",
                             color:'#000000'},
                      yaxis:{gridcolor:"#888888",
                             color:'#000000'},
                      legend:{x:0.5,
                              y:0.2,
                              font:{color:'#000000'}}};

// GPU engine definition and specific 3D elements /////////////////////////////
const gpuEngine = new GPUengine();
let pvModule = null;
let pvLayout = null;
let pvArray = null;
let baselineMaterial = null;

// TODO: Probably transfer this to the GPU engine
const analysisMaterial = new THREE.MeshBasicNodeMaterial();
const colorNode = Fn(() => {
    const analysisUv = attribute('analysisUv', 'vec2');
    const x = analysisUv.x.floor().div(30);
    const index = instanceIndex.mul(24);
    const y = analysisUv.y.add(index).floor().div(72);
    return vec4(y,x,0.0,1.0);
});
analysisMaterial.colorNode = colorNode();

// Interface control //////////////////////////////////////////////////////////
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
        scene.getObjectById(sceneIndices.pvArray).position.z += 1;
    }
    if (keysPressed['KeyX']) {
        scene.getObjectById(sceneIndices.pvArray).position.z -= 1;
    }
}
function identifyPointerPosition(event){
    const mouse = new THREE.Vector3();
    const raycaster = new THREE.Raycaster();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY-58) / (window.innerHeight-75) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects([terrain.children[0],pvArray.children[0]]);
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
const button4 = document.getElementById('button4');
const menu = document.getElementById('menu');
const menu_close = document.getElementById('menu_close');
menu_close.addEventListener('click', () => {

    menu.close();
});
button0.addEventListener('click', () => {

    const module = {nCellsPerDiode:20,nChainsPerDiode:1,nDiodes:3,fileName:'static/Test_2048.zip'};
    const nModules = 2500;
    const irradiance = new Float32Array(module.nCellsPerDiode*module.nDiodes*nModules);
    const temperature = new Float32Array(module.nCellsPerDiode*module.nDiodes*nModules);
    for (let i=0;i<irradiance.length;i++){
        irradiance[i] = 1000;
        temperature[i] = 25;
    }
    irradiance[20] = 800;
    irradiance[40] = 750;
    irradiance[41] = 750;
    irradiance[60] = 600;
    irradiance[80] = 500;
    irradiance[100] = 400;

    gpuEngine.createArray({key:'baseline',
                           module:module,
                           nModules:nModules}
                           );
    gpuEngine.updateBuffer('baseline','cell','irradiance',irradiance);
    gpuEngine.updateBuffer('baseline','cell','temperature',temperature);

    pvModule = new PVmodule();
    pvModule.loadMesh({fileName:'/static/PV_modules/1/Test.obj',
                       frontTexture:'static/PV_modules/1/textures/Mono_6x24_Front.jpg',
                       rearTexture:'static/PV_modules/1/textures/Mono_6x24_Rear_Bifacial.jpg',
                       lateralTexture:'static/PV_modules/1/textures/Aluminium.jpg'});

});
button1.addEventListener('click', () => {

    baselineMaterial = pvModule.children[0].material;
    pvLayout = new PVlayout({
                             pvModule:pvModule,
                             nModules:10}
                             );
    pvArray = new PVarray({pvLayout:pvLayout,
                           nX:100,
                           nY:10,
                           dX:5,
                           dY:12});
    pvArray.position.set(0.0,0.0,250.0);
    scene.add(pvArray);
    sceneIndices['pvArray'] = scene.children[scene.children.length-1].id;
});
button2.addEventListener('click', () => {
    gpuEngine.computeShader(renderer,'cellsVoltage','baseline');
    gpuEngine.computeShader(renderer,'chainsVoltage','baseline');
    gpuEngine.computeShader(renderer,'chainsCurrent','baseline').then(result =>{
        const graph_data = [];
        //for (let iChain=0;iChain<gpuEngine.array.baseline.nChains;iChain++){
        for (let iChain=0;iChain<6;iChain++){
            const x = [];
            const y = [];
            for (let i=0;i<gpuEngine.array.baseline.IVsize;i++){
                //x.push(result[iChain*gpuEngine.array.baseline.IVsize+i]);
                //y.push(10.0/(gpuEngine.array.baseline.IVsize-1)*i);
                x.push(-1.0 + 15/(gpuEngine.array.baseline.IVsize-1)*i);
                y.push(result[iChain*gpuEngine.array.baseline.IVsize+i]);
            }
            graph_data.push({x:x,y:y,mode:'lines'});
        }
        Plotly.newPlot('graph',graph_data,graph_layout);
        menu.showModal();
    });
});
button3.addEventListener('click', () => {

    pvArray.children[0].material = [analysisMaterial,baselineMaterial[1],baselineMaterial[2]];
});
button4.addEventListener('click', () => {

    pvArray.children[0].material = baselineMaterial;
});


