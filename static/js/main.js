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

      // Get the primary model URL for the 3D viewer
      if (!json.model_url) throw new Error('no model_url in response');
      modelUrl = `/api${json.model_url}`;

      // Get available export formats
      if (json.formats) {
        // Convert relative URLs to full API URLs
        Object.keys(json.formats).forEach(format => {
          exportFormats[format] = `/api${json.formats[format]}`;
        });
      } else {
        // Fallback: only the primary format is available
        const extension = json.model_url.split('.').pop();
        exportFormats[extension] = modelUrl;
      }

      console.log('Available export formats:', exportFormats);

    } catch(err) {
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

    // setup exports with available formats
    setupExport(exportFormats);

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
  function setupExport(availableFormats) {
    console.log('Setting up export with formats:', availableFormats);
    
    document.querySelectorAll('.export-card').forEach(card => {
      const fmt = card.dataset.format;
      const btn = card.querySelector('.btn-export');
      
      if (!btn) {
        console.warn(`No export button found for format: ${fmt}`);
        return;
      }

      // Check if this format is available
      if (availableFormats[fmt]) {
        // Format is available - enable the button
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.textContent = btn.textContent.replace('Coming Soon', `Download ${fmt.toUpperCase()}`);
        
        btn.onclick = () => {
          const url = availableFormats[fmt];
          console.log(`Downloading ${fmt} from:`, url);
          
          try {
            const a = document.createElement('a');
            a.href = url;
            a.download = `model.${fmt}`;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // Show success message
            showToast(`${fmt.toUpperCase()} file download started!`, 'success');
          } catch (error) {
            console.error(`Failed to download ${fmt}:`, error);
            showToast(`Failed to download ${fmt.toUpperCase()} file`, 'error');
          }
        };
      } else {
        // Format is not available - disable the button
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.textContent = 'Not Available';
        btn.onclick = () => {
          showToast(`${fmt.toUpperCase()} format is not available for this model`, 'warning');
        };
      }
    });

    // Setup other buttons
    const backBtn = document.getElementById('back-to-view-btn');
    if (backBtn) {
      backBtn.onclick = () => tabs[2].click();
    }

    const newProjectBtn = document.getElementById('new-project-btn');
    if (newProjectBtn) {
      newProjectBtn.onclick = () => {
        if (!confirm('Start new project? This will clear the current model.')) return;
        
        // Reset the application state
        files = [];
        refreshList();
        tabs[0].click();
        
        // Clear the 3D viewer
        const modelViewer = document.getElementById('model-viewer');
        if (modelViewer) {
          modelViewer.innerHTML = `
            <div class="viewer-empty-state">
              <i class="fas fa-cube"></i>
              <p>3D model will appear here</p>
            </div>`;
        }
        
        // Reset progress
        document.querySelector('.progress-fill').style.width = '0%';
        document.querySelector('.progress-percent').textContent = '0%';
        document.querySelector('.progress-text').textContent = 'Ready';
        document.querySelectorAll('.status-badge').forEach(b => b.classList.remove('complete'));
        
        showToast('New project started!', 'success');
      };
    }
  }

  //
  // 6) UTILITY FUNCTIONS
  //
  function showToast(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
      </div>
    `;
    
    // Add styles if they don't exist
    if (!document.querySelector('#toast-styles')) {
      const style = document.createElement('style');
      style.id = 'toast-styles';
      style.textContent = `
        .toast {
          position: fixed;
          top: 20px;
          right: 20px;
          padding: 12px 16px;
          border-radius: 8px;
          color: white;
          font-weight: 500;
          z-index: 10000;
          animation: slideIn 0.3s ease-out;
          max-width: 300px;
        }
        .toast-success { background-color: #10b981; }
        .toast-error { background-color: #ef4444; }
        .toast-warning { background-color: #f59e0b; }
        .toast-info { background-color: #3b82f6; }
        .toast-content {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
    
    // Add to DOM
    document.body.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  console.log('main.js initialization complete');
});
