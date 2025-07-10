// static/js/threejs-viewer.js
// Browser-compatible version without ES6 imports

let scene, camera, renderer, controls, currentMesh;

export async function initThreeJSViewer() {
  const container = document.getElementById('model-viewer');
  if (!container) throw new Error('No #model-viewer element');
  container.innerHTML = '';

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf8f9fa);
  camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.set(0, 0, 2);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  // Use THREE.OrbitControls instead of import
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

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

export async function loadModel(modelUrl) {
  console.log('Loading model from:', modelUrl);
  
  if (!scene) {
    await initThreeJSViewer();
  }

  const container = document.getElementById('model-viewer');
  const loaderDiv = document.createElement('div');
  loaderDiv.className = 'viewer-empty-state';
  loaderDiv.innerHTML = `<i class="fas fa-spinner fa-spin"></i><p>Loading 3D model…</p>`;
  container.appendChild(loaderDiv);

  if (currentMesh) {
    scene.remove(currentMesh);
    currentMesh = null;
  }

  const ext = modelUrl.split('.').pop().toLowerCase();
  console.log('Model extension:', ext);
  
  // Use THREE.OBJLoader and THREE.GLTFLoader
  const loader = ext === 'obj' ? new THREE.OBJLoader() : new THREE.GLTFLoader();

  loader.load(
    modelUrl,
    asset => {
      console.log('Model loaded successfully', asset);
      container.removeChild(loaderDiv);
      currentMesh = asset.scene || asset;

      let hasValidGeometry = false;

      currentMesh.traverse(child => {
        if (child.isMesh && child.geometry && child.geometry.attributes.position) {
          const pos = child.geometry.attributes.position.array;
          if (!pos || pos.length === 0 || pos.includes(NaN)) return;
          hasValidGeometry = true;

          child.material = new THREE.MeshPhongMaterial({
            color: 0xc0c0c0,
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

      if (!hasValidGeometry) {
        console.error('Model contains invalid or empty geometry');
        container.innerHTML = `<div class="viewer-empty-state">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Invalid or empty model geometry</p>
        </div>`;
        return;
      }

      scene.add(currentMesh);
      const box = new THREE.Box3().setFromObject(currentMesh);
      const center = box.getCenter(new THREE.Vector3());
      const size   = box.getSize(new THREE.Vector3());
      currentMesh.position.sub(center);

      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim === 0 || isNaN(maxDim)) {
        console.error('Invalid bounding box dimensions');
        return;
      }

      currentMesh.scale.setScalar(1.5 / maxDim);
      controls.update();
    },
    xhr => {
      if (xhr.total) {
        console.log(`Model ${(xhr.loaded / xhr.total * 100).toFixed(2)}% loaded`);
      }
    },
    err => {
      console.error('Model load error', err);
      if (loaderDiv.parentNode) {
        container.removeChild(loaderDiv);
      }
      container.innerHTML = `<div class="viewer-empty-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Failed to load 3D model: ${err.message || 'Unknown error'}</p>
      </div>`;
    }
  );
}
