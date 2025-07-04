// static/js/threejs-viewer.js
import * as THREE        from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader }    from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader }     from 'three/examples/jsm/loaders/OBJLoader.js';

let scene, camera, renderer, controls, currentMesh;

export async function initThreeJSViewer() {
  const container = document.getElementById('model-viewer');
  if (!container) throw new Error('No #model-viewer element');

  // Reset
  container.innerHTML = '';

  // Scene & camera
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf8f9fa);
  camera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, 2);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const d1 = new THREE.DirectionalLight(0xffffff, 0.8);
  d1.position.set(1, 1, 1).normalize();
  scene.add(d1);
  const d2 = new THREE.DirectionalLight(0xffffff, 0.4);
  d2.position.set(-1, -1, -1).normalize();
  scene.add(d2);

  window.addEventListener('resize', _onWindowResize);
  _animate();
}

function _onWindowResize() {
  const c = document.getElementById('model-viewer');
  if (!c) return;
  camera.aspect = c.clientWidth / c.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(c.clientWidth, c.clientHeight);
}

function _animate() {
  requestAnimationFrame(_animate);
  controls.update();
  renderer.render(scene, camera);
}

/**
 * Load a .glb/.gltf or .obj model from your Flask API.
 * modelUrl should be the absolute URL (including /api/output/…).
 */
export async function loadModel(modelUrl) {
  if (!scene) {
    await initThreeJSViewer();
  }

  const container = document.getElementById('model-viewer');
  // show loading
  const loaderDiv = document.createElement('div');
  loaderDiv.className = 'viewer-empty-state';
  loaderDiv.innerHTML = `<i class="fas fa-spinner fa-spin"></i><p>Loading 3D model…</p>`;
  container.appendChild(loaderDiv);

  // remove old mesh
  if (currentMesh) {
    scene.remove(currentMesh);
    currentMesh = null;
  }

  // pick loader
  const ext = modelUrl.split('.').pop().toLowerCase();
  const loader = ext === 'obj'
    ? new OBJLoader()
    : new GLTFLoader();

  loader.load(
    modelUrl,
    asset => {
      container.removeChild(loaderDiv);

      // GLTFLoader returns { scene, ... }; OBJLoader returns the Group/object directly
      currentMesh = asset.scene || asset;

      // apply material + wireframe
      currentMesh.traverse(child => {
        if (child.isMesh) {
          child.material = new THREE.MeshPhongMaterial({
            color: 0x6a4cff,
            specular: 0x555555,
            shininess: 50,
            side: THREE.DoubleSide
          });
          // optional: add a faint wireframe overlay
          const wf = new THREE.LineSegments(
            new THREE.WireframeGeometry(child.geometry),
            new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 })
          );
          child.add(wf);
        }
      });

      scene.add(currentMesh);

      // center & scale into view
      const box = new THREE.Box3().setFromObject(currentMesh);
      const center = box.getCenter(new THREE.Vector3());
      const size   = box.getSize(new THREE.Vector3());
      currentMesh.position.sub(center);
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale  = 1.5 / maxDim;
      currentMesh.scale.setScalar(scale);

      controls.update();
    },
    xhr => {
      if (xhr.total) {
        console.log(`Model ${(xhr.loaded / xhr.total * 100).toFixed(2)}% loaded`);
      }
    },
    err => {
      console.error('Model load error', err);
      container.removeChild(loaderDiv);
      container.innerHTML = `
        <div class="viewer-empty-state">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Failed to load 3D model</p>
        </div>`;
    }
  );
}
