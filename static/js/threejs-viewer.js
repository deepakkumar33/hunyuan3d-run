// static/js/threejs-viewer.js
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader }   from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader }    from 'three/examples/jsm/loaders/OBJLoader.js';

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

  // lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const d1 = new THREE.DirectionalLight(0xffffff, 0.8);
  d1.position.set(1,1,1).normalize();
  scene.add(d1);
  const d2 = new THREE.DirectionalLight(0xffffff, 0.4);
  d2.position.set(-1,-1,-1).normalize();
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
  renderer && scene && camera && renderer.render(scene, camera);
}

function loadModel(modelUrl) {
  // first init or re‑attach
  if (!scene || !renderer) {
    initThreeJSViewer();
  } else {
    const container = document.getElementById('model-viewer');
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
  }

  // show loading
  const ld = document.createElement('div');
  ld.className = 'viewer-empty-state';
  ld.innerHTML = `<i class="fas fa-spinner fa-spin"></i><p>Loading model…</p>`;
  document.getElementById('model-viewer').appendChild(ld);

  // clear old
  if (mesh) { scene.remove(mesh); mesh = null; }

  // pick loader by extension
  if (modelUrl.toLowerCase().endsWith('.obj')) {
    new OBJLoader().load(
      modelUrl,
      obj => { _onLoaded(obj, ld); },
      xhr => { /* progress if you like */ },
      err => _onError(err, ld, 'OBJ')
    );
  } else {
    new GLTFLoader().load(
      modelUrl,
      gltf => { _onLoaded(gltf.scene, ld); },
      xhr => { /* progress */ },
      err => _onError(err, ld, 'GLTF')
    );
  }
}

function _onLoaded(obj, loadingDiv) {
  document.getElementById('model-viewer').removeChild(loadingDiv);
  mesh = obj;
  // apply material + wireframe
  mesh.traverse(ch => {
    if (ch.isMesh) {
      ch.material = new THREE.MeshPhongMaterial({
        color: 0x6a4cff,
        specular: 0x555555,
        shininess: 50,
        side: THREE.DoubleSide
      });
      const wf = new THREE.LineSegments(
        new THREE.WireframeGeometry(ch.geometry),
        new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 })
      );
      ch.add(wf);
    }
  });
  scene.add(mesh);

  // center & scale
  const box = new THREE.Box3().setFromObject(mesh);
  const cen = box.getCenter(new THREE.Vector3());
  const sz  = box.getSize(new THREE.Vector3());
  const m   = Math.max(sz.x, sz.y, sz.z);
  mesh.position.sub(cen);
  mesh.scale.setScalar(1.5 / m);
  camera.position.set(0,0,2);
  controls.target.set(0,0,0);
  controls.update();
}

function _onError(err, loadingDiv, fmt) {
  console.error(`${fmt} load error:`, err);
  const container = document.getElementById('model-viewer');
  container.removeChild(loadingDiv);
  const errDiv = document.createElement('div');
  errDiv.className = 'viewer-empty-state';
  errDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i>
                      <p>Failed to load ${fmt} model.</p>`;
  container.appendChild(errDiv);
}

export { loadModel };
