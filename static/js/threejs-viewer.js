// static/js/threejs-viewer.js
import * as THREE from 'three';  // resolved by import map in HTML
import { OrbitControls } from 'https://unpkg.com/three@0.150.1/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader }   from 'https://unpkg.com/three@0.150.1/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader }    from 'https://unpkg.com/three@0.150.1/examples/jsm/loaders/OBJLoader.js';

let scene, camera, renderer, mesh, controls;

function initViewer(){
  const container = document.getElementById('model-viewer');
  if (!container) throw new Error('No model-viewer');
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

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.25;

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const d1 = new THREE.DirectionalLight(0xffffff, 0.8);
  d1.position.set(1, 1, 1).normalize();
  scene.add(d1);
  const d2 = new THREE.DirectionalLight(0xffffff, 0.4);
  d2.position.set(-1, -1, -1).normalize();
  scene.add(d2);

  window.addEventListener('resize', () => {
    const c = document.getElementById('model-viewer');
    if (!c) return;
    camera.aspect = c.clientWidth / c.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(c.clientWidth, c.clientHeight);
  });

  animate();
}

function animate(){
  requestAnimationFrame(animate);
  if (mesh) mesh.rotation.y += 0.005;
  if (controls) controls.update();
  if (renderer && scene && camera) renderer.render(scene, camera);
}

/**
 * Load a model URL. Detect extension:
 * - If .glb or .gltf → use GLTFLoader
 * - If .obj → use OBJLoader
 * Otherwise, attempt GLTFLoader first.
 */
function loadModel(url){
  const container = document.getElementById('model-viewer');
  if (!scene) {
    initViewer();
  } else {
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
  }

  // Loading indicator
  const ld = document.createElement('div');
  ld.className = 'viewer-empty-state';
  ld.innerHTML = `<i class="fas fa-spinner fa-spin"></i><p>Loading model…</p>`;
  container.appendChild(ld);

  // Remove previous mesh
  if (mesh) {
    scene.remove(mesh);
    mesh = null;
  }

  // Choose loader by extension
  const lower = url.toLowerCase();
  if (lower.endsWith('.obj')) {
    // OBJLoader
    const loader = new OBJLoader();
    loader.load(
      url,
      obj => {
        container.removeChild(ld);
        mesh = obj;
        mesh.traverse(ch => {
          if (ch.isMesh) {
            ch.material = new THREE.MeshPhongMaterial({
              color: 0x6a4cff,
              specular: 0x555555,
              shininess: 50,
              side: THREE.DoubleSide
            });
            const wf = new THREE.LineSegments(
              new THREE.WireframeGeometry(ch.geometry),
              new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 })
            );
            ch.add(wf);
          }
        });
        scene.add(mesh);

        // Center & scale
        const box = new THREE.Box3().setFromObject(mesh);
        const cen = box.getCenter(new THREE.Vector3());
        const sz  = box.getSize(new THREE.Vector3());
        const m = Math.max(sz.x, sz.y, sz.z);
        mesh.position.sub(cen);
        mesh.scale.setScalar(1.5 / m);
        camera.position.set(0, 0, 2);
        if (controls) {
          controls.target.set(0, 0, 0);
          controls.update();
        }
      },
      xhr => {
        if (xhr.total) {
          console.log(`OBJ Model ${(xhr.loaded / xhr.total * 100).toFixed(2)}% loaded`);
        }
      },
      err => {
        console.error('OBJ load error', err);
        container.removeChild(ld);
        const errDiv = document.createElement('div');
        errDiv.className = 'viewer-empty-state';
        errDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i><p>Failed to load OBJ model</p>`;
        container.appendChild(errDiv);
      }
    );
  } else {
    // Attempt GLTFLoader
    const loader = new GLTFLoader();
    loader.load(
      url,
      gltf => {
        container.removeChild(ld);
        mesh = gltf.scene;
        mesh.traverse(child => {
          if (child.isMesh) {
            child.material = new THREE.MeshPhongMaterial({
              color: 0x6a4cff,
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
        scene.add(mesh);

        // Center & scale
        const box = new THREE.Box3().setFromObject(mesh);
        const cen = box.getCenter(new THREE.Vector3());
        const sz  = box.getSize(new THREE.Vector3());
        const m = Math.max(sz.x, sz.y, sz.z);
        mesh.position.sub(cen);
        mesh.scale.setScalar(1.5 / m);
        camera.position.set(0, 0, 2);
        if (controls) {
          controls.target.set(0, 0, 0);
          controls.update();
        }
      },
      xhr => {
        if (xhr.total) {
          console.log(`GLTF Model ${(xhr.loaded / xhr.total * 100).toFixed(2)}% loaded`);
        }
      },
      err => {
        console.error('GLTF load error', err);
        container.removeChild(ld);
        const errDiv = document.createElement('div');
        errDiv.className = 'viewer-empty-state';
        errDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i><p>Failed to load model</p>`;
        container.appendChild(errDiv);
      }
    );
  }
}

export { loadModel };
