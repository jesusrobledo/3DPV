import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { Fn, vec3, positionLocal, vec4, texture, uv, varying } from 'three/tsl';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

let renderer, scene, scene2, camera, camera2, controls;

// Renderer initialization
renderer = new WebGPURenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
await renderer.init();

// Three.js scene setup
scene = new THREE.Scene();
scene2 = new THREE.Scene();
scene.background = new THREE.Color(0x444444);
camera = new THREE.PerspectiveCamera(45,window.innerWidth/window.innerHeight,0.1,1000);
camera2 = new THREE.PerspectiveCamera(45,window.innerWidth/window.innerHeight,0.1,1000);
camera.position.set(5,5,1);
camera.up.set(0.0,0.0,1.0);
controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.25;

// Basic scene
const textureLoader = new THREE.TextureLoader();
const colorTexture = textureLoader.load('static/textures/Calibration.jpg');
colorTexture.colorSpace = THREE.SRGBColorSpace;

let geometry = new THREE.PlaneGeometry(1,1);
let geometry2 = new THREE.PlaneGeometry(1,1);
let material = new THREE.MeshBasicMaterial({color:0xffffff, side:THREE.DoubleSide});
let material2 = new THREE.MeshBasicNodeMaterial();
material2.map = colorTexture;

material2.positionNode = Fn(() => {
    return vec3(positionLocal.x,positionLocal.y,positionLocal.z.add(positionLocal.x));
})();
const factor = positionLocal.z.add(positionLocal.z);
const vFactor = varying(factor);
const r = 0.5;
const g = 1.0;
material2.colorNode = Fn(() => {
    const filter = vec4(r,g,0.0,1.0);
    const pixel = texture(material2.map,uv());
    return pixel.mul(filter);
})();

let mesh = new THREE.Mesh(geometry, material);
let mesh2 = new THREE.Mesh(geometry2, material2);
scene.add(new THREE.AxesHelper(2));
scene.add(mesh);
scene2.add(mesh2);

const renderTarget = new THREE.RenderTarget(16,16, {
  type: THREE.FloatType,
  format: THREE.RGBA,
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter
});
//renderer.setRenderTarget(renderTarget);
renderer.render(scene2,camera2);
//renderer.setRenderTarget(null);
material.map = renderTarget;

// Main render loop

function animate() {
    controls.update();
    renderer.render(scene,camera);
}
renderer.setAnimationLoop(animate);

