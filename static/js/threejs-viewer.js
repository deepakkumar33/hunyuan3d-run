// static/js/threejs-viewer.js
import * as THREE from 'https://unpkg.com/three@0.150.1/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.150.1/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.150.1/examples/jsm/loaders/GLTFLoader.js';

let scene, camera, renderer, mesh, controls;

function initThreeJSViewer() {
  const container = document.getElementById('model-viewer');
  if (!container) throw new Error('Model viewer container not found');
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
  controls.dampingFactor = 0.25;
  controls.target.set(0, 0, 0);

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
  if (!container || !camera || !renderer) return;
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate() {
  requestAnimationFrame(animate);
  if (mesh) mesh.rotation.y += 0.005;
  if (controls) controls.update();
  if (renderer && scene && camera) renderer.render(scene, camera);
}

function loadModel(modelUrl) {
  const container = document.getElementById('model-viewer');
  if (!scene || !renderer) {
    initThreeJSViewer();
  } else {
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
  }

  const loading = document.createElement('div');
  loading.className = 'viewer-empty-state';
  loading.innerHTML = `<i class="fas fa-spinner fa-spin"></i><p>Loading 3D model...</p>`;
  container.appendChild(loading);

  if (mesh) {
    scene.remove(mesh);
    mesh = null;
  }

  const loader = new GLTFLoader();
  loader.load(
    modelUrl,
    gltf => {
      container.removeChild(loading);
      mesh = gltf.scene;
      mesh.traverse(child => {
        if (child.isMesh) {
          child.material = new THREE.MeshPhongMaterial({
            color: 0x6a4cff,
            specular: 0x555555,
            shininess: 50,
            side: THREE.DoubleSide
          });
          const wf = new THREE.LineSegments(
            new THREE.WireframeGeometry(child.geometry),
            new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 })
          );
          child.add(wf);
        }
      });
      scene.add(mesh);

      const box = new THREE.Box3().setFromObject(mesh);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      mesh.position.sub(center);
      const scale = 1.5 / maxDim;
      mesh.scale.set(scale, scale, scale);

      camera.position.set(0, 0, 2);
      controls.target.set(0, 0, 0);
      controls.update();
    },
    xhr => console.log(`Model ${(xhr.loaded / xhr.total * 100).toFixed(2)}% loaded`),
    err => {
      console.error('Error loading model:', err);
      container.removeChild(loading);
      const errDiv = document.createElement('div');
      errDiv.className = 'viewer-empty-state';
      errDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i><p>Failed to load model</p>`;
      container.appendChild(errDiv);
    }
  );
}

export { loadModel };
