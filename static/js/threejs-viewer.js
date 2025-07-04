// static/js/threejs-viewer.js
import * as THREE from 'https://unpkg.com/three@0.150.1/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.150.1/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader }  from 'https://unpkg.com/three@0.150.1/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader }   from 'https://unpkg.com/three@0.150.1/examples/jsm/loaders/OBJLoader.js';

let scene, camera, renderer, controls, currentMesh;

export function initThreeJSViewer() {
  const container = document.getElementById('model-viewer');
  if (!container) {
    console.error('🛑 initThreeJSViewer: container #model-viewer not found');
    return;
  }
  container.innerHTML = '';

  // 1) Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf8f9fa);

  // 2) Camera
  camera = new THREE.PerspectiveCamera(75, container.clientWidth/container.clientHeight, 0.1, 1000);
  camera.position.set(3,3,3);

  // 3) Renderer
  renderer = new THREE.WebGLRenderer({ antialias:true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  // 4) Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping  = true;
  controls.dampingFactor  = 0.05;
  controls.target.set(0,0,0);

  // 5) Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  let dl1 = new THREE.DirectionalLight(0xffffff, 0.8);
  dl1.position.set(5,5,5);
  scene.add(dl1);
  let dl2 = new THREE.DirectionalLight(0xffffff, 0.3);
  dl2.position.set(-5,-5,-5);
  scene.add(dl2);

  // 6) Resize handler
  window.addEventListener('resize', ()=>{
    const w=container.clientWidth, h=container.clientHeight;
    camera.aspect = w/h;
    camera.updateProjectionMatrix();
    renderer.setSize(w,h);
  });

  // 7) Render loop
  (function animate(){
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  })();

  console.log('✅ ThreeJS viewer initialized');
}

export function loadModel(url) {
  if (!scene||!renderer||!camera) {
    console.warn('⚠️ Calling initThreeJSViewer() automatically');
    initThreeJSViewer();
  }
  const container = document.getElementById('model-viewer');
  // loading overlay
  const overlay = document.createElement('div');
  overlay.className = 'viewer-empty-state';
  overlay.innerHTML = `<i class="fas fa-spinner fa-spin"></i><p>Loading…</p>`;
  container.appendChild(overlay);

  // drop old mesh
  if (currentMesh) {
    scene.remove(currentMesh);
    currentMesh = null;
  }

  // pick loader
  const ext = url.split('.').pop().toLowerCase();
  const onLoad = obj => {
    container.removeChild(overlay);
    currentMesh = (ext==='obj' ? obj : obj.scene || obj);
    scene.add(currentMesh);

    // center & scale
    const box = new THREE.Box3().setFromObject(currentMesh);
    const c = box.getCenter(new THREE.Vector3());
    currentMesh.position.sub(c);
    const s = box.getSize(new THREE.Vector3());
    const m = Math.max(s.x,s.y,s.z);
    currentMesh.scale.setScalar(1.5/m);

    controls.target.set(0,0,0);
    camera.position.set(0,0,2);
    controls.update();

    console.log('✅ Model loaded');
  };
  const onProg = xhr => {
    if (xhr.total) console.log(`📦 ${(xhr.loaded/xhr.total*100).toFixed(1)}%`);
  };
  const onErr = e => {
    console.error('❌ Model load failed', e);
    container.removeChild(overlay);
    container.innerHTML = `<div class="viewer-empty-state"><i class="fas fa-exclamation-triangle"></i><p>Failed to load</p></div>`;
  };

  if (ext==='obj') {
    new OBJLoader().load(url, onLoad, onProg, onErr);
  } else {
    new GLTFLoader().load(url, gltf=>onLoad(gltf), onProg, onErr);
  }
}
