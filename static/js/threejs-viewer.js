// static/js/threejs-viewer.js
import * as THREE from 'https://unpkg.com/three@0.150.1/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.150.1/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader }  from 'https://unpkg.com/three@0.150.1/examples/jsm/loaders/GLTFLoader.js';

let scene, camera, renderer, mesh, controls;

function initThreeJSViewer() {
  const container = document.getElementById('model-viewer');
  container.innerHTML = '';
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf8f9fa);

  camera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1, 1000
  );
  camera.position.set(0, 0, 2);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0,0,0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dl1 = new THREE.DirectionalLight(0xffffff, 0.8);
  dl1.position.set(1,1,1).normalize();
  scene.add(dl1);
  const dl2 = new THREE.DirectionalLight(0xffffff, 0.4);
  dl2.position.set(-1,-1,-1).normalize();
  scene.add(dl2);

  window.addEventListener('resize', onWindowResize);
  animate();
}

function onWindowResize() {
  const container = document.getElementById('model-viewer');
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate() {
  requestAnimationFrame(animate);
  if (mesh) mesh.rotation.y += 0.005;
  controls.update();
  renderer.render(scene, camera);
}

function loadModel(modelUrl) {
  if (!scene) initThreeJSViewer();
  const loader = new GLTFLoader();

  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'viewer-empty-state';
  loadingDiv.innerHTML = `<i class="fas fa-spinner fa-spin"></i><p>Loading 3D model...</p>`;
  document.getElementById('model-viewer').appendChild(loadingDiv);

  if (mesh) {
    scene.remove(mesh);
    mesh = null;
  }

  loader.load(
    modelUrl,
    gltf => {
      document.getElementById('model-viewer').removeChild(loadingDiv);
      mesh = gltf.scene;
      mesh.traverse(c => {
        if (c.isMesh) {
          c.material = new THREE.MeshPhongMaterial({
            color: 0x6a4cff, specular: 0x555555, shininess: 50,
            side: THREE.DoubleSide
          });
          c.add(new THREE.LineSegments(
            new THREE.WireframeGeometry(c.geometry),
            new THREE.LineBasicMaterial({ color: 0x000000, opacity:0.25 })
          ));
        }
      });
      scene.add(mesh);
      // center & scale
      const box = new THREE.Box3().setFromObject(mesh);
      const center = box.getCenter(new THREE.Vector3());
      mesh.position.sub(center);
      const size = box.getSize(new THREE.Vector3());
      const maxD = Math.max(size.x, size.y, size.z);
      const s = 1.5 / maxD;
      mesh.scale.set(s,s,s);
      controls.update();
    },
    xhr => console.log(`Loading model: ${(xhr.loaded/xhr.total*100).toFixed(2)}%`),
    err => {
      console.error('Error loading model:', err);
      loadingDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i><p>Failed to load model</p>`;
    }
  );
}

export { initThreeJSViewer, loadModel };
