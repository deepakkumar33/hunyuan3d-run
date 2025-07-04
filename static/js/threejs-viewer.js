import * as THREE from 'https://unpkg.com/three@0.150.1/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.150.1/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.150.1/examples/jsm/loaders/GLTFLoader.js';

let scene, camera, renderer, mesh, controls;

function initThreeJSViewer() {
    try {
        const container = document.getElementById('model-viewer');
        if (!container) {
            throw new Error('Model viewer container not found');
        }

        container.innerHTML = '';

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf8f9fa);

        camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
        camera.position.set(0, 0, 2);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(renderer.domElement);

        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.25;
        controls.target.set(0, 0, 0);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 1).normalize();
        scene.add(directionalLight);

        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
        directionalLight2.position.set(-1, -1, -1).normalize();
        scene.add(directionalLight2);

        window.addEventListener('resize', onWindowResize);
        animate();
    } catch (error) {
        console.error('Error initializing Three.js viewer:', error);
        const container = document.getElementById('model-viewer');
        if (container) {
            container.innerHTML = `
                <div class="viewer-empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Failed to initialize 3D viewer. Check the console.</p>
                </div>
            `;
        }
    }
}

function createDemoRingMesh() {
    try {
        const geometry = new THREE.TorusGeometry(0.5, 0.15, 16, 32);
        const material = new THREE.MeshPhongMaterial({
            color: 0x6a4cff,
            specular: 0x555555,
            shininess: 50
        });
        mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        const wireframe = new THREE.LineSegments(
            new THREE.WireframeGeometry(geometry),
            new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 })
        );
        mesh.add(wireframe);
    } catch (error) {
        console.error('Error creating demo ring mesh:', error);
    }
}

function onWindowResize() {
    try {
        const container = document.getElementById('model-viewer');
        if (container && camera && renderer) {
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        }
    } catch (error) {
        console.error('Error on window resize:', error);
    }
}

function animate() {
    try {
        requestAnimationFrame(animate);
        if (mesh) {
            mesh.rotation.y += 0.005;
        }
        if (controls) {
            controls.update();
        }
        if (renderer && scene && camera) {
            renderer.render(scene, camera);
        }
    } catch (error) {
        console.error('Error in animation loop:', error);
    }
}

function loadModel(modelUrl, sessionId) {
    try {
        if (!scene || !renderer) {
            initThreeJSViewer();
        } else {
            const container = document.getElementById('model-viewer');
            if (container) {
                container.innerHTML = '';
                container.appendChild(renderer.domElement);
            }
        }

        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'viewer-empty-state';
        loadingDiv.innerHTML = `
            <i class="fas fa-spinner fa-spin"></i>
            <p>Loading 3D model...</p>
        `;
        document.getElementById('model-viewer').appendChild(loadingDiv);

        if (mesh) {
            scene.remove(mesh);
            mesh = null;
        }

        const loader = new GLTFLoader();
        loader.load(
            modelUrl,
            function(gltf) {
                document.getElementById('model-viewer').removeChild(loadingDiv);

                mesh = gltf.scene;

                mesh.traverse(function(child) {
                    if (child.isMesh) {
                        child.material = new THREE.MeshPhongMaterial({
                            color: 0x6a4cff,
                            specular: 0x555555,
                            shininess: 50,
                            side: THREE.DoubleSide
                        });

                        const wireframe = new THREE.LineSegments(
                            new THREE.WireframeGeometry(child.geometry),
                            new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 })
                        );
                        child.add(wireframe);
                    }
                });

                scene.add(mesh);

                const box = new THREE.Box3().setFromObject(mesh);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);

                mesh.position.sub(center);
                const scale = 1.5 / maxDim;
                mesh.scale.set(scale, scale, scale);

                camera.position.set(0, 0, 2);
                camera.lookAt(0, 0, 0);
                controls.target.set(0, 0, 0);
                controls.update();

                console.log('Model loaded successfully:', modelUrl);
            },
            function(xhr) {
                console.log(`Loading model: ${(xhr.loaded / xhr.total * 100).toFixed(2)}%`);
            },
            function(error) {
                console.error('Error loading model:', error);
                document.getElementById('model-viewer').removeChild(loadingDiv);
                const errorDiv = document.createElement('div');
                errorDiv.className = 'viewer-empty-state';
                errorDiv.innerHTML = `
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Failed to load model. Check if the .glb file is available or try again.</p>
                `;
                document.getElementById('model-viewer').appendChild(errorDiv);
            }
        );
    } catch (error) {
        console.error('Error in loadModel:', error);
    }
}

export { initThreeJSViewer, loadModel };
