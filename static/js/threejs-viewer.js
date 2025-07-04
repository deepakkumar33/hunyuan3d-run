// static/js/threejs-viewer.js

import * as THREE from 'https://unpkg.com/three@0.150.1/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.150.1/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader }  from 'https://unpkg.com/three@0.150.1/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader }   from 'https://unpkg.com/three@0.150.1/examples/jsm/loaders/OBJLoader.js';

let scene, camera, renderer, controls, currentMesh;
let ambientLight, directionalLight1, directionalLight2;

function initThreeJSViewer() {
  const container = document.getElementById('model-viewer');
  if (!container) {
    console.error('🛑 initThreeJSViewer: No #model-viewer container');
    return;
  }
  // clear any placeholder
  container.innerHTML = '';

  // 1) Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf8f9fa);

  // 2) Camera
  camera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.set(3, 3, 3);

  // 3) Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  // 4) Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, 0, 0);

  // 5) Lights
  ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight1.position.set(5, 5, 5);
  directionalLight1.castShadow = true;
  scene.add(directionalLight1);

  directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
  directionalLight2.position.set(-5, -5, -5);
  scene.add(directionalLight2);

  // 6) Handle resize
  window.addEventListener('resize', () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  // 7) Start render loop
  (function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  })();

  console.log('✅ ThreeJS viewer initialized');
}

function loadModel(url) {
  const container = document.getElementById('model-viewer');
  if (!scene || !renderer || !camera) {
    console.warn('⚠️ loadModel(): scene not initialized—calling initThreeJSViewer()');
    initThreeJSViewer();
  }

  // show loading overlay
  const loaderDiv = document.createElement('div');
  loaderDiv.className = 'viewer-empty-state';
  loaderDiv.innerHTML = `<i class="fas fa-spinner fa-spin"></i><p>Loading 3D model…</p>`;
  container.appendChild(loaderDiv);

  // remove previous mesh
  if (currentMesh) {
    scene.remove(currentMesh);
    currentMesh = null;
  }

  // choose loader by extension
  const ext = url.split('.').pop().toLowerCase();
  const onLoad = object => {
    container.removeChild(loaderDiv);
    currentMesh = object;
    scene.add(currentMesh);

    // center & scale
    const box = new THREE.Box3().setFromObject(currentMesh);
    const center = box.getCenter(new THREE.Vector3());
    const size   = box.getSize(new THREE.Vector3());
    currentMesh.position.sub(center);
    const maxDim = Math.max(size.x, size.y, size.z);
    currentMesh.scale.setScalar(1.5 / maxDim);

    controls.target.set(0, 0, 0);
    camera.position.set(0, 0, 2);
    controls.update();

    console.log('✅ Model loaded:', url);
  };
  const onProgress = xhr => {
    if (xhr.total) {
      console.log(`📦 ${(xhr.loaded / xhr.total * 100).toFixed(1)}%`);
    }
  };
  const onError = err => {
    console.error('❌ Model load error:', err);
    container.removeChild(loaderDiv);
    container.innerHTML = `
      <div class="viewer-empty-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Failed to load model.</p>
      </div>`;
  };

  if (ext === 'obj') {
    new OBJLoader().load(url, onLoad, onProgress, onError);
  } else {
    // default to GLTF/GLB
    new GLTFLoader().load(url, gltf => onLoad(gltf.scene), onProgress, onError);
  }
}

// named exports
export { initThreeJSViewer, loadModel };
