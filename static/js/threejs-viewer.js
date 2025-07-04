// static/js/threejs-viewer.js
import * as THREE        from 'https://unpkg.com/three@0.150.1/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.150.1/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader }    from 'https://unpkg.com/three@0.150.1/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader }     from 'https://unpkg.com/three@0.150.1/examples/jsm/loaders/OBJLoader.js';


let scene, camera, renderer, controls, currentMesh;

/**
 * Set up Three.js scene, camera, lights, renderer and controls.
 * Called automatically the first time you call loadModel().
 */
function _initViewer() {
  if (scene) return; // already initialized

  const container = document.getElementById('model-viewer');
  if (!container) {
    throw new Error("unable to find <div id='model-viewer'>");
  }

  // clear out any placeholder
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
  container.appendChild(renderer.domElement);

  // 4) Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, 0, 0);

  // 5) Lights
  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambient);

  const dir1 = new THREE.DirectionalLight(0xffffff, 0.8);
  dir1.position.set(5, 5, 5);
  scene.add(dir1);

  const dir2 = new THREE.DirectionalLight(0xffffff, 0.3);
  dir2.position.set(-5, -5, -5);
  scene.add(dir2);

  // 6) Resize handler
  window.addEventListener('resize', () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  // 7) Render loop
  (function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  })();

  console.log('ThreeJS viewer initialized');
}

/**
 * Load a model (GLTF/GLB or OBJ) into the scene.
 * If not already initialized, will do so now.
 * @param {string} url  URL to .glb/.gltf/.obj file
 */
export function loadModel(url) {
  // 1) Ensure viewer is set up
  try {
    _initViewer();
  } catch (err) {
    console.error('Viewer initialization failed:', err);
    const container = document.getElementById('model-viewer');
    if (container) {
      container.innerHTML = `
        <div class="viewer-empty-state">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Failed to initialize 3D viewer</p>
          <p><small>${err.message}</small></p>
        </div>`;
    }
    return;
  }

  const container = document.getElementById('model-viewer');

  // 2) Show loading indicator
  const loaderDiv = document.createElement('div');
  loaderDiv.className = 'viewer-empty-state';
  loaderDiv.innerHTML = `<i class="fas fa-spinner fa-spin"></i><p>Loading model…</p>`;
  container.appendChild(loaderDiv);

  // 3) Remove previous mesh
  if (currentMesh) {
    scene.remove(currentMesh);
    currentMesh = null;
  }

  // 4) Choose loader by extension
  const ext = url.split('.').pop().toLowerCase();
  const onProgress = xhr => {
    if (xhr.total) {
      console.log(`Model ${ext.toUpperCase()} ${(xhr.loaded/xhr.total*100).toFixed(1)}%`);
    }
  };
  const onError = err => {
    console.error('Model load error:', err);
    container.innerHTML = `
      <div class="viewer-empty-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Failed to load model</p>
        <p><small>${err.message}</small></p>
      </div>`;
  };
  const onLoadScene = obj => {
    container.removeChild(loaderDiv);
    currentMesh = (ext === 'obj') ? obj : obj.scene || obj;
    scene.add(currentMesh);

    // center & scale
    const box = new THREE.Box3().setFromObject(currentMesh);
    const c   = box.getCenter(new THREE.Vector3());
    const s   = box.getSize(new THREE.Vector3());
    currentMesh.position.sub(c);
    const maxDim = Math.max(s.x, s.y, s.z);
    currentMesh.scale.setScalar(1.5 / maxDim);

    controls.target.set(0,0,0);
    camera.position.set(0,0,2);
    controls.update();

    console.log('Model loaded into scene:', url);
  };

  if (ext === 'obj') {
    new OBJLoader().load(url, onLoadScene, onProgress, onError);
  } else {
    new GLTFLoader().load(url, onLoadScene, onProgress, onError);
  }
}
