// threejs-viewer.js - Fixed version without ES6 modules
let scene, camera, renderer, mesh, controls;
let currentMesh = null;
let directionalLight1, directionalLight2, ambientLight;

function initThreeJSViewer(modelUrl) {
    console.log('Initializing ThreeJS viewer with model:', modelUrl);
    
    const container = document.getElementById('model-viewer');
    if (!container) {
        console.error('Model viewer container not found');
        return;
    }

    // Clear container
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
    camera.position.set(0, 0, 5);

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Create controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0, 0);
    controls.minDistance = 1;
    controls.maxDistance = 20;

    // Setup lighting
    setupLighting();

    // Handle window resize
    window.addEventListener('resize', onWindowResize);

    // Start animation loop
    animate();

    // Load model if provided
    if (modelUrl) {
        loadModel(modelUrl);
    }

    // Setup global functions for controls
    setupGlobalFunctions();

    console.log('ThreeJS viewer initialized');
}

function setupLighting() {
    // Ambient light
    ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    // Main directional light
    directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(5, 5, 5);
    directionalLight1.castShadow = true;
    directionalLight1.shadow.mapSize.width = 2048;
    directionalLight1.shadow.mapSize.height = 2048;
    scene.add(directionalLight1);

    // Fill light
    directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight2.position.set(-5, -5, -5);
    scene.add(directionalLight2);

    // Additional point lights for better illumination
    const pointLight1 = new THREE.PointLight(0xffffff, 0.5, 100);
    pointLight1.position.set(10, 10, 10);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xffffff, 0.3, 100);
    pointLight2.position.set(-10, -10, 10);
    scene.add(pointLight2);
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
    
    if (controls) {
        controls.update();
    }
    
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

function loadModel(modelUrl) {
    console.log('Loading model:', modelUrl);
    
    if (!scene || !renderer) {
        console.error('Scene not initialized');
        return;
    }

    // Show loading state
    const container = document.getElementById('model-viewer');
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'viewer-loading';
    loadingDiv.innerHTML = `
        <div class="loading-spinner">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Loading 3D model...</p>
        </div>
    `;
    loadingDiv.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(255, 255, 255, 0.9);
        padding: 20px;
        border-radius: 10px;
        text-align: center;
        z-index: 1000;
    `;
    container.appendChild(loadingDiv);

    // Remove previous mesh
    if (currentMesh) {
        scene.remove(currentMesh);
        currentMesh = null;
    }

    // Determine file type and load accordingly
    const fileExtension = modelUrl.split('.').pop().toLowerCase();
    
    if (fileExtension === 'glb' || fileExtension === 'gltf') {
        loadGLTFModel(modelUrl, loadingDiv);
    } else if (fileExtension === 'obj') {
        loadOBJModel(modelUrl, loadingDiv);
    } else {
        // Default to GLTF
        loadGLTFModel(modelUrl, loadingDiv);
    }
}

function loadGLTFModel(url, loadingDiv) {
    const loader = new THREE.GLTFLoader();
    
    loader.load(
        url,
        function(gltf) {
            console.log('GLTF model loaded successfully');
            onModelLoaded(gltf.scene, loadingDiv);
        },
        function(progress) {
            console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
        },
        function(error) {
            console.error('Error loading GLTF model:', error);
            onModelError(error, loadingDiv, 'GLTF');
        }
    );
}

function loadOBJModel(url, loadingDiv) {
    const loader = new THREE.OBJLoader();
    
    loader.load(
        url,
        function(obj) {
            console.log('OBJ model loaded successfully');
            onModelLoaded(obj, loadingDiv);
        },
        function(progress) {
            console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
        },
        function(error) {
            console.error('Error loading OBJ model:', error);
            onModelError(error, loadingDiv, 'OBJ');
        }
    );
}

function onModelLoaded(model, loadingDiv) {
    // Remove loading indicator
    if (loadingDiv && loadingDiv.parentNode) {
        loadingDiv.parentNode.removeChild(loadingDiv);
    }

    currentMesh = model;
    
    // Apply materials and setup mesh
    model.traverse(function(child) {
        if (child.isMesh) {
            // Apply a nice material
            child.material = new THREE.MeshPhongMaterial({
                color: 0x6a4cff,
                specular: 0x555555,
                shininess: 100,
                side: THREE.DoubleSide
            });
            
            // Enable shadows
            child.castShadow = true;
            child.receiveShadow = true;
            
            // Add wireframe overlay
            const wireframe = new THREE.LineSegments(
                new THREE.WireframeGeometry(child.geometry),
                new THREE.LineBasicMaterial({ 
                    color: 0x000000, 
                    transparent: true, 
                    opacity: 0.1 
                })
            );
            child.add(wireframe);
            child.userData.wireframe = wireframe;
        }
    });

    // Add model to scene
    scene.add(model);

    // Center and scale the model
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    // Center the model
    model.position.sub(center);
    
    // Scale the model to fit in view
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 2 / maxDim;
    model.scale.setScalar(scale);

    // Adjust camera position
    camera.position.set(0, 0, 5);
    controls.target.set(0, 0, 0);
    controls.update();

    console.log('Model positioned and scaled');
}

function onModelError(error, loadingDiv, format) {
    console.error(`${format} model loading failed:`, error);
    
    // Remove loading indicator
    if (loadingDiv && loadingDiv.parentNode) {
        loadingDiv.parentNode.removeChild(loadingDiv);
    }

    // Show error state
    const container = document.getElementById('model-viewer');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'viewer-error';
    errorDiv.innerHTML = `
        <div class="error-message">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Failed to load 3D model</h3>
            <p>The ${format} model could not be loaded.</p>
            <p><small>Error: ${error.message || 'Unknown error'}</small></p>
        </div>
    `;
    errorDiv.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(255, 255, 255, 0.9);
        padding: 20px;
        border-radius: 10px;
        text-align: center;
        color: #dc3545;
        z-index: 1000;
    `;
    container.appendChild(errorDiv);
}

function setupGlobalFunctions() {
    // Global functions for UI controls
    window.setViewAngle = function(view) {
        if (!camera || !controls) return;
        
        switch(view) {
            case 'front':
                camera.position.set(0, 0, 5);
                break;
            case 'top':
                camera.position.set(0, 5, 0);
                break;
            case 'side':
                camera.position.set(5, 0, 0);
                break;
            case 'perspective':
            default:
                camera.position.set(3, 3, 3);
                break;
        }
        controls.target.set(0, 0, 0);
        controls.update();
    };

    window.setMeshOpacity = function(opacity) {
        if (!currentMesh) return;
        
        currentMesh.traverse(function(child) {
            if (child.isMesh && child.material) {
                child.material.transparent = opacity < 1;
                child.material.opacity = opacity;
            }
        });
    };

    window.toggleWireframe = function(show) {
        if (!currentMesh) return;
        
        currentMesh.traverse(function(child) {
            if (child.isMesh && child.userData.wireframe) {
                child.userData.wireframe.visible = show;
            }
        });
    };

    window.setLightIntensity = function(intensity) {
        if (directionalLight1) directionalLight1.intensity = intensity * 0.8;
        if (directionalLight2) directionalLight2.intensity = intensity * 0.3;
        if (ambientLight) ambientLight.intensity = intensity * 0.4;
    };

    window.toggleShadows = function(enable) {
        if (renderer) {
            renderer.shadow
