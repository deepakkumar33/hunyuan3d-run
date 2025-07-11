// static/js/threejs-viewer.js
// Uses global THREE (loaded from CDN)
// No exports - this is a regular script, not a module

let scene, camera, renderer, controls, currentMesh;

// Make functions available globally so main.js can access them
window.ThreeJSViewer = {
  initThreeJSViewer: initThreeJSViewer,
  loadModel: loadModel
};

async function initThreeJSViewer() {
  const container = document.getElementById('model-viewer');
  if (!container) throw new Error('No #model-viewer element');
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

  // Check if OrbitControls is available with multiple possible locations
  if (typeof THREE.OrbitControls !== 'undefined') {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    console.log('OrbitControls initialized via THREE.OrbitControls');
  } else if (typeof OrbitControls !== 'undefined') {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    console.log('OrbitControls initialized via global OrbitControls');
  } else {
    console.warn('OrbitControls not available - camera controls disabled');
    // Basic fallback - allow manual camera positioning
    controls = null;
  }

  // Lighting setup
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
  if (controls) controls.update();
  renderer.render(scene, camera);
}

async function loadModel(modelUrl) {
  console.log('Loading model from:', modelUrl);

  if (!scene) {
    await initThreeJSViewer();
  }

  const container = document.getElementById('model-viewer');
  const loaderDiv = document.createElement('div');
  loaderDiv.className = 'viewer-loading';
  loaderDiv.innerHTML = `<i class="fas fa-spinner fa-spin"></i><p>Loading 3D model…</p>`;
  container.appendChild(loaderDiv);

  if (currentMesh) {
    scene.remove(currentMesh);
    currentMesh = null;
  }

  const ext = modelUrl.split('.').pop().toLowerCase();
  let loader = null;
  
  try {
    if (ext === 'obj') {
      // Check if OBJLoader is available with multiple possible locations
      if (typeof THREE.OBJLoader !== 'undefined') {
        loader = new THREE.OBJLoader();
        console.log('Using THREE.OBJLoader');
      } else if (typeof OBJLoader !== 'undefined') {
        loader = new OBJLoader();
        console.log('Using global OBJLoader');
      } else {
        throw new Error('OBJLoader not available. Please check if the OBJLoader script is loaded correctly.');
      }
    } else if (ext === 'gltf' || ext === 'glb') {
      // Check if GLTFLoader is available with multiple possible locations
      if (typeof THREE.GLTFLoader !== 'undefined') {
        loader = new THREE.GLTFLoader();
        console.log('Using THREE.GLTFLoader');
      } else if (typeof GLTFLoader !== 'undefined') {
        loader = new GLTFLoader();
        console.log('Using global GLTFLoader');
      } else {
        throw new Error('GLTFLoader not available. Please check if the GLTFLoader script is loaded correctly.');
      }
    } else {
      throw new Error(`Unsupported file format: ${ext}`);
    }

    // Load the model
    await new Promise((resolve, reject) => {
      loader.load(
        modelUrl,
        (asset) => {
          try {
            container.removeChild(loaderDiv);
            
            // Handle different loader return types
            if (ext === 'gltf' || ext === 'glb') {
              currentMesh = asset.scene;
            } else {
              currentMesh = asset;
            }

            let hasValidGeometry = false;
            
            currentMesh.traverse(child => {
              if (child.isMesh && child.geometry && child.geometry.attributes.position) {
                const pos = child.geometry.attributes.position.array;
                if (!pos || pos.length === 0 || pos.some(val => isNaN(val))) {
                  console.warn('Invalid geometry data found');
                  return;
                }
                hasValidGeometry = true;

                // Apply material
                child.material = new THREE.MeshPhongMaterial({
                  color: 0xc0c0c0,
                  specular: 0x555555,
                  shininess: 50,
                  side: THREE.DoubleSide
                });

                // Add wireframe
                const wireframe = new THREE.LineSegments(
                  new THREE.WireframeGeometry(child.geometry),
                  new THREE.LineBasicMaterial({ 
                    color: 0x000000, 
                    transparent: true, 
                    opacity: 0.25 
                  })
                );
                child.add(wireframe);
              }
            });

            if (!hasValidGeometry) {
              throw new Error('Model contains no valid geometry');
            }

            scene.add(currentMesh);
            
            // Center and scale the model
            const box = new THREE.Box3().setFromObject(currentMesh);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            currentMesh.position.sub(center);
            
            const maxDim = Math.max(size.x, size.y, size.z);
            if (maxDim === 0 || isNaN(maxDim)) {
              throw new Error('Invalid model dimensions');
            }
            
            currentMesh.scale.setScalar(1.5 / maxDim);
            
            if (controls) controls.update();
            
            resolve();
          } catch (error) {
            reject(error);
          }
        },
        (xhr) => {
          if (xhr.total) {
            const progress = (xhr.loaded / xhr.total * 100).toFixed(2);
            console.log(`Model loading progress: ${progress}%`);
          }
        },
        (error) => {
          reject(error);
        }
      );
    });

  } catch (error) {
    console.error('Model load error:', error);
    
    if (loaderDiv.parentNode) {
      container.removeChild(loaderDiv);
    }
    
    container.innerHTML = `
      <div class="viewer-error">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Failed to load 3D model</p>
        <p class="viewer-info">${error.message}</p>
      </div>
    `;
  }
}
