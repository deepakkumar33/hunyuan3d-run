// static/js/threejs-viewer.js
import * as THREE from 'https://unpkg.com/three@0.150.1/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.150.1/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader }  from 'https://unpkg.com/three@0.150.1/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader }   from 'https://unpkg.com/three@0.150.1/examples/jsm/loaders/OBJLoader.js';

let scene, camera, renderer, controls, currentMesh;

/**
 * Internal helper: set up scene, camera, lights, renderer, controls.
 */
function _init() {
  if (scene) return;              // already done
  const container = document.getElementById('model-viewer');
  if (!container) throw new Error('#model-viewer container not found');

  // clear
  container.innerHTML = '';

  // 1) scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf8f9fa);

  // 2) camera
  camera = new THREE.PerspectiveCamera(75, container.clientWidth/container.clientHeight, 0.1, 1000);
  camera.position.set(3,3,3);

  // 3) renderer
  renderer = new THREE.WebGLRenderer({ antialias:true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  // 4) controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0,0,0);

  // 5) lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const dl1 = new THREE.DirectionalLight(0xffffff, 0.8);
  dl1.position.set(5,5,5);
  scene.add(dl1);
  const dl2 = new THREE.DirectionalLight(0xffffff, 0.3);
  dl2.position.set(-5,-5,-5);
  scene.add(dl2);

  // 6) handle resize
  window.addEventListener('resize', ()=>{
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w/h;
    camera.updateProjectionMatrix();
    renderer.setSize(w,h);
  });

  // 7) render loop
  (function animate(){
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  })();
}

/**
 * Load a 3D model (GLTF or OBJ) into the scene.
 * If this is the first call, will automatically init the viewer.
 * @param {string} url absolute or relative URL to .glb/.gltf/.obj
 */
export async function loadModel(url) {
  try {
    _init();
  } catch(err) {
    console.error('Viewer init failed:', err);
    document.getElementById('model-viewer').innerHTML = `
      <div class="viewer-empty-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Failed to initialize 3D viewer</p>
      </div>`;
    return;
  }

  const container = document.getElementById('model-viewer');
  // show loading overlay
  const overlay = document.createElement('div');
  overlay.className = 'viewer-empty-state';
  overlay.innerHTML = `<i class="fas fa-spinner fa-spin"></i><p>Loading model…</p>`;
  container.appendChild(overlay);

  // remove previous mesh
  if (currentMesh) {
    scene.remove(currentMesh);
    currentMesh = null;
  }

  // loader selection
  const ext = url.split('.').pop().toLowerCase();
  const onLoad = obj => {
    container.removeChild(overlay);
    currentMesh = ext === 'obj' ? obj : obj.scene || obj;
    scene.add(currentMesh);

    // center & scale
    const box = new THREE.Box3().setFromObject(currentMesh);
    const c   = box.getCenter(new THREE.Vector3());
    const s   = box.getSize(new THREE.Vector3());
    currentMesh.position.sub(c);
    const m = Math.max(s.x,s.y,s.z);
    currentMesh.scale.setScalar(1.5/m);

    controls.target.set(0,0,0);
    camera.position.set(0,0,2);
    controls.update();
    console.log('Model loaded:', url);
  };
  const onProgress = xhr => {
    if (xhr.total) {
      console.log(`Loading: ${(xhr.loaded/xhr.total*100).toFixed(1)}%`);
    }
  };
  const onError = err => {
    console.error('Model load error:', err);
    container.removeChild(overlay);
    container.innerHTML = `
      <div class="viewer-empty-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Failed to load model</p>
      </div>`;
  };

  if (ext === 'obj') {
    new OBJLoader().load(url, onLoad, onProgress, onError);
  } else {
    new GLTFLoader().load(url, gltf => onLoad(gltf), onProgress, onError);
  }
}
