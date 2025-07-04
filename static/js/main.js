// static/js/main.js
document.addEventListener('DOMContentLoaded', () => {
  console.log('main.js loaded', new Date().toISOString());

  // Base URL (protocol + host + port)
  const ORIGIN      = window.location.origin;
  const CONVERT_API = `${ORIGIN}/api/convert`;

  //
  // 1) NAVIGATION
  //
  const tabs     = document.querySelectorAll('.app-nav a');
  const sections = document.querySelectorAll('.app-section');
  tabs.forEach(tab => {
    tab.addEventListener('click', e => {
      e.preventDefault();
      const tgt = tab.getAttribute('href').slice(1);
      tabs.forEach(t => t.parentElement.classList.remove('active'));
      tab.parentElement.classList.add('active');
      sections.forEach(s => s.classList.toggle('active', s.id === tgt));
    });
  });

  //
  // 2) FILE SELECTION
  //
  const dropZone  = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const browseBtn = document.getElementById('browse-btn');
  const fileList  = document.getElementById('file-list');
  const uploadBtn = document.getElementById('upload-btn');
  const clearBtn  = document.getElementById('clear-btn');
  let files = [];

  // Prevent browser defaults
  ['dragenter','dragover','dragleave','drop'].forEach(evt =>
    dropZone.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); })
  );
  // Highlight on drag
  ['dragenter','dragover'].forEach(evt =>
    dropZone.addEventListener(evt, () => dropZone.classList.add('drag-over'))
  );
  ['dragleave','drop'].forEach(evt =>
    dropZone.addEventListener(evt, () => dropZone.classList.remove('drag-over'))
  );
  dropZone.addEventListener('drop', e => handleFiles(e.dataTransfer.files));
  browseBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => handleFiles(fileInput.files));
  clearBtn.addEventListener('click', () => { files = []; refreshList(); });

  function handleFiles(list) {
    files = [...files, ...list];
    refreshList();
  }
  function refreshList() {
    if (!files.length) {
      fileList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-images"></i>
          <p>No files selected</p>
        </div>`;
      uploadBtn.disabled = true;
      return;
    }
    uploadBtn.disabled = false;
    fileList.innerHTML = '';
    files.forEach((f,i) => {
      const div = document.createElement('div');
      div.className = 'file-item';
      div.innerHTML = `
        <i class="fas fa-file-image file-icon"></i>
        <div class="file-info">
          <div class="file-name">${f.name}</div>
          <div class="file-size">${(f.size/1024**2).toFixed(2)} MB</div>
        </div>
        <i class="fas fa-times file-remove" data-idx="${i}"></i>`;
      fileList.appendChild(div);
    });
    document.querySelectorAll('.file-remove').forEach(btn =>
      btn.addEventListener('click', () => {
        files.splice(+btn.dataset.idx,1);
        refreshList();
      })
    );
  }

  //
  // 3) UPLOAD & PROCESS
  //
  uploadBtn.addEventListener('click', async () => {
    if (!files.length) return;

    // switch to "Process" tab
    tabs[1].click();

    // build form
    const form = new FormData();
    files.forEach(f => form.append('images', f));

    startProgress();
    let modelUrl;

    try {
      const res = await fetch(CONVERT_API, { method:'POST', body: form });
      if (!res.ok) {
        const ct = res.headers.get('Content-Type')||'';
        let msg;
        if (ct.includes('application/json')) {
          const j = await res.json();
          msg = j.error||JSON.stringify(j);
        } else {
          msg = await res.text();
        }
        throw new Error(msg);
      }
      const json = await res.json();

      // ⚠️ **IMPORTANT**: prefix with `/api` so we hit the raw OBJ/GLB endpoint
      if (!json.model_url) throw new Error('no model_url in response');
      modelUrl = `/api${json.model_url}`;
    }
    catch(err) {
      console.error('Conversion failed:', err);
      alert(`Error: ${err.message}`);
      tabs[0].click();
      finishProgress();
      return;
    }

    // load 3D viewer
    try {
      const viewer = await import('/static/js/threejs-viewer.js');
      await viewer.loadModel(modelUrl);
    } catch(err) {
      console.error('Viewer load failed:', err);
      alert('Failed to initialize 3D viewer');
    }

    // switch to "View" tab
    setTimeout(() => tabs[2].click(), 300);

    // setup exports (just strip the current extension and re-append)
    // modelUrl === "/api/output/<uuid>.obj" or ".glb"
    const base = modelUrl.replace(/\.(?:obj|glb)$/, '');
    setupExport({
      obj: `${base}.obj`,
      stl: `${base}.stl`,
      ply: `${base}.ply`
    });

    finishProgress();
  });

  // give the "Refine Mesh" button some behavior (so it doesn't just sit there)
  document.getElementById('refine-btn').onclick = () => {
    alert('Mesh refinement is coming soon! 🔧');
  };

  //
  // 4) PROGRESS ANIMATION
  //
  function startProgress() {
    const txt = document.querySelector('.progress-text');
    const pct = document.querySelector('.progress-percent');
    const bar = document.querySelector('.progress-fill');
    let p = 0;
    const iv = setInterval(() => {
      p = Math.min(95, p + Math.random()*10);
      bar.style.width = p + '%';
      pct.textContent = Math.floor(p) + '%';
      txt.textContent = p < 30 ? 'Analyzing…' : p < 60 ? 'Meshing…' : 'Finalizing…';
      document.querySelector('.progress-container').dataset.iv = iv;
    }, 300);
  }
  function finishProgress() {
    const iv = +document.querySelector('.progress-container').dataset.iv;
    if (iv) clearInterval(iv);
    document.querySelector('.progress-fill').style.width = '100%';
    document.querySelector('.progress-percent').textContent = '100%';
    document.querySelector('.progress-text').textContent = 'Done!';
    document.querySelectorAll('.status-badge').forEach(b => b.classList.add('complete'));
  }

  //
  // 5) EXPORT BUTTONS
  //
  function setupExport(links) {
    document.querySelectorAll('.export-card').forEach(card => {
      const fmt = card.dataset.format;
      const btn = card.querySelector('.btn-export');
      btn.onclick = () => {
        const url = links[fmt];
        if (!url) return alert(`.${fmt} not available`);
        // make sure we go via `/api/output`
        const downloadUrl = url.startsWith('http') 
          ? url 
          : `${ORIGIN}${url}`;
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `model.${fmt}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };
    });

    document.getElementById('back-to-view-btn').onclick = () => tabs[2].click();
    document.getElementById('new-project-btn').onclick  = () => {
      if (!confirm('Start new project?')) return;
      files = [];
      refreshList();
      tabs[0].click();
      document.getElementById('model-viewer').innerHTML = `
        <div class="viewer-empty-state">
          <i class="fas fa-cube"></i><p>3D model will appear here</p>
        </div>`;
    };
  }

  console.log('main.js initialization complete');
});
