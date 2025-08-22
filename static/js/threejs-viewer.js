// static/js/threejs-viewer.js
// Uses global THREE (loaded from CDN)
// No exports - this is a regular script, not a module

let scene, camera, renderer, controls, currentMesh;
let autoRotate = false;
let wireframeEnabled = false;
let wireframeMesh = null;
let isPointCloud = false;
let pointSize = 1.0;

// Make functions available globally so main.js can access them
window.ThreeJSViewer = {
  initThreeJSViewer: initThreeJSViewer,
  loadModel: loadModel,
  toggleWireframe: toggleWireframe,
  toggleAutoRotate: toggleAutoRotate,
  setPointSize: setPointSize // For debugging point cloud
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

  // Enhanced lighting setup for better visibility
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); // Increased ambient light
  scene.add(ambientLight);

  const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1.0); // Increased intensity
  directionalLight1.position.set(10, 10, 10);
  directionalLight1.castShadow = true;
  directionalLight1.shadow.mapSize.width = 2048;
  directionalLight1.shadow.mapSize.height = 2048;
  scene.add(directionalLight1);

  const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.6); // Increased intensity
  directionalLight2.position.set(-10, -10, -10);
  scene.add(directionalLight2);

  // Add multiple point lights for better jewelry illumination
  const pointLight1 = new THREE.PointLight(0xffffff, 0.8, 100);
  pointLight1.position.set(5, 5, 5);
  scene.add(pointLight1);
  
  const pointLight2 = new THREE.PointLight(0xffffff, 0.6, 100);
  pointLight2.position.set(-5, 5, -5);
  scene.add(pointLight2);
  
  const pointLight3 = new THREE.PointLight(0xffffff, 0.4, 100);
  pointLight3.position.set(0, -5, 5);
  scene.add(pointLight3);

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

function createPointCloudFromGeometry(geometry, boundingBox) {
  console.log('Creating point cloud from geometry...');
  
  // Extract position data
  const positions = geometry.attributes.position;
  if (!positions) {
    throw new Error('No position data found in geometry');
  }
  
  const originalVertexCount = positions.count;
  const posArray = positions.array;
  console.log(`Original vertex count: ${originalVertexCount}`);
  
  // Step 1: Clean vertices - remove NaN, Infinity, and extreme outliers
  const cleanedVertices = [];
  const validIndices = [];
  let nanCount = 0;
  let infCount = 0;
  
  // First pass: collect valid (finite) vertices
  for (let i = 0; i < originalVertexCount; i++) {
    const x = posArray[i * 3];
    const y = posArray[i * 3 + 1]; 
    const z = posArray[i * 3 + 2];
    
    // Check for NaN or Infinity
    if (!isFinite(x) || !isFinite(y) || !isFinite(z)) {
      if (isNaN(x) || isNaN(y) || isNaN(z)) nanCount++;
      if (!isFinite(x) || !isFinite(y) || !isFinite(z)) infCount++;
      continue;
    }
    
    cleanedVertices.push({ x, y, z, index: i });
    validIndices.push(i);
  }
  
  console.log(`Removed ${nanCount} NaN vertices, ${infCount} Inf vertices`);
  console.log(`Valid vertices after NaN/Inf cleanup: ${cleanedVertices.length}`);
  
  if (cleanedVertices.length === 0) {
    throw new Error('No valid vertices found after cleaning');
  }
  
  // Step 2: Calculate centroid and remove extreme outliers
  let centroid = { x: 0, y: 0, z: 0 };
  for (const vertex of cleanedVertices) {
    centroid.x += vertex.x;
    centroid.y += vertex.y;
    centroid.z += vertex.z;
  }
  centroid.x /= cleanedVertices.length;
  centroid.y /= cleanedVertices.length;
  centroid.z /= cleanedVertices.length;
  
  console.log('Centroid:', centroid);
  
  // Calculate distances from centroid
  const distances = cleanedVertices.map(vertex => {
    const dx = vertex.x - centroid.x;
    const dy = vertex.y - centroid.y;
    const dz = vertex.z - centroid.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  });
  
  // Remove extreme outliers using IQR method
  distances.sort((a, b) => a - b);
  const q1 = distances[Math.floor(distances.length * 0.25)];
  const q3 = distances[Math.floor(distances.length * 0.75)];
  const iqr = q3 - q1;
  const outlierThreshold = q3 + 3 * iqr; // More aggressive outlier removal
  
  console.log(`Distance stats - Q1: ${q1.toFixed(3)}, Q3: ${q3.toFixed(3)}, IQR: ${iqr.toFixed(3)}, Threshold: ${outlierThreshold.toFixed(3)}`);
  
  // Filter outliers
  const filteredVertices = [];
  let outlierCount = 0;
  
  for (const vertex of cleanedVertices) {
    const dx = vertex.x - centroid.x;
    const dy = vertex.y - centroid.y;
    const dz = vertex.z - centroid.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    if (distance <= outlierThreshold) {
      filteredVertices.push(vertex);
    } else {
      outlierCount++;
    }
  }
  
  console.log(`Removed ${outlierCount} outlier vertices`);
  console.log(`Final vertex count: ${filteredVertices.length}`);
  
  if (filteredVertices.length === 0) {
    throw new Error('No vertices remain after outlier removal');
  }
  
  // Step 3: Create new clean geometry
  const cleanPositions = new Float32Array(filteredVertices.length * 3);
  for (let i = 0; i < filteredVertices.length; i++) {
    cleanPositions[i * 3] = filteredVertices[i].x;
    cleanPositions[i * 3 + 1] = filteredVertices[i].y;
    cleanPositions[i * 3 + 2] = filteredVertices[i].z;
  }
  
  // Create efficient BufferGeometry for points
  const pointGeometry = new THREE.BufferGeometry();
  pointGeometry.setAttribute('position', new THREE.BufferAttribute(cleanPositions, 3));
  
  // Manually compute bounding box and sphere to verify
  pointGeometry.computeBoundingBox();
  pointGeometry.computeBoundingSphere();
  
  const bbox = pointGeometry.boundingBox;
  const bsphere = pointGeometry.boundingSphere;
  console.log('Clean geometry bounding box:', bbox);
  console.log('Clean geometry bounding sphere radius:', bsphere.radius);
  
  if (!isFinite(bsphere.radius)) {
    console.error('Still getting NaN radius after cleaning!');
    // Fallback: manually set bounding sphere
    const size = bbox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    bsphere.radius = maxDim / 2;
    bsphere.center.copy(bbox.getCenter(new THREE.Vector3()));
    console.log('Applied manual bounding sphere:', bsphere);
  }
  
  // Calculate appropriate point size based on cleaned bounding box
  const size = bbox.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z);
  
  // Scale point size based on model size and vertex density
  let basePointSize = maxDimension / 200; // Smaller base size for better visibility
  
  // Adjust for vertex density - fewer vertices = larger points
  if (filteredVertices.length < 1000) {
    basePointSize *= 3.0;
  } else if (filteredVertices.length < 10000) {
    basePointSize *= 2.0;
  } else if (filteredVertices.length > 100000) {
    basePointSize *= 0.7;
  }
  
  // Ensure minimum and maximum point sizes
  basePointSize = Math.max(0.002, Math.min(0.2, basePointSize));
  pointSize = basePointSize;
  
  console.log(`Point size calculated: ${basePointSize} (model max dimension: ${maxDimension})`);
  
  // Create bright, visible colors - default to light gray/white
  const colorArray = new Float32Array(filteredVertices.length * 3);
  
  // Use original colors if available and valid
  const originalColors = geometry.attributes.color;
  let useOriginalColors = false;
  
  if (originalColors && validIndices.length > 0) {
    // Check if we can map original colors to filtered vertices
    useOriginalColors = true;
    console.log('Attempting to use original colors');
  }
  
  if (useOriginalColors && originalColors) {
    // Map original colors to filtered vertices
    let colorMappingSuccessful = true;
    for (let i = 0; i < filteredVertices.length; i++) {
      const originalIndex = filteredVertices[i].index;
      if (originalIndex < originalColors.count) {
        colorArray[i * 3] = originalColors.array[originalIndex * 3];
        colorArray[i * 3 + 1] = originalColors.array[originalIndex * 3 + 1];
        colorArray[i * 3 + 2] = originalColors.array[originalIndex * 3 + 2];
        
        // Validate color values
        if (!isFinite(colorArray[i * 3]) || !isFinite(colorArray[i * 3 + 1]) || !isFinite(colorArray[i * 3 + 2])) {
          colorMappingSuccessful = false;
          break;
        }
      } else {
        colorMappingSuccessful = false;
        break;
      }
    }
    
    if (!colorMappingSuccessful) {
      console.log('Original color mapping failed, using generated colors');
      useOriginalColors = false;
    } else {
      console.log('Successfully mapped original colors');
    }
  }
  
  if (!useOriginalColors) {
    // Generate bright, visible colors with Y-gradient
    const minY = Math.min(...filteredVertices.map(v => v.y));
    const maxY = Math.max(...filteredVertices.map(v => v.y));
    const yRange = maxY - minY || 1;
    
    for (let i = 0; i < filteredVertices.length; i++) {
      const normalizedY = (filteredVertices[i].y - minY) / yRange;
      
      // Create bright blue to gold gradient with high visibility
      colorArray[i * 3] = 0.4 + normalizedY * 0.6;     // R: 0.4 to 1.0
      colorArray[i * 3 + 1] = 0.4 + normalizedY * 0.5; // G: 0.4 to 0.9
      colorArray[i * 3 + 2] = 0.8 - normalizedY * 0.6; // B: 0.8 to 0.2
    }
    console.log('Generated bright gradient colors for point cloud');
  }
  
  pointGeometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
  
  // Create point material with enhanced visibility
  const pointMaterial = new THREE.PointsMaterial({
    size: basePointSize,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: false, // Make opaque for better visibility
    opacity: 1.0,
    depthTest: true,
    depthWrite: false,
    alphaTest: 0.1 // Helps with rendering
  });
  
  // Create Points object
  const points = new THREE.Points(pointGeometry, pointMaterial);
  
  console.log('Point cloud created successfully');
  console.log(`Final stats: ${filteredVertices.length} vertices, point size: ${basePointSize}`);
  
  return points;
}

function showPointCloudNotice(container, vertexCount, cleanedCount, removedCount) {
  // Remove any existing notice
  const existingNotice = container.querySelector('.point-cloud-notice');
  if (existingNotice) {
    existingNotice.remove();
  }
  
  // Create notice element
  const notice = document.createElement('div');
  notice.className = 'point-cloud-notice';
  notice.style.cssText = `
    position: absolute;
    top: 10px;
    left: 10px;
    background: rgba(0, 0, 0, 0.9);
    color: #ffd700;
    padding: 10px 15px;
    border-radius: 8px;
    font-size: 12px;
    font-family: monospace;
    z-index: 1000;
    border: 1px solid #ffd700;
    max-width: 300px;
    line-height: 1.4;
  `;
  
  let noticeText = `<i class="fas fa-info-circle"></i> Rendering as point-cloud<br>`;
  noticeText += `<strong>${cleanedCount.toLocaleString()}</strong> vertices displayed`;
  
  if (removedCount > 0) {
    noticeText += `<br><small>Cleaned: ${removedCount.toLocaleString()} invalid/outlier vertices removed</small>`;
  }
  
  notice.innerHTML = noticeText;
  container.appendChild(notice);
  
  // Optionally add point size control for debugging (commented out by default)
  /*
  const sizeControl = document.createElement('div');
  sizeControl.style.cssText = `
    position: absolute;
    top: 80px;
    left: 10px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 11px;
    z-index: 1000;
  `;
  sizeControl.innerHTML = `
    <label>Point Size: <input type="range" min="0.1" max="5" step="0.1" value="${pointSize}" 
           onchange="window.ThreeJSViewer.setPointSize(this.value)" style="width: 80px;"></label>
  `;
  container.appendChild(sizeControl);
  */
}

function setPointSize(newSize) {
  pointSize = parseFloat(newSize);
  if (currentMesh && isPointCloud && currentMesh.material) {
    currentMesh.material.size = pointSize;
    console.log('Point size updated to:', pointSize);
  }
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

  // Remove existing model and notices
  if (currentMesh) {
    scene.remove(currentMesh);
    currentMesh = null;
  }
  
  if (wireframeMesh) {
    scene.remove(wireframeMesh);
    wireframeMesh = null;
  }
  
  // Remove point cloud notice
  const existingNotice = container.querySelector('.point-cloud-notice');
  if (existingNotice) {
    existingNotice.remove();
  }
  
  isPointCloud = false;

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
    } else if (extension === 'ply') {
      // Check if PLYLoader is available
      if (typeof THREE !== 'undefined' && THREE.PLYLoader) {
        loader = new THREE.PLYLoader();
        console.log('Using PLYLoader');
      } else {
        throw new Error('PLYLoader not available - please check CDN loading');
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
    } else if (extension === 'ply') {
      // PLY loader returns geometry directly
      const geometry = asset;
      modelObject = new THREE.Group();
      
      // Check if PLY has faces
      const hasIndices = geometry.index && geometry.index.count > 0;
      const vertexCount = geometry.attributes.position ? geometry.attributes.position.count : 0;
      
      console.log(`PLY stats: ${vertexCount} vertices, ${hasIndices ? geometry.index.count / 3 : 0} faces`);
      
      if (!hasIndices && vertexCount > 0) {
        // Create point cloud for PLY without faces
        try {
          const box = new THREE.Box3().setFromBufferAttribute(geometry.attributes.position);
          const pointCloud = createPointCloudFromGeometry(geometry, box);
          modelObject.add(pointCloud);
          isPointCloud = true;
          
          const cleanedCount = pointCloud.geometry.attributes.position.count;
          const removedCount = vertexCount - cleanedCount;
          
          console.log('Rendering PLY as point-cloud (no faces)');
          showPointCloudNotice(container, vertexCount, cleanedCount, removedCount);
          
        } catch (error) {
          console.error('Failed to create PLY point cloud:', error);
          throw new Error(`PLY point cloud creation failed: ${error.message}`);
        }
      } else if (hasIndices) {
        // Create mesh for PLY with faces
        const material = new THREE.MeshPhongMaterial({
          color: 0xffd700,
          side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geometry, material);
        modelObject.add(mesh);
      } else {
        throw new Error('PLY file contains no valid geometry');
      }
    } else {
      modelObject = asset;
    }

    // Validate and process geometry for OBJ files
    let hasValidGeometry = false;
    let vertexCount = 0;
    let faceCount = 0;
    let firstGeometry = null;
    
    modelObject.traverse((child) => {
      if (child.isMesh && child.geometry) {
        hasValidGeometry = true;
        
        // Store first geometry for point cloud fallback
        if (!firstGeometry) {
          firstGeometry = child.geometry;
        }
        
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
          specular: 0x888888, // Increased specular
          shininess: 80,
          side: THREE.DoubleSide,
          transparent: false,
          opacity: 1.0,
          emissive: 0x111100 // Slight emissive glow to prevent complete darkness
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

    // Check if we need to create a point cloud fallback (for OBJ with no faces)
    if (faceCount === 0 && firstGeometry && extension === 'obj') {
      console.log('No faces detected, creating point cloud fallback');
      
      // Remove the mesh children and create point cloud instead
      const meshesToRemove = [];
      modelObject.traverse((child) => {
        if (child.isMesh) {
          meshesToRemove.push(child);
        }
      });
      
      meshesToRemove.forEach(mesh => {
        if (mesh.parent) {
          mesh.parent.remove(mesh);
        }
      });
      
      // Create point cloud from the first geometry with cleaning
      try {
        // We need to create a bounding box from the raw geometry first
        const tempBox = new THREE.Box3();
        if (firstGeometry.attributes.position) {
          tempBox.setFromBufferAttribute(firstGeometry.attributes.position);
        }
        
        const pointCloud = createPointCloudFromGeometry(firstGeometry, tempBox);
        modelObject.add(pointCloud);
        isPointCloud = true;
        
        // Calculate cleaned vertex counts for display
        const cleanedCount = pointCloud.geometry.attributes.position.count;
        const removedCount = vertexCount - cleanedCount;
        
        console.log(`Rendering as point-cloud (${cleanedCount} vertices, ${removedCount} removed)`);
        showPointCloudNotice(container, vertexCount, cleanedCount, removedCount);
        
      } catch (error) {
        console.error('Failed to create point cloud:', error);
        throw new Error(`Point cloud creation failed: ${error.message}`);
      }
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
      
      // Update point size if it's a point cloud
      if (isPointCloud && currentMesh.children[0] && currentMesh.children[0].material) {
        const adjustedPointSize = pointSize * scale;
        currentMesh.children[0].material.size = adjustedPointSize;
        console.log('Adjusted point size for scaling:', adjustedPointSize);
      }
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

    // Add a visible test cube to confirm scene is working (smaller for point clouds)
    const testSize = isPointCloud ? 0.2 : 0.5;
    const testGeometry = new THREE.BoxGeometry(testSize, testSize, testSize);
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
    console.log('Is point cloud:', isPointCloud);

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
  // Wireframe toggle (disabled for point clouds)
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
  if (isPointCloud) {
    console.log('Wireframe not supported for point clouds');
    return;
  }
  
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
