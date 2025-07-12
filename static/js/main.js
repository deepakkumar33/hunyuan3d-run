// static/js/main.js
document.addEventListener('DOMContentLoaded', () => {
  console.log('main.js loaded', new Date().toISOString());

  // Force all API calls to port 5000 (where Flask is running)
  const HOST        = window.location.hostname;
  const CONVERT_API = `http://${HOST}:5000/api/convert`;

  // Global variables for model data
  let currentModelData = null;

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
    let exportFormats = {};

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
      console.log('API Response:', json);

      // primary viewer URL (must prefix with /api)
      if (!json.model_url) throw new Error('no model_url in response');
      modelUrl = `http://${HOST}:5000/api${json.model_url}`;

      // collect all export formats
      if (json.formats) {
        Object.entries(json.formats).forEach(([fmt, rel]) => {
          exportFormats[fmt] = `http://${HOST}:5000/api${rel}`;
        });
      } else {
        const ext = json.model_url.split('.').pop();
        exportFormats[ext] = modelUrl;
      }

      // ensure at least obj is defined
      if (!exportFormats.obj) exportFormats.obj = modelUrl;
      if (!exportFormats.stl) exportFormats.stl = null;

      currentModelData = { modelUrl, exportFormats };
      console.log('Available export formats:', exportFormats);

    } catch(err) {
      console.error('Conversion failed:', err);
      alert(`Error: ${err.message}`);
      tabs[0].click();
      finishProgress();
      return;
    }

    finishProgress();

    // after a brief pause, init viewer
    setTimeout(() => {
      tabs[2].click();
      initializeViewer();
    }, 500);
  });

  //
  // 4) INITIALIZE 3D VIEWER
  //
  async function initializeViewer() {
    if (!currentModelData) {
      console.error('No model data');
      return;
    }
    try {
      console.log('Initializing 3D viewer...');
      await window.ThreeJSViewer.loadModel(currentModelData.modelUrl);
      console.log('3D viewer loaded');
    } catch(err) {
      console.error('Viewer init failed:', err);
      alert('3D viewer failed — please try export instead.');
    }
  }

  //
  // 5) VIEW SECTION BUTTONS
  //
  document.getElementById('refine-btn').onclick = () => {
    alert('Mesh refinement coming soon! 🔧');
  };
  document.getElementById('export-btn').onclick = () => {
    if (!currentModelData) return alert('No model to export');
    tabs[3].click();
    setupExportSection();
  };

  //
  // 6) EXPORT SECTION SETUP
  //
  function setupExportSection() {
    const container = document.querySelector('.export-options');
    container.innerHTML = '';

    const formats = [
      { ext:'obj', name:'OBJ', icon:'fas fa-cube', desc:'Widely supported', available:!!currentModelData.exportFormats.obj },
      { ext:'stl', name:'STL', icon:'fas fa-print', desc:'3D printing', available:!!currentModelData.exportFormats.stl }
    ];

    formats.forEach(f => {
      const card = document.createElement('div');
      card.className = `export-card ${f.available?'available':'unavailable'}`;
      card.innerHTML = `
        <div class="export-card-header">
          <i class="${f.icon}"></i>
          <h3>${f.name}</h3>
          <span class="status-badge ${f.available?'available':'unavailable'}">
            ${f.available?'Available':'Not Available'}
          </span>
        </div>
        <div class="export-card-body">
          <p>${f.desc}</p>
          <button class="btn ${f.available?'btn-primary':'btn-disabled'}"
                  data-format="${f.ext}"
                  ${f.available?'':'disabled'}>
            <i class="fas fa-download"></i>
            Download ${f.name}
          </button>
        </div>`;
      container.appendChild(card);
    });

    container.querySelectorAll('button[data-format]').forEach(btn => {
      btn.addEventListener('click', () => downloadModel(btn.dataset.format));
    });
  }

  //
  // 7) DOWNLOAD LOGIC
  //
  async function downloadModel(fmt) {
    const url = currentModelData.exportFormats[fmt];
    if (!url) return alert(`.${fmt} not available`);
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `model.${fmt}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch(e) {
      console.error('Download error', e);
      // fallback direct
      window.open(url, '_blank');
    }
  }

  // Back/new‑project buttons
  document.getElementById('back-to-view-btn').onclick = () => tabs[2].click();
  document.getElementById('new-project-btn').onclick = () => {
    if (!confirm('Start new project?')) return;
    files = []; currentModelData = null;
    refreshList(); tabs[0].click();
    document.getElementById('model-viewer').innerHTML = `
      <div class="viewer-empty-state">
        <i class="fas fa-cube"></i>
        <p>3D model will appear here</p>
      </div>`;
    document.querySelector('.export-options').innerHTML = '';
    document.querySelectorAll('.progress-fill, .progress-percent, .progress-text').forEach(el => {
      el.style.width = '0%'; if(el.textContent) el.textContent = '';
    });
  };

  //
  // 8) PROGRESS ANIMATION
  //
  function startProgress() {
    const txt = document.querySelector('.progress-text');
    const pct = document.querySelector('.progress-percent');
    const bar = document.querySelector('.progress-fill');
    let p = 0, iv = setInterval(()=>{
      p = Math.min(95, p + Math.random()*10);
      bar.style.width = `${p}%`;
      pct.textContent = `${Math.floor(p)}%`;
      txt.textContent = p<30?'Analyzing…':p<60?'Meshing…':'Finalizing…';
      document.querySelector('.progress-container').dataset.iv = iv;
    },300);
  }
  function finishProgress() {
    const iv = +document.querySelector('.progress-container').dataset.iv;
    if(iv) clearInterval(iv);
    document.querySelector('.progress-fill').style.width='100%';
    document.querySelector('.progress-percent').textContent='100%';
    document.querySelector('.progress-text').textContent='Done!';
    document.querySelectorAll('.status-badge').forEach(b=>b.classList.add('complete'));
  }

  console.log('main.js initialization complete');
});
