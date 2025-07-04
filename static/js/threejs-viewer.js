// threejs-viewer.js
import * as THREE        from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader }    from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader }     from 'three/examples/jsm/loaders/OBJLoader.js';

let scene, camera, renderer, currentMesh, controls;

export async function initThreeJSViewer() {
  const container = document.getElementById('model-viewer');
  if (!container) throw new Error('No #model-viewer element');

  // clear and set up scene/camera/renderer
  container.innerHTML = '';
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf8f9fa);

  camera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, 2);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const d1 = new THREE.DirectionalLight(0xffffff, 0.8);
  d1.position.set(1, 1, 1).normalize();
  scene.add(d1);
  const d2 = new THREE.DirectionalLight(0xffffff, 0.4);
  d2.position.set(-1, -1, -1).normalize();
  scene.add(d2);

  window.addEventListener('resize', onWindowResize);
  animate();
}

function onWindowResize() {
  const container = document.getElementById('model-viewer');
  if (!container) return;
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

export async function loadModel(modelUrl) {
  if (!scene) {
    await initThreeJSViewer();
  }

  const container = document.getElementById('model-viewer');
  // loading indicator
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'viewer-empty-state';
  loadingDiv.innerHTML = `<i class="fas fa-spinner fa-spin"></i><p>Loading 3D model…</p>`;
  container.appendChild(loadingDiv);

  // remove previous
  if (currentMesh) scene.remove(currentMesh);

  // pick loader
  const ext = modelUrl.split('.').pop().toLowerCase();
  let loader;
  if (ext === 'obj') {
    loader = new OBJLoader();
  } else {
    loader = new GLTFLoader();
  }

  loader.load(
    modelUrl,
    gltfOrObj => {
      container.removeChild(loadingDiv);
      // GLTFLoader gives .scene, OBJLoader gives the object directly
      currentMesh = gltfOrObj.scene || gltfOrObj;
      currentMesh.traverse(child => {
        if (child.isMesh) {
          child.material = new THREE.MeshPhongMaterial({
            color: 0x6a4cff,
            specular: 0x555555,
            shininess: 50,
            side: THREE.DoubleSide
          });
        }
      });
      scene.add(currentMesh);

      // center & scale
      const box = new THREE.Box3().setFromObject(currentMesh);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      currentMesh.position.sub(center);
      const m = Math.max(size.x, size.y, size.z);
      currentMesh.scale.setScalar(1.5 / m);
      controls.update();
    },
    xhr => {
      if (xhr.total) {
        console.log(`Model ${(xhr.loaded / xhr.total * 100).toFixed(2)}% loaded`);
      }
    },
    err => {
      console.error('Model load error', err);
      container.removeChild(loadingDiv);
      container.innerHTML = `
        <div class="viewer-empty-state">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Failed to load 3D model</p>
        </div>`;
    }
  );
}
