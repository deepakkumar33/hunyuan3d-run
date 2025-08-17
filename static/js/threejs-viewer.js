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
  scene.background = new THREE.Color(0x2c3e50); // Darker background for better contrast

  // Create camera
  camera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.set(5, 5, 5); // Move camera further back

  // Create renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // Initialize controls with fallback
  initializeControls();

  // Enhanced lighting setup
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Increased ambient light
  scene.add(ambientLight);

  const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight1.position.set(10, 10, 10);
  directionalLight1.castShadow = true;
  directionalLight1.shadow.mapSize.width = 2048;
  directionalLight1.shadow.mapSize.height = 2048;
  scene.add(directionalLight1);

  const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
  directionalLight2.position.set(-10, -10, -10);
  scene.add(directionalLight2);

  // Add point light for better jewelry illumination
  const pointLight = new THREE.PointLight(0xffffff, 0.5, 100);
  pointLight.position.set(0, 5, 5);
  scene.add(pointLight);

  // Add grid helper
  const gridHelper = new THREE.GridHelper(10, 10, 0x404040, 0x404040);
  gridHelper.material.opacity = 0.3;
  gridHelper.material.transparent = true;
  scene.add(gridHelper);

  // Set up window resize handler
  window.addEventListener('resize', onWindowResize);
  
  // Start animation loop
  animate();

  console.log('Three.js viewer initialized successfully');
}

function initializeControls() {
  // Try to initialize OrbitControls with multiple fallbacks
  try {
    if (typeof THREE !== 'undefined') {
      // Try different possible locations for OrbitControls
      if (THREE.OrbitControls) {
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        console.log('OrbitControls loaded from THREE.OrbitControls');
      } else if (window.OrbitControls) {
        controls = new window.OrbitControls(camera, renderer.domElement);
        console.log('OrbitControls loaded from window.OrbitControls');
      } else {
        // Manual OrbitControls implementation as fallback
        console.log('OrbitControls not available, using manual camera control');
        setupManualControls();
        return;
      }
      
      // Configure controls
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.enableZoom = true;
      controls.enableRotate = true;
      controls.enablePan = true;
      controls.autoRotate = false;
      controls.autoRotateSpeed = 2.0;
      controls.target.set(0, 0, 0);
      
      console.log('OrbitControls initialized successfully');
    }
  } catch (error) {
    console.warn('Failed to initialize OrbitControls:', error);
    setupManualControls();
  }
}

function setupManualControls() {
  // Simple manual camera controls as fallback
  let isMouseDown = false;
  let mouseX = 0;
  let mouseY = 0;
  let cameraRadius = 7;
  let cameraTheta = 0;
  let cameraPhi = Math.PI / 4;

  const canvas = renderer.domElement;
  
  canvas.addEventListener('mousedown', (event) => {
    isMouseDown = true;
    mouseX = event.clientX;
    mouseY = event.clientY;
  });

  canvas.addEventListener('mousemove', (event) => {
    if (!isMouseDown) return;
    
    const deltaX = event.clientX - mouseX;
    const deltaY = event.clientY - mouseY;
    
    cameraTheta += deltaX * 0.01;
    cameraPhi += deltaY * 0.01;
    
    // Constrain phi
    cameraPhi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraPhi));
    
    updateCameraPosition();
    
    mouseX = event.clientX;
    mouseY = event.clientY;
  });

  canvas.addEventListener('mouseup', () => {
    isMouseDown = false;
  });

  canvas.addEventListener('wheel', (event) => {
    cameraRadius += event.deltaY * 0.01;
    cameraRadius = Math.max(2, Math.min(20, cameraRadius));
    updateCameraPosition();
  });

  function updateCameraPosition() {
    camera.position.x = cameraRadius * Math.sin(cameraPhi) * Math.cos(cameraTheta);
    camera.position.y = cameraRadius * Math.cos(cameraPhi);
    camera.position.z = cameraRadius * Math.sin(cameraPhi) * Math.sin(cameraTheta);
    camera.lookAt(0, 0, 0);
  }

  updateCameraPosition();
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
      }, 60000); // 60 second timeout

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
    let vertexCount = 0;
    let faceCount = 0;
    
    modelObject.traverse((child) => {
      if (child.isMesh && child.geometry) {
        hasValidGeometry = true;
        
        // Count vertices and faces for debugging
        if (child.geometry.attributes.position) {
          vertexCount += child.geometry.attributes.position.count;
          if (child.geometry.index) {
            faceCount += child.geometry.index.count / 3;
          }
        }
        
        // Apply enhanced material with better visibility
        child.material = new THREE.MeshPhongMaterial({
          color: 0xffd700, // Bright gold color
          specular: 0x444444,
          shininess: 100,
          side: THREE.DoubleSide,
          transparent: false,
          opacity: 1.0
        });
        
        // Enable shadow casting and receiving
        child.castShadow = true;
        child.receiveShadow = true;
        
        // Ensure geometry has proper attributes
        if (!child.geometry.attributes.normal) {
          child.geometry.computeVertexNormals();
        }
        
        // Force geometry to update
        child.geometry.computeBoundingBox();
        child.geometry.computeBoundingSphere();
      }
    });

    console.log(`Model stats: ${vertexCount} vertices, ${faceCount} faces`);

    if (!hasValidGeometry) {
      throw new Error('No valid geometry found in model');
    }

    if (vertexCount === 0) {
      throw new Error('Model contains no vertices');
    }

    // Add model to scene
    scene.add(modelObject);
    currentMesh = modelObject;

    // Calculate bounding box and center the model
    const box = new THREE.Box3().setFromObject(currentMesh);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    console.log('Model bounding box:', {
      center: center,
      size: size,
      min: box.min,
      max: box.max
    });

    // Move model to center
    currentMesh.position.sub(center);
    
    // Scale to fit in view - be more aggressive with scaling
    const maxDimension = Math.max(size.x, size.y, size.z);
    console.log('Model max dimension:', maxDimension);
    
    if (maxDimension > 0) {
      // Scale to fit within a 4-unit cube
      const scale = 4 / maxDimension;
      currentMesh.scale.setScalar(scale);
      console.log('Applied scale factor:', scale);
    }

    // Update camera position to view the model
    const scaledSize = size.multiplyScalar(currentMesh.scale.x);
    const distance = Math.max(scaledSize.x, scaledSize.y, scaledSize.z) * 2;
    camera.position.set(distance, distance, distance);
    camera.lookAt(0, 0, 0);
    
    if (controls) {
      controls.target.set(0, 0, 0);
      controls.update();
    }

    // Add a visible test cube to confirm scene is working
    const testGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const testMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
    const testCube = new THREE.Mesh(testGeometry, testMaterial);
    testCube.position.set(3, 3, 3);
    scene.add(testCube);
    console.log('Added test cube for reference');

    // Remove loading state
    hideLoadingState(container);
    
    // Set up viewer controls
    setupViewerControls();

    console.log('Model loaded and positioned successfully');
    console.log('Current mesh position:', currentMesh.position);
    console.log('Current mesh scale:', currentMesh.scale);
    console.log('Camera position:', camera.position);

  } catch (error) {
    console.error('Failed to load model:', error);
    showErrorState(container, error.message);
  }
}

function showLoadingState(container) {
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'viewer-loading';
  loadingDiv.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: white;
    z-index: 1000;
  `;
  loadingDiv.innerHTML = `
    <i class="fas fa-spinner fa-spin" style="font-size: 2em; margin-bottom: 10px;"></i>
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
  errorDiv.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: white;
    z-index: 1000;
  `;
  errorDiv.innerHTML = `
    <i class="fas fa-exclamation-triangle" style="font-size: 2em; margin-bottom: 10px; color: #ff6b6b;"></i>
    <p>Failed to load 3D model</p>
    <p class="viewer-info" style="font-size: 0.9em; opacity: 0.7;">${message}</p>
    <button class="btn btn-primary" onclick="window.location.reload()" style="margin-top: 10px;">
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
      const wireframeMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 });
      wireframeMesh = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
      // Apply same transform as the original mesh
      wireframeMesh.position.copy(currentMesh.position);
      wireframeMesh.rotation.copy(currentMesh.rotation);
      wireframeMesh.scale.copy(currentMesh.scale);
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
      console.log('THREE.REVISION:', THREE.REVISION);
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
