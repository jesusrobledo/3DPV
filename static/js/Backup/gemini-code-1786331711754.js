import * as THREE from 'three';
import WebGPURenderer from 'three/addons/renderers/webgpu/WebGPURenderer.js';
import { SpriteNodeMaterial } from 'three/webgpu';
import {
  Fn,
  storage,
  instanceIndex,
  float,
  vec3,
  time,
  sin,
  cos
} from 'three/tsl';

// ------------------------------------------------------------------
// 1. Setup WebGPU Renderer & Scene
// ------------------------------------------------------------------
const renderer = new WebGPURenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 10;

const PARTICLE_COUNT = 100000;

// ------------------------------------------------------------------
// 2. Create Storage Buffers for Particle Positions & Velocities
// ------------------------------------------------------------------
const positionData = new Float32Array(PARTICLE_COUNT * 3);
const velocityData = new Float32Array(PARTICLE_COUNT * 3);

for (let i = 0; i < PARTICLE_COUNT; i++) {
  // Random starting positions within a sphere
  positionData[i * 3 + 0] = (Math.random() - 0.5) * 5;
  positionData[i * 3 + 1] = (Math.random() - 0.5) * 5;
  positionData[i * 3 + 2] = (Math.random() - 0.5) * 5;

  // Initial velocities
  velocityData[i * 3 + 0] = (Math.random() - 0.5) * 0.02;
  velocityData[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
  velocityData[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
}

// Create Three.js Storage Attributes
const positionAttr = new THREE.StorageInstancedBufferAttribute(positionData, 3);
const velocityAttr = new THREE.StorageInstancedBufferAttribute(velocityData, 3);

// Wrap attributes in TSL storage nodes
const positionBuffer = storage(positionAttr, 'vec3', PARTICLE_COUNT);
const velocityBuffer = storage(velocityAttr, 'vec3', PARTICLE_COUNT);

// ------------------------------------------------------------------
// 3. Define the TSL Compute Shader Routine
// ------------------------------------------------------------------
const computeParticles = Fn(() => {
  // Access the position and velocity vector for the CURRENT GPU thread
  const position = positionBuffer.element(instanceIndex);
  const velocity = velocityBuffer.element(instanceIndex);

  // Apply a dynamic swirl force using TSL math nodes
  const swirlForce = vec3(
    sin(position.y.add(time)).mul(0.001),
    cos(position.x.add(time)).mul(0.001),
    0.0
  );

  // Mutate velocity and position directly in GPU memory
  velocity.addAssign(swirlForce);
  position.addAssign(velocity);

  // Boundary check: If a particle travels too far, pull it back
  const dist = position.length();
  position.mulAssign(dist.greaterThan(8.0).select(0.95, 1.0));
});

// Convert the TSL function into a ComputeNode dispatched over PARTICLE_COUNT items
const computeNode = computeParticles().compute(PARTICLE_COUNT);

// ------------------------------------------------------------------
// 4. Render the Computed Particles (Direct Buffer Access)
// ------------------------------------------------------------------
const material = new SpriteNodeMaterial();

// Direct Assignment: Material reads vertex positions directly from the Compute Buffer!
material.positionNode = positionBuffer.element(instanceIndex);

// Color particles based on their position
material.colorNode = positionBuffer.element(instanceIndex).abs().normalize();

// Create Instanced Mesh for rendering 100k sprites
const geometry = new THREE.PlaneGeometry(0.05, 0.05);
const mesh = new THREE.InstancedMesh(geometry, material, PARTICLE_COUNT);
scene.add(mesh);

// ------------------------------------------------------------------
// 5. Animation Loop with Compute Pass
// ------------------------------------------------------------------
function animate() {
  requestAnimationFrame(animate);

  // Step 1: Execute Compute Shader on GPU
  renderer.compute(computeNode);

  // Step 2: Render Scene
  renderer.render(scene, camera);
}

animate();