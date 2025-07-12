// static/js/threejs-viewer.js
// Uses global THREE (loaded from CDN)
// No exports - this is a regular script, not a module

let scene, camera, renderer, controls, currentMesh;
let autoRotate = false;
let wireframeEnabled = false;
let wireframeMesh = null;

// Make functions available globally so main.js can access them
window.ThreeJSViewer = {
  initThreeJSViewer: initThreeJSViewer,
  loadModel: loadModel,
  toggleWireframe: toggleWireframe,
  toggleAutoRotate: toggleAutoRotate
};

async function initThreeJSViewer() {
  const container = document.getElementById('model-viewer');
  if (!container) throw new Error('No #model-viewer element');
  
  // Clear any existing content
  container.innerHTML = '';

  // Create scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf8f9fa);

  // Create camera
  camera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.set(2, 2, 2);

  // Create renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // Initialize controls with better error handling
  if (typeof THREE !== 'undefined' && THREE.OrbitControls) {
    try {
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.enableZoom = true;
      controls.enableRotate = true;
      controls.enablePan = true;
      controls.autoRotate = false;
      controls.autoRotateSpeed = 2.0;
      console.log('OrbitControls initialized successfully');
    } catch (error) {
      console.warn('Failed to initialize OrbitControls:', error);
      controls = null;
    }
  } else {
    console.warn('OrbitControls not available - camera controls disabled');
    controls = null;
  }

  // Enhanced lighting setup
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight1.position.set(5, 5, 5);
  directionalLight1.castShadow = true;
  directionalLight1.shadow.mapSize.width = 2048;
  directionalLight1.shadow.mapSize.height = 2048;
  scene.add(directionalLight1);

  const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
  directionalLight2.position.set(-5, -5, -5);
  scene.add(directionalLight2);

  // Add grid helper
  const gridHelper = new THREE.GridHelper(10, 10, 0xcccccc, 0xcccccc);
  gridHelper.material.opacity = 0.2;
  gridHelper.material.transparent = true;
  scene.add(gridHelper);

  // Set up window resize handler
  window.addEventListener('resize', onWindowResize);
  
  // Start animation loop
  animate();

  console.log('Three.js viewer initialized successfully');
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
  
  if (controls) {
    controls.update();
  }
  
  if (currentMesh && autoRotate && !controls?.autoRotate) {
    currentMesh.rotation.y += 0.01;
  }
  
  renderer.render(scene, camera);
}

async function loadModel(modelUrl) {
  console.log('Loading model from:', modelUrl);

  if (!scene) {
    console.log('Scene not initialized, initializing now...');
    await initThreeJSViewer();
  }

  // Show loading state
  const container = document.getElementById('model-viewer');
  showLoadingState(container);

  // Remove existing model
  if (currentMesh) {
    scene.remove(currentMesh);
    currentMesh = null;
  }
  
  if (wireframeMesh) {
    scene.remove(wireframeMesh);
    wireframeMesh = null;
  }

  // Determine file type and create loader
  const extension = modelUrl.split('.').pop().toLowerCase();
  let loader = null;
  
  try {
    if (extension === 'obj') {
      // Check if OBJLoader is available
      if (typeof THREE !== 'undefined' && THREE.OBJLoader) {
        loader = new THREE.OBJLoader();
        console.log('Using OBJLoader');
      } else {
        throw new Error('OBJLoader not available - please check CDN loading');
      }
    } else if (extension === 'gltf' || extension === 'glb') {
      // Check if GLTFLoader is available
      if (typeof THREE !== 'undefined' && THREE.GLTFLoader) {
        loader = new THREE.GLTFLoader();
        console.log('Using GLTFLoader');
      } else {
        throw new Error('GLTFLoader not available - please check CDN loading');
      }
    } else {
      throw new Error(`Unsupported file format: ${extension}`);
    }

    // Load the model with better error handling
    const asset = await new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Model loading timed out'));
      }, 30000); // 30 second timeout

      loader.load(
        modelUrl,
        (result) => {
          clearTimeout(timeoutId);
          console.log('Model loaded successfully');
          resolve(result);
        },
        (progress) => {
          if (progress.total) {
            const percent = (progress.loaded / progress.total * 100).toFixed(1);
            console.log(`Loading progress: ${percent}%`);
          }
        },
        (error) => {
          clearTimeout(timeoutId);
          console.error('Model loading error:', error);
          reject(error);
        }
      );
    });

    // Process the loaded model
    let modelObject;
    if (extension === 'gltf' || extension === 'glb') {
      modelObject = asset.scene;
    } else {
      modelObject = asset;
    }

    // Validate and process geometry
    let hasValidGeometry = false;
    modelObject.traverse((child) => {
      if (child.isMesh && child.geometry) {
        hasValidGeometry = true;
        
        // Apply enhanced material
        child.material = new THREE.MeshPhongMaterial({
          color: 0xd4af37, // Gold color for jewelry
          specular: 0x111111,
          shininess: 100,
          side: THREE.DoubleSide
        });
        
        // Enable shadow casting and receiving
        child.castShadow = true;
        child.receiveShadow = true;
        
        // Ensure geometry has proper attributes
        if (!child.geometry.attributes.normal) {
          child.geometry.computeVertexNormals();
        }
      }
    });

    if (!hasValidGeometry) {
      throw new Error('No valid geometry found in model');
    }

    // Add model to scene
    scene.add(modelObject);
    currentMesh = modelObject;

    // Center and scale the model
    const box = new THREE.Box3().setFromObject(currentMesh);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    // Move model to center
    currentMesh.position.sub(center);
    
    // Scale to fit in view
    const maxDimension = Math.max(size.x, size.y, size.z);
    if (maxDimension > 0) {
      const scale = 2 / maxDimension;
      currentMesh.scale.setScalar(scale);
    }

    // Update camera position to view the model
    const distance = Math.max(size.x, size.y, size.z) * 1.5;
    camera.position.set(distance, distance, distance);
    camera.lookAt(0, 0, 0);
    
    if (controls) {
      controls.target.set(0, 0, 0);
      controls.update();
    }

    // Remove loading state
    hideLoadingState(container);
    
    // Set up viewer controls
    setupViewerControls();

    console.log('Model loaded and positioned successfully');

  } catch (error) {
    console.error('Failed to load model:', error);
    showErrorState(container, error.message);
  }
}

function showLoadingState(container) {
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'viewer-loading';
  loadingDiv.innerHTML = `
    <i class="fas fa-spinner fa-spin"></i>
    <p>Loading 3D model...</p>
  `;
  container.appendChild(loadingDiv);
}

function hideLoadingState(container) {
  const loadingDiv = container.querySelector('.viewer-loading');
  if (loadingDiv) {
    container.removeChild(loadingDiv);
  }
}

function showErrorState(container, message) {
  hideLoadingState(container);
  const errorDiv = document.createElement('div');
  errorDiv.className = 'viewer-error';
  errorDiv.innerHTML = `
    <i class="fas fa-exclamation-triangle"></i>
    <p>Failed to load 3D model</p>
    <p class="viewer-info">${message}</p>
    <button class="btn btn-primary" onclick="window.location.reload()">
      <i class="fas fa-refresh"></i> Reload Page
    </button>
  `;
  container.appendChild(errorDiv);
}

function setupViewerControls() {
  // Wireframe toggle
  const wireframeToggle = document.getElementById('wireframe-toggle');
  if (wireframeToggle) {
    wireframeToggle.addEventListener('change', (e) => {
      toggleWireframe(e.target.checked);
    });
  }

  // Auto-rotate toggle
  const autoRotateToggle = document.getElementById('auto-rotate');
  if (autoRotateToggle) {
    autoRotateToggle.addEventListener('change', (e) => {
      toggleAutoRotate(e.target.checked);
    });
  }
}

function toggleWireframe(enabled) {
  wireframeEnabled = enabled;
  
  if (!currentMesh) return;
  
  if (enabled) {
    // Create wireframe
    let geometry = null;
    currentMesh.traverse((child) => {
      if (child.isMesh && child.geometry) {
        geometry = child.geometry;
      }
    });
    
    if (geometry) {
      const wireframeGeometry = new THREE.WireframeGeometry(geometry);
      const wireframeMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
      wireframeMesh = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
      scene.add(wireframeMesh);
    }
  } else {
    // Remove wireframe
    if (wireframeMesh) {
      scene.remove(wireframeMesh);
      wireframeMesh = null;
    }
  }
}

function toggleAutoRotate(enabled) {
  autoRotate = enabled;
  
  if (controls) {
    controls.autoRotate = enabled;
  }
}

// Wait for DOM and Three.js to be ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('Three.js viewer script loaded');
  
  // Check if Three.js is available
  const checkThreeJS = () => {
    if (typeof THREE !== 'undefined') {
      console.log('Three.js is available');
      return true;
    } else {
      console.warn('Three.js is not available yet');
      return false;
    }
  };
  
  // Wait for Three.js to be ready
  let attempts = 0;
  const maxAttempts = 50;
  const checkInterval = setInterval(() => {
    attempts++;
    if (checkThreeJS() || attempts >= maxAttempts) {
      clearInterval(checkInterval);
      if (attempts >= maxAttempts) {
        console.error('Three.js failed to load after maximum attempts');
      }
    }
  }, 100);
});
