import * as THREE from 'three';
import {WebGPURenderer} from 'three/webgpu';
import { storage, instanceIndex, uv, vec4, int, float,  Fn, invocationLocalIndex, vec3, positionLocal } from 'three/tsl';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, controls;

const count = 1000;
const texWidth = 64;
const texHeight = 64;
const totalPixelsPerTexture = texWidth * texHeight;
const uniqueTexturesCount = 1000;

const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardNodeMaterial();
const mesh = new THREE.InstancedMesh(geometry, material, count);
const dummy = new THREE.Object3D();
const nX = 31;
const nY = 31;
const dX = 1.5;
const dY = 1.5;

// 1. Buffer Gigante para los píxeles de TODAS las texturas (RGBA = 4 componentes por píxel)
// Tamaño aproximado para 4000 texturas de 64x64: ~65 MB (Muy seguro dentro de los límites de WebGPU)
const texturePixelsData = new Float32Array(uniqueTexturesCount * totalPixelsPerTexture * 4);
const textureBufferAttribute = new THREE.StorageBufferAttribute(texturePixelsData, 4);

// 2. Buffer para guardar la posición de cada objeto en el mundo (vec3)
let positions = [];
for (let j=0; j<nY; j++){
    for (let i=0; i<nX; i++) {
        dummy.position.set(-0.5*(nX-1)*dX + dX*i,
                           -0.5*(nY-1)*dY + dY*j,
                            0);
        positions.push(0.5*(nX-1)*dX + dX*i,
                       -0.5*(nY-1)*dY + dY*j,
                       0);
        dummy.updateMatrix();
        mesh.setMatrixAt(j*nX+i, dummy.matrix);
    }
}
const positionsData = new Float32Array(positions);
const positionBuffer = new THREE.StorageBufferAttribute(positionsData, 3);

// 3. Buffer para asignar el ID de textura (0 a 3999) a cada objeto
const textureIndicesData = new Int32Array(count);
for (let i = 0; i < count; i++) {
    textureIndicesData[i] = Math.floor(Math.random() * uniqueTexturesCount);
}
const instanceTexIndexBuffer = new THREE.StorageBufferAttribute(textureIndicesData, 1);

// Enlazamos el buffer de píxeles como un nodo de almacenamiento
const textureStorageNode = storage(textureBufferAttribute, 'vec4', uniqueTexturesCount * totalPixelsPerTexture);

const computeTexturesPass = Fn(() => {
    // invocationLocalIndex va desde 0 hasta el total de píxeles de todas las texturas combinadas
    const globalPixelIndex = invocationLocalIndex;

    // Matemática para saber en qué textura, X e Y estamos parados dentro del buffer plano
    const textureId = globalPixelIndex.div(totalPixelsPerTexture);
    const pixelIndexWithinTexture = globalPixelIndex.mod(totalPixelsPerTexture);
    const pixelX = pixelIndexWithinTexture.mod(texWidth);
    const pixelY = pixelIndexWithinTexture.div(texWidth);

    // --- Tu lógica matemática para generar colores procedurales ---
    // Ejemplo: Un degradado basado en las coordenadas del píxel y el ID de la textura
    const r = pixelX.div(texWidth);
    const g = pixelY.div(texHeight);
    const b = textureId.div(uniqueTexturesCount); // Cambia según la textura
    //const finalColor = vec4(r, g, b, 1.0);
    const finalColor = vec4(0.0, 0.0, 1.0, 1.0);

    // Guardamos el color en la posición global correspondiente de la memoria de la GPU
    textureStorageNode.element(globalPixelIndex).assign(finalColor);
});



// El tamaño del cómputo es el total absoluto de píxeles a procesar
const computeNode = computeTexturesPass().compute(uniqueTexturesCount * totalPixelsPerTexture);




// Mapeamos los buffers de datos de instancia
const positionStorage = storage(positionBuffer, 'vec3', count);
const instanceTexIndexStorage = storage(instanceTexIndexBuffer, 'int', count);



// --- SHADER DE VÉRTICES (Posicionamiento por Instancia) ---
material.positionNode = Fn(() => {
    const instancePos = positionStorage.element(instanceIndex);
    return positionLocal.add(instancePos);
})();

// --- SHADER DE FRAGMENTOS (Lectura manual del Buffer de Texturas) ---
material.colorNode = Fn(() => {
    // 1. Averiguar qué ID de textura usa esta instancia actual
    const myTextureId = instanceTexIndexStorage.element(instanceIndex);

    // 2. Convertir las UVs normalizadas (0.0 a 1.0) a píxeles enteros discretos (0 a 63)
    const xPixel = int(uv().x.mul(float(texWidth)));
    const yPixel = int(uv().y.mul(float(texHeight)));

    // Clampear/Asegurar que los píxeles no se salgan del rango de la textura por precisión numérica
    const clampedX = xPixel.clamp(0, texWidth - 1);
    const clampedY = yPixel.clamp(0, texHeight - 1);

    // 3. Reconstruir el índice plano exacto de este píxel específico en el buffer global
    // Fórmula: (ID_Textura * Total_Píxeles_Por_Textura) + X + (Y * Ancho)
    const pixelOffsetInTexture = clampedX.add(clampedY.mul(texWidth));
    const globalPixelAddress = myTextureId.mul(totalPixelsPerTexture).add(pixelOffsetInTexture);

    // 4. Leer el vec4 de color directamente del StorageBuffer
    const texelColor = textureStorageNode.element(globalPixelAddress);

    return texelColor;
    //return vec4(1.0,0.0,0.0,1.0);
})();

scene = new THREE.Scene();
scene.background = new THREE.Color(0xc0e6f5);
camera = new THREE.PerspectiveCamera(45,window.innerWidth/window.innerHeight,1,1000);
camera.position.set(50,50,5);
camera.up.set(0.0,0.0,1.0);

renderer = new WebGPURenderer({antialias:true});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth,window.innerHeight);
document.body.appendChild( renderer.domElement );
await renderer.init();

//const arrayBuffer = await renderer.getArrayBufferAsync(textureBufferAttribute);
//const datosDescargados = new Float32Array(arrayBuffer);

controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.25;


scene.add(mesh);

const directionalLight = new THREE.DirectionalLight (0xffffff,3.0);
directionalLight.position.set (50.0,-50.0,10.0);
/*
directionalLight.castShadow = true;
//directionalLight.shadow.camera.position.set(0.0,0.0,2500);
directionalLight.shadow.camera.near = 5;
directionalLight.shadow.camera.far = 100;
directionalLight.shadow.camera.left = -50;
directionalLight.shadow.camera.right = 50;
directionalLight.shadow.camera.top = 50;
directionalLight.shadow.camera.bottom = -50;
directionalLight.shadow.mapSize.set(4096,4096);
//directionalLight.shadow.camera.updateProjectionMatrix();
*/
scene.add(directionalLight);

// En tu bucle de animación:

function animate() {
    // Si tus texturas cambian en tiempo real, ejecuta el compute cada frame:

    renderer.compute(computeNode);
    renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);
