// static/js/threejs-viewer.js
// Uses global THREE (loaded from CDN)
// No exports - this is a regular script, not a module

let scene, camera, renderer, controls, currentMesh;
let autoRotate = false;
let wireframeEnabled = false;
let wireframeMesh = null;
let isPointCloud = false;
let pointSize = 1.0;
let animationId = null;

// Make functions available globally so main.js can access them
window.ThreeJSViewer = {
  initThreeJSViewer: initThreeJSViewer,
  loadModel: loadModel,
  toggleWireframe: toggleWireframe,
  toggleAutoRotate: toggleAutoRotate,
  setPointSize: setPointSize,
  dispose: dispose // Add cleanup function
};

async function initThreeJSViewer() {
  const container = document.getElementById('model-viewer');
  if (!container) throw new Error('No #model-viewer element');
  
  // Clear any existing content and cleanup
  dispose();
  container.innerHTML = '';

  // Create scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf5f5f5); // Light gray background for better contrast

  // Create camera with better FOV for small objects
  camera = new THREE.PerspectiveCamera(
    50, // Reduced FOV for better close-up viewing
    container.clientWidth / container.clientHeight,
    0.001, // Much smaller near plane for tiny objects
    1000
  );
  camera.position.set(3, 3, 3);

  // Create renderer with better settings
  renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true // Helps with screenshots
  });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap pixel ratio for performance
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);

  // Initialize controls with fallback
  initializeControls();

  // Optimized lighting setup for jewelry viewing
  setupLighting();

  // Add subtle grid helper
  const gridHelper = new THREE.GridHelper(2, 20, 0xcccccc, 0xcccccc);
  gridHelper.material.opacity = 0.2;
  gridHelper.material.transparent = true;
  scene.add(gridHelper);

  // Set up window resize handler
  window.addEventListener('resize', onWindowResize);
  
  // Start animation loop
  animate();

  console.log('Three.js viewer initialized successfully');
}

function setupLighting() {
  // Ambient light for overall illumination
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  // Key light (main directional light)
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
  keyLight.position.set(5, 5, 5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  keyLight.shadow.camera.near = 0.1;
  keyLight.shadow.camera.far = 50;
  keyLight.shadow.camera.left = -10;
  keyLight.shadow.camera.right = 10;
  keyLight.shadow.camera.top = 10;
  keyLight.shadow.camera.bottom = -10;
  scene.add(keyLight);

  // Fill light (softer, from opposite side)
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
  fillLight.position.set(-3, 2, -3);
  scene.add(fillLight);

  // Rim light (for edge definition)
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
  rimLight.position.set(0, -5, 2);
  scene.add(rimLight);

  // Point lights for jewelry sparkle
  const pointLight1 = new THREE.PointLight(0xffffff, 0.5, 20);
  pointLight1.position.set(2, 3, 2);
  scene.add(pointLight1);
  
  const pointLight2 = new THREE.PointLight(0xffffff, 0.3, 15);
  pointLight2.position.set(-2, 1, -1);
  scene.add(pointLight2);
}

function initializeControls() {
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
        console.log('OrbitControls not available, using manual camera control');
        setupManualControls();
        return;
      }
      
      // Configure controls for jewelry viewing
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.enableZoom = true;
      controls.enableRotate = true;
      controls.enablePan = true;
      controls.autoRotate = false;
      controls.autoRotateSpeed = 2.0;
      controls.minDistance = 0.1; // Allow very close viewing
      controls.maxDistance = 50;
      controls.target.set(0, 0, 0);
      
      console.log('OrbitControls initialized successfully');
    }
  } catch (error) {
    console.warn('Failed to initialize OrbitControls:', error);
    setupManualControls();
  }
}

function setupManualControls() {
  let isMouseDown = false;
  let mouseX = 0;
  let mouseY = 0;
  let cameraRadius = 5;
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
    event.preventDefault();
    cameraRadius += event.deltaY * 0.01;
    cameraRadius = Math.max(0.5, Math.min(20, cameraRadius));
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
  animationId = requestAnimationFrame(animate);
  
  if (controls) {
    controls.update();
  }
  
  if (currentMesh && autoRotate && !controls?.autoRotate) {
    currentMesh.rotation.y += 0.005; // Slower rotation
  }
  
  renderer.render(scene, camera);
}

function validateGeometry(geometry) {
  if (!geometry || !geometry.attributes || !geometry.attributes.position) {
    throw new Error('Invalid geometry: no position attribute');
  }
  
  const positions = geometry.attributes.position.array;
  let validCount = 0;
  let nanCount = 0;
  let infCount = 0;
  
  // Check for NaN/Infinity values
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    
    if (!isFinite(x) || !isFinite(y) || !isFinite(z)) {
      if (isNaN(x) || isNaN(y) || isNaN(z)) nanCount++;
      if (!isFinite(x) || !isFinite(y) || !isFinite(z)) infCount++;
    } else {
      validCount++;
    }
  }
  
  console.log(`Geometry validation: ${validCount} valid, ${nanCount} NaN, ${infCount} Inf vertices`);
  
  if (validCount === 0) {
    throw new Error('No valid vertices found in geometry');
  }
  
  // Force geometry bounds computation
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  
  const bbox = geometry.boundingBox;
  const bsphere = geometry.boundingSphere;
  
  if (!bbox || !bsphere) {
    throw new Error('Failed to compute geometry bounds');
  }
  
  // Check for invalid bounds
  if (!isFinite(bsphere.radius) || bsphere.radius <= 0) {
    console.warn('Invalid bounding sphere, attempting manual calculation');
    
    // Manual bounding sphere calculation
    const center = bbox.getCenter(new THREE.Vector3());
    const size = bbox.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z) / 2;
    
    geometry.boundingSphere.center.copy(center);
    geometry.boundingSphere.radius = radius;
    
    console.log('Manually set bounding sphere:', geometry.boundingSphere);
  }
  
  return {
    validVertices: validCount,
    invalidVertices: nanCount + infCount,
    bounds: bbox,
    radius: bsphere.radius
  };
}

function createCleanedGeometry(originalGeometry) {
  const positions = originalGeometry.attributes.position.array;
  const normals = originalGeometry.attributes.normal?.array;
  const colors = originalGeometry.attributes.color?.array;
  const uvs = originalGeometry.attributes.uv?.array;
  
  const cleanPositions = [];
  const cleanNormals = normals ? [] : null;
  const cleanColors = colors ? [] : null;
  const cleanUVs = uvs ? [] : null;
  
  let removedCount = 0;
  
  // Filter out invalid vertices
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    
    // Skip invalid vertices
    if (!isFinite(x) || !isFinite(y) || !isFinite(z)) {
      removedCount++;
      continue;
    }
    
    // Add valid vertex
    cleanPositions.push(x, y, z);
    
    if (cleanNormals && normals) {
      cleanNormals.push(normals[i], normals[i + 1], normals[i + 2]);
    }
    
    if (cleanColors && colors) {
      cleanColors.push(colors[i], colors[i + 1], colors[i + 2]);
    }
    
    if (cleanUVs && uvs) {
      const uvIndex = (i / 3) * 2;
      if (uvIndex + 1 < uvs.length) {
        cleanUVs.push(uvs[uvIndex], uvs[uvIndex + 1]);
      }
    }
  }
  
  if (cleanPositions.length === 0) {
    throw new Error('No valid vertices after cleaning');
  }
  
  // Create new geometry
  const cleanGeometry = new THREE.BufferGeometry();
  cleanGeometry.setAttribute('position', new THREE.Float32BufferAttribute(cleanPositions, 3));
  
  if (cleanNormals && cleanNormals.length > 0) {
    cleanGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(cleanNormals, 3));
  } else {
    cleanGeometry.computeVertexNormals();
  }
  
  if (cleanColors && cleanColors.length > 0) {
    cleanGeometry.setAttribute('color', new THREE.Float32BufferAttribute(cleanColors, 3));
  }
  
  if (cleanUVs && cleanUVs.length > 0) {
    cleanGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(cleanUVs, 2));
  }
  
  // Copy index if it exists and is valid
  if (originalGeometry.index) {
    const originalIndices = originalGeometry.index.array;
    const maxValidIndex = (cleanPositions.length / 3) - 1;
    const cleanIndices = [];
    
    for (let i = 0; i < originalIndices.length; i += 3) {
      const a = originalIndices[i];
      const b = originalIndices[i + 1];
      const c = originalIndices[i + 2];
      
      // Only keep triangles where all indices are valid
      if (a <= maxValidIndex && b <= maxValidIndex && c <= maxValidIndex) {
        cleanIndices.push(a, b, c);
      }
    }
    
    if (cleanIndices.length > 0) {
      cleanGeometry.setIndex(cleanIndices);
    }
  }
  
  console.log(`Cleaned geometry: removed ${removedCount} invalid vertices, kept ${cleanPositions.length / 3} valid vertices`);
  
  return cleanGeometry;
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

  // Clear existing model
  clearCurrentModel();
  isPointCloud = false;

  // Extract file extension
  const cleanUrl = modelUrl.split('?')[0];
  const extension = cleanUrl.split('.').pop().toLowerCase();
  console.log('Detected file extension:', extension);
  
  let loader = null;
  
  try {
    // Initialize appropriate loader
    if (extension === 'obj') {
      if (!THREE.OBJLoader) throw new Error('OBJLoader not available');
      loader = new THREE.OBJLoader();
    } else if (extension === 'ply') {
      if (!THREE.PLYLoader) throw new Error('PLYLoader not available');
      loader = new THREE.PLYLoader();
    } else if (extension === 'gltf' || extension === 'glb') {
      if (!THREE.GLTFLoader) throw new Error('GLTFLoader not available');
      loader = new THREE.GLTFLoader();
    } else if (extension === 'stl') {
      if (!THREE.STLLoader) throw new Error('STLLoader not available');
      loader = new THREE.STLLoader();
    } else {
      throw new Error(`Unsupported file format: ${extension}`);
    }

    // Load model with timeout
    const asset = await new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Model loading timed out after 10 minutes'));
      }, 600000);

      loader.load(
        modelUrl,
        (result) => {
          clearTimeout(timeoutId);
          console.log('Model loaded successfully');
          resolve(result);
        },
        (progress) => {
          updateLoadingProgress(container, progress);
        },
        (error) => {
          clearTimeout(timeoutId);
          console.error('Model loading error:', error);
          reject(error);
        }
      );
    });

    // Process loaded asset based on type
    let modelObject;
    
    if (extension === 'gltf' || extension === 'glb') {
      modelObject = asset.scene;
    } else if (extension === 'ply' || extension === 'stl') {
      // PLY/STL loaders return geometry directly
      const geometry = asset;
      
      try {
        // Validate and clean geometry
        const validation = validateGeometry(geometry);
        console.log('Geometry validation:', validation);
        
        let finalGeometry = geometry;
        if (validation.invalidVertices > 0) {
          console.log('Cleaning invalid vertices from geometry');
          finalGeometry = createCleanedGeometry(geometry);
        }
        
        // Create mesh or point cloud
        modelObject = new THREE.Group();
        
        const hasIndices = finalGeometry.index && finalGeometry.index.count > 0;
        const vertexCount = finalGeometry.attributes.position.count;
        
        if (hasIndices && finalGeometry.index.count >= 3) {
          // Create mesh with faces
          const material = new THREE.MeshPhongMaterial({
            color: 0xffd700,
            side: THREE.DoubleSide,
            transparent: false,
            opacity: 1.0,
            shininess: 50,
            specular: 0x222222
          });
          
          const mesh = new THREE.Mesh(finalGeometry, material);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          modelObject.add(mesh);
          
          console.log(`Created mesh with ${vertexCount} vertices and ${finalGeometry.index.count / 3} faces`);
        } else {
          // Create point cloud
          const pointMaterial = new THREE.PointsMaterial({
            size: 0.02,
            sizeAttenuation: true,
            color: 0xffd700,
            transparent: false,
            opacity: 1.0,
            vertexColors: finalGeometry.attributes.color ? true : false
          });
          
          const points = new THREE.Points(finalGeometry, pointMaterial);
          modelObject.add(points);
          isPointCloud = true;
          
          console.log(`Created point cloud with ${vertexCount} points`);
          showPointCloudNotice(container, vertexCount);
        }
      } catch (error) {
        throw new Error(`Geometry processing failed: ${error.message}`);
      }
    } else {
      // OBJ and other mesh formats
      modelObject = asset;
      
      // Process and validate all child meshes
      let processedMeshes = 0;
      modelObject.traverse((child) => {
        if (child.isMesh && child.geometry) {
          try {
            // Validate geometry
            const validation = validateGeometry(child.geometry);
            console.log(`Mesh geometry validation:`, validation);
            
            // Clean geometry if needed
            if (validation.invalidVertices > 0) {
              console.log('Cleaning child mesh geometry');
              child.geometry = createCleanedGeometry(child.geometry);
            }
            
            // Apply material
            child.material = new THREE.MeshPhongMaterial({
              color: 0xffd700,
              side: THREE.DoubleSide,
              transparent: false,
              opacity: 1.0,
              shininess: 50,
              specular: 0x222222
            });
            
            child.castShadow = true;
            child.receiveShadow = true;
            processedMeshes++;
            
          } catch (error) {
            console.warn(`Failed to process child mesh:`, error);
            // Remove problematic child
            if (child.parent) {
              child.parent.remove(child);
            }
          }
        }
      });
      
      if (processedMeshes === 0) {
        throw new Error('No valid meshes found in model');
      }
      
      console.log(`Processed ${processedMeshes} valid meshes`);
    }

    // Add model to scene
    scene.add(modelObject);
    currentMesh = modelObject;

    // Position and scale model
    positionModel(modelObject);

    // Remove loading state
    hideLoadingState(container);
    
    // Set up controls
    setupViewerControls();

    console.log('Model loaded and positioned successfully');

  } catch (error) {
    console.error('Failed to load model:', error);
    showErrorState(container, error.message);
    throw error; // Re-throw for main.js to handle
  }
}

function positionModel(modelObject) {
  // Calculate accurate bounding box
  const box = new THREE.Box3().setFromObject(modelObject);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  
  console.log('Model bounds:', {
    center: center.toArray(),
    size: size.toArray(),
    min: box.min.toArray(),
    max: box.max.toArray()
  });
  
  // Validate bounds
  if (!isFinite(center.x) || !isFinite(center.y) || !isFinite(center.z)) {
    console.warn('Invalid model center, using origin');
    center.set(0, 0, 0);
  }
  
  if (!isFinite(size.x) || !isFinite(size.y) || !isFinite(size.z)) {
    console.warn('Invalid model size, using default');
    size.set(1, 1, 1);
  }

  // Center the model
  modelObject.position.sub(center);
  
  // Scale to fit viewport
  const maxDimension = Math.max(size.x, size.y, size.z);
  if (maxDimension > 0 && isFinite(maxDimension)) {
    const targetSize = isPointCloud ? 2 : 3; // Smaller for point clouds
    const scale = targetSize / maxDimension;
    modelObject.scale.setScalar(scale);
    console.log(`Applied scale: ${scale} (max dimension: ${maxDimension})`);
  }

  // Update camera position
  const scaledSize = size.multiplyScalar(modelObject.scale.x);
  const distance = Math.max(scaledSize.length() * 1.5, 2);
  
  camera.position.set(distance, distance * 0.7, distance);
  camera.lookAt(0, 0, 0);
  
  if (controls) {
    controls.target.set(0, 0, 0);
    controls.update();
  }
  
  console.log(`Camera positioned at distance: ${distance}`);
}

function clearCurrentModel() {
  // Remove current model
  if (currentMesh) {
    scene.remove(currentMesh);
    
    // Dispose geometries and materials
    currentMesh.traverse((child) => {
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(material => material.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    
    currentMesh = null;
  }
  
  // Remove wireframe
  if (wireframeMesh) {
    scene.remove(wireframeMesh);
    if (wireframeMesh.geometry) wireframeMesh.geometry.dispose();
    if (wireframeMesh.material) wireframeMesh.material.dispose();
    wireframeMesh = null;
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
    color: #333;
    z-index: 1000;
    background: rgba(255,255,255,0.9);
    padding: 20px;
    border-radius: 10px;
  `;
  loadingDiv.innerHTML = `
    <i class="fas fa-spinner fa-spin" style="font-size: 2em; margin-bottom: 10px; color: #3b82f6;"></i>
    <p>Loading 3D model...</p>
    <div class="loading-progress" style="width: 200px; height: 4px; background: #e0e0e0; margin: 10px auto; border-radius: 2px;">
      <div class="loading-progress-bar" style="height: 100%; background: #3b82f6; width: 0%; border-radius: 2px; transition: width 0.3s;"></div>
    </div>
  `;
  container.appendChild(loadingDiv);
}

function updateLoadingProgress(container, progress) {
  const loadingDiv = container.querySelector('.viewer-loading');
  const progressBar = container.querySelector('.loading-progress-bar');
  
  if (progress.lengthComputable && progress.total > 0) {
    const percent = (progress.loaded / progress.total * 100).toFixed(1);
    if (progressBar) {
      progressBar.style.width = `${percent}%`;
    }
    if (loadingDiv) {
      loadingDiv.querySelector('p').textContent = `Loading 3D model... ${percent}%`;
    }
  }
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
    color: #333;
    z-index: 1000;
    background: rgba(255,255,255,0.9);
    padding: 20px;
    border-radius: 10px;
    border: 2px solid #ef4444;
  `;
  errorDiv.innerHTML = `
    <i class="fas fa-exclamation-triangle" style="font-size: 2em; margin-bottom: 10px; color: #ef4444;"></i>
    <p><strong>Failed to load 3D model</strong></p>
    <p style="font-size: 0.9em; opacity: 0.7; margin: 10px 0;">${message}</p>
    <button class="btn btn-primary" onclick="window.retryViewer()" style="margin: 5px;">
      <i class="fas fa-refresh"></i> Try Again
    </button>
    <button class="btn btn-secondary" onclick="document.querySelector('[href=\\'#export-section\\']').click()" style="margin: 5px;">
      <i class="fas fa-download"></i> Export Instead
    </button>
  `;
  container.appendChild(errorDiv);
}

function showPointCloudNotice(container, vertexCount) {
  const notice = document.createElement('div');
  notice.className = 'point-cloud-notice';
  notice.style.cssText = `
    position: absolute;
    top: 10px;
    left: 10px;
    background: rgba(59, 130, 246, 0.9);
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 11px;
    z-index: 1000;
    border: 1px solid rgba(59, 130, 246, 1);
    max-width: 200px;
  `;
  notice.innerHTML = `
    <i class="fas fa-info-circle"></i> Point Cloud Mode<br>
    <strong>${vertexCount.toLocaleString()}</strong> vertices
  `;
  container.appendChild(notice);
}

function setupViewerControls() {
  // Wireframe toggle
  const wireframeToggle = document.getElementById('wireframe-toggle');
  if (wireframeToggle) {
    wireframeToggle.disabled = isPointCloud;
    if (isPointCloud) {
      wireframeToggle.checked = false;
      wireframeEnabled = false;
    }
    wireframeToggle.addEventListener('change', (e) => {
      if (!isPointCloud) {
        toggleWireframe(e.target.checked);
      }
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
  if (isPointCloud) return;
  
  wireframeEnabled = enabled;
  
  if (!currentMesh) return;
  
  if (enabled) {
    let geometry = null;
    currentMesh.traverse((child) => {
      if (child.isMesh && child.geometry && !geometry) {
        geometry = child.geometry;
      }
    });
    
    if (geometry) {
      const wireframeGeometry = new THREE.WireframeGeometry(geometry);
      const wireframeMaterial = new THREE.LineBasicMaterial({ 
        color: 0x00ff00, 
        linewidth: 1,
        transparent: true,
        opacity: 0.8
      });
      wireframeMesh = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
      wireframeMesh.position.copy(currentMesh.position);
      wireframeMesh.rotation.copy(currentMesh.rotation);
      wireframeMesh.scale.copy(currentMesh.scale);
      scene.add(wireframeMesh);
    }
  } else {
    if (wireframeMesh) {
      scene.remove(wireframeMesh);
      if (wireframeMesh.geometry) wireframeMesh.geometry.dispose();
      if (wireframeMesh.material) wireframeMesh.material.dispose();
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

function setPointSize(newSize) {
  pointSize = parseFloat(newSize);
  if (currentMesh && isPointCloud) {
    currentMesh.traverse((child) => {
      if (child.isPoints && child.material) {
        child.material.size = pointSize;
      }
    });
  }
}

function dispose() {
  // Stop animation loop
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  
  // Clear models
  clearCurrentModel();
  
  // Dispose renderer
  if (renderer) {
    renderer.dispose();
    const container = document.getElementById('model-viewer');
    if (container && renderer.domElement && renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement);
    }
  }
  
  // Clear controls
  if (controls && controls.dispose) {
    controls.dispose();
  }
  
  // Clear scene
  if (scene) {
    while (scene.children.length > 0) {
      const object = scene.children[0];
      scene.remove(object);
      
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(material => material.dispose());
        } else {
          object.material.dispose();
        }
      }
    }
  }
  
  // Remove event listeners
  window.removeEventListener('resize', onWindowResize);
  
  console.log('Three.js viewer disposed');
}

// Wait for DOM and Three.js to be ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('Three.js viewer script loaded');
  
  const checkThreeJS = () => {
    if (typeof THREE !== 'undefined') {
      console.log('Three.js is available, revision:', THREE.REVISION);
      return true;
    } else {
      console.warn('Three.js is not available yet');
      return false;
    }
  };
  
  // Wait for Three.js to load
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

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  dispose();
});
