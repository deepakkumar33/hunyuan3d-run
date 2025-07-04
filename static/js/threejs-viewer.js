// static/js/threejs-viewer.js

import * as THREE        from 'https://unpkg.com/three@0.150.1/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.150.1/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader }    from 'https://unpkg.com/three@0.150.1/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader }     from 'https://unpkg.com/three@0.150.1/examples/jsm/loaders/OBJLoader.js';

let scene, camera, renderer, controls, currentMesh;
let ambientLight, dirLight1, dirLight2;

function initViewer() {
  const container = document.getElementById('model-viewer');
  if (!container) throw new Error('No #model-viewer element');

  // Clear out any placeholder
  container.innerHTML = '';

  // Scene & camera
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf8f9fa);
  camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.set(0, 0, 3);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  // Lights
  ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight1.position.set(5, 5, 5);
  dirLight1.castShadow = true;
  scene.add(dirLight1);

  dirLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
  dirLight2.position.set(-5, -5, -5);
  scene.add(dirLight2);

  window.addEventListener('resize', onWindowResize);
  animate();
}

function onWindowResize() {
  const container = document.getElementById('model-viewer');
  if (!container || !camera || !renderer) return;
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

/**
 * Load a mesh URL (.glb/.gltf or .obj)
 */
async function loadModel(url) {
  if (!scene) initViewer();

  const container = document.getElementById('model-viewer');
  // remove any old canvas
  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  // loading indicator
  const loading = document.createElement('div');
  loading.className = 'viewer-empty-state';
  loading.innerHTML = `<i class="fas fa-spinner fa-spin"></i><p>Loading 3D model…</p>`;
  container.appendChild(loading);

  // remove previous mesh
  if (currentMesh) {
    scene.remove(currentMesh);
    currentMesh = null;
  }

  const ext = url.split('.').pop().toLowerCase();
  let loader;

  try {
    if (ext === 'obj') {
      loader = new OBJLoader();
      loader.load(
        url,
        obj => onLoad(obj, loading),
        xhr => console.log(`OBJ ${(xhr.loaded/xhr.total*100).toFixed(1)}%`),
        err => onError(err, loading)
      );
    } else {
      loader = new GLTFLoader();
      loader.load(
        url,
        gltf => onLoad(gltf.scene, loading),
        xhr => console.log(`GLTF ${(xhr.loaded/xhr.total*100).toFixed(1)}%`),
        err => onError(err, loading)
      );
    }
  } catch (e) {
    onError(e, loading);
  }
}

function onLoad(model, loadingDiv) {
  loadingDiv.remove();
  currentMesh = model;
  model.traverse(child => {
    if (child.isMesh) {
      child.castShadow = child.receiveShadow = true;
      child.material = new THREE.MeshPhongMaterial({
        color: 0x6a4cff,
        specular: 0x555555,
        shininess: 50,
        side: THREE.DoubleSide
      });
      const wf = new THREE.LineSegments(
        new THREE.WireframeGeometry(child.geometry),
        new THREE.LineBasicMaterial({ color: 0x000000, opacity: 0.1, transparent: true })
      );
      child.add(wf);
    }
  });
  scene.add(model);

  // center & scale
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  model.position.sub(center);
  const maxDim = Math.max(size.x, size.y, size.z);
  model.scale.setScalar(1.5 / maxDim);

  controls.target.set(0, 0, 0);
  camera.position.set(0, 0, 3);
  controls.update();
}

function onError(error, loadingDiv) {
  console.error('Model load error', error);
  loadingDiv.remove();
  const container = document.getElementById('model-viewer');
  const msg = document.createElement('div');
  msg.className = 'viewer-empty-state';
  msg.innerHTML = `<i class="fas fa-exclamation-triangle"></i><p>Failed to load model. See console.</p>`;
  container.appendChild(msg);
}

export { loadModel };
