import * as THREE from 'three';
import {WebGPURenderer, MeshStandardNodeMaterial} from 'three/webgpu';
import {Fn, textureStore, instanceIndex, uvec2, vec4, time, float, sin, cos} from 'three/tsl';

let scene, camera, renderer;

const size = 8;

scene = new THREE.Scene();
camera = new THREE.PerspectiveCamera(60,window.innerWidth/window.innerHeight,0.1,100);
camera.position.set(0,0,6);

renderer = new WebGPURenderer({antialias:true});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth,window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild( renderer.domElement );

await renderer.init();

const storageTexture = new THREE.StorageTexture(size, size);
storageTexture.minFilter = THREE.NearestFilter;
storageTexture.magFilter = THREE.NearestFilter;

const computeFn = Fn(() => {
    const posX = instanceIndex.mod(size);
    const posY = instanceIndex.div(size);
    const coord2D = uvec2(posX,posY);
    const r = float(posX).div(size-1).mul(sin(time));
    const g = float(posY).div(size-1).mul(cos(time));
    const b = 0.0;
    textureStore(storageTexture, coord2D, vec4(r,g,b,1.0)).toWriteOnly();
});

const totalTexels = size*size;
const computeNode = computeFn().compute(totalTexels);

const material = new THREE.MeshBasicMaterial({
    map:storageTexture
});



const geometry = new THREE.BoxGeometry(2,2,2);
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

function animate() {
    mesh.rotation.x += 0.01;
    mesh.rotation.y += 0.01;
    renderer.compute(computeNode);
    renderer.render(scene,camera);
}
renderer.setAnimationLoop(animate);



/*
const dummy = new THREE.Object3D();
const instanceData = [];

async function init(){

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45,window.innerWidth/window.innerHeight,0.1,100);
    camera.position.set(0,0,60);

    renderer = new WebGPURenderer({antialias:false});
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth,window.innerHeight);
    renderer.setAnimationLoop(animate);
    document.body.appendChild( renderer.domElement );

    await renderer.init();

    const initialPositions = new Float32Array(count*3);
    const rotationSpeeds = new Float32Array(count*3);

    for (let i=0;i<count;i++){
        initialPositions[i*3 + 0] = (Math.random() - 0.5) * 50;
        initialPositions[i*3 + 1]  = (Math.random() - 0.5) * 50;
        initialPositions[i*3 + 2]  = (Math.random() - 0.5) * 50;

        rotationSpeeds[i*3 + 0] = (Math.random() - 0.5) * 2;
        rotationSpeeds[i*3 + 1] = (Math.random() - 0.5) * 2;
        rotationSpeeds[i*3 + 2] = (Math.random() - 0.5) * 2;
    }

    const positionBuffer = storage(new THREE.StorageInstancedBufferAttribute(initialPositions,3),'vec3',count);
    const rotationSpeedBuffer = storage(new THREE.StorageInstancedBufferAttribute(rotationSpeeds,3),'vec3',count);

    computeNode = Fn(() => {
        const idx = instanceIndex;
        const pos = positionBuffer.element(idx);
        const rotSpeed = rotationSpeedBuffer.element(idx);

        pos.y.addAssign(0.01);
        /*
        if (pos.y.greaterThan(20.0)){
            pos.y.assign(-20);
        }

    })().compute(count);

    const vertexShaderNode = Fn(() =>{
        const idx = instanceIndex;
        const posOffset = positionBuffer.element(idx);
        const rotSpeed = rotationSpeedBuffer.element(idx);
        const angleX = time.mul(rotSpeed.x);
        const angleY = time.mul(rotSpeed.y);
        let localVtx = positionLocal;

        const cosY = cos(angleY);
        const sinY = sin(angleY);
        const x1 = localVtx.x.mul(cosY).sub(localVtx.z.mul(sinY));
        const z1 = localVtx.x.mul(sinY).sub(localVtx.z.mul(cosY));
        localVtx = vec3(x1,localVtx.y,z1);

        const cosX = cos(angleX);
        const sinX = sin(angleX);
        const y2 = localVtx.y.mul(cosX).sub(localVtx.z.mul(sinX));
        const z2 = localVtx.y.mul(sinX).sub(localVtx.z.mul(cosX));
        localVtx = vec3(y2,localVtx.x,z2);

        return localVtx.add(posOffset);
    });

    const dynamicTextureShader = Fn(() => {
        const currentUv = uv();

        const idSeed = instanceIndex.toFloat().mul(0.5);
        const individualTime = time.add(idSeed);
        const pulse = sin(individualTime.mul(1.5));

        const r = currentUv.x.mul(pulse);
        const g = currentUv.y.mul(pulse.oneMinus());
        const b = sin(individualTime.add(currentUv.x));
        return vec3(r,g,b);
    });


    const material = new THREE.MeshStandardNodeMaterial();
    material.colorNode = dynamicTextureShader();
    material.positionNode = vertexShaderNode();
    material.roughness = 0.2;
    material.metalness = 0.1;

    const geometry = new THREE.BoxGeometry(0.25,0.25,0.25);
    instancedMesh = new THREE.InstancedMesh(geometry, material, count);

    scene.add(instancedMesh);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(1,2,3);
    scene.add(directionalLight);

    const ambientLight = new THREE.AmbientLight(0x222222);
    scene.add(ambientLight);

    function animate (){
        if (computeNode)
            renderer.compute(computeNode);
        renderer.render(scene,camera);
    }
}
init().catch(err => console.error("WebGPU Initialization failed:", err));
*/