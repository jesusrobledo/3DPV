import * as THREE from 'three';
import {WebGPURenderer, MeshStandardNodeMaterial} from 'three/webgpu';
import {Fn, uv, time, sin, vec3, vec4, instanceIndex} from 'three/tsl';

let scene, camera, renderer, instancedMesh;
const count = 1000;

const dummy = new THREE.Object3D();
const instanceData = [];

async function init(){

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(70,window.innerWidth/window.innerHeight,0.1,100);
    camera.position.set(0,0,35);

    renderer = new WebGPURenderer({antialias:false});
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth,window.innerHeight);
    renderer.setAnimationLoop(animate);
    document.body.appendChild( renderer.domElement );

    await renderer.init();

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
    material.roughness = 0.2;
    material.metalness = 0.1;

    const geometry = new THREE.BoxGeometry(1,1,1);
    instancedMesh = new THREE.InstancedMesh(geometry, material, count);

    for (let i=0;i<count;i++){
        const x = (Math.random() - 0.5) * 60;
        const y = (Math.random() - 0.5) * 60;
        const z = (Math.random() - 0.5) * 60;

        dummy.position.set(x,y,z);
        dummy.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,0);
        dummy.updateMatrix();

        instancedMesh.setMatrixAt(i,dummy.matrix);

        instanceData.push({
            speedX: (Math.random() - 0.5) * 0.02,
            speedY: (Math.random() - 0.5) * 0.02,
        })
    }

    scene.add(instancedMesh);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(1,2,3);
    scene.add(directionalLight);

    const ambientLight = new THREE.AmbientLight(0x222222);
    scene.add(ambientLight);

    function animate (){
        if (instancedMesh){
            for (let i=0;i<count;i++){
                instancedMesh.getMatrixAt(i,dummy.matrix);
                dummy.matrix.decompose(dummy.position,dummy.quaternion,dummy.scale);

                dummy.rotation.x += instanceData[i].speedX;
                dummy.rotation.y += instanceData[i].speedY;

                dummy.updateMatrix();
                instancedMesh.setMatrixAt(i,dummy.matrix);


            }
        }
        renderer.render(scene,camera);
    }
}
init().catch(err => console.error("WebGPU Initialization failed:", err));