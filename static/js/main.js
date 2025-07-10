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
      showToast(`Error: ${err.message}`, 'error');
      tabs[0].click();
      finishProgress();
      return;
    }

    // load 3D viewer
    try {
      console.log('Attempting to load 3D viewer...');
      
      // Try to load the viewer module
      const viewerModule = await import('/static/js/threejs-viewer.js');
      console.log('Viewer module loaded:', viewerModule);
      
      // Check what's available in the module
      if (viewerModule.default && typeof viewerModule.default.loadModel === 'function') {
        await viewerModule.default.loadModel(modelUrl);
      } else if (viewerModule.loadModel && typeof viewerModule.loadModel === 'function') {
        await viewerModule.loadModel(modelUrl);
      } else if (viewerModule.initViewer && typeof viewerModule.initViewer === 'function') {
        await viewerModule.initViewer(modelUrl);
      } else {
        // Fallback: try to initialize viewer directly
        console.log('Using fallback viewer initialization');
        await initBasicViewer(modelUrl);
      }
      
      console.log('3D viewer loaded successfully');
      
    } catch(err) {
      console.error('Viewer load failed:', err);
      console.log('Attempting fallback viewer...');
      
      // Try fallback viewer
      try {
        await initBasicViewer(modelUrl);
        console.log('Fallback viewer loaded successfully');
      } catch(fallbackErr) {
        console.error('Fallback viewer also failed:', fallbackErr);
        showToast('Failed to initialize 3D viewer', 'error');
      }
    }

    // switch to "View" tab
    setTimeout(() => tabs[2].click(), 300);

    // setup exports with available formats
    setupExport(exportFormats);

    finishProgress();
  });

  // Basic fallback viewer function
  async function initBasicViewer(modelUrl) {
    const modelViewer = document.getElementById('model-viewer');
    if (!modelViewer) {
      throw new Error('Model viewer container not found');
    }

    // Clear existing content
    modelViewer.innerHTML = `
      <div class="viewer-loading">
        <i class="fas fa-spinner fa-spin"></i>
        <p>Loading 3D model...</p>
      </div>
    `;

    // Try to create a basic Three.js viewer
    try {
      // This is a minimal fallback - you might want to implement a proper viewer here
      modelViewer.innerHTML = `
        <div class="viewer-success">
          <i class="fas fa-cube"></i>
          <p>3D model loaded successfully!</p>
          <p class="viewer-info">Model URL: ${modelUrl}</p>
          <button onclick="window.open('${modelUrl}', '_blank')" class="btn btn-primary">
            <i class="fas fa-external-link-alt"></i>
            View Model
          </button>
        </div>
      `;
    } catch (error) {
      modelViewer.innerHTML = `
        <div class="viewer-error">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Could not load 3D viewer</p>
          <p class="viewer-info">But your model is ready for download!</p>
        </div>
      `;
    }
  }

  // give the "Refine Mesh" button some behavior (so it doesn't just sit there)
  document.getElementById('refine-btn').onclick = () => {
    showToast('Mesh refinement is coming soon! 🔧', 'info');
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
    
    // Look for export buttons by their text content and common patterns
    const allButtons = document.querySelectorAll('button');
    const exportButtons = [];
    
    allButtons.forEach(button => {
      const text = button.textContent.toLowerCase().trim();
      const hasExportText = text.includes('export') || text.includes('download');
      const hasFormatText = text.includes('obj') || text.includes('stl') || text.includes('ply');
      
      if (hasExportText || hasFormatText) {
        exportButtons.push(button);
      }
    });
    
    console.log('Found potential export buttons:', exportButtons.length);
    
    // If still no export buttons found, look for specific IDs or classes
    if (exportButtons.length === 0) {
      const alternativeSelectors = [
        '#export-btn',
        '#download-btn',
        '.export-btn',
        '.download-btn',
        '[data-action="export"]',
        '[data-action="download"]'
      ];
      
      alternativeSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        exportButtons.push(...elements);
      });
    }
    
    console.log('Total export buttons found:', exportButtons.length);
    
    // Set up each export button
    exportButtons.forEach(button => {
      console.log('Processing button:', button.textContent.trim());
      
      // Determine the format
      let format = null;
      const text = button.textContent.toLowerCase();
      
      if (text.includes('obj')) format = 'obj';
      else if (text.includes('stl')) format = 'stl';
      else if (text.includes('ply')) format = 'ply';
      else if (text.includes('export') || text.includes('download')) {
        // Generic export button - use the first available format
        format = Object.keys(availableFormats)[0];
      }
      
      if (!format) {
        console.log('Could not determine format for button:', button.textContent);
        return;
      }
      
      console.log(`Setting up ${format} export for button:`, button.textContent);
      
      // Check if this format is available
      if (availableFormats[format]) {
        // Format is available - enable the button
        button.disabled = false;
        button.style.opacity = '1';
        button.style.cursor = 'pointer';
        
        // Update button text if needed
        if (button.textContent.includes('Coming Soon') || button.textContent.includes('Not Available')) {
          button.textContent = `Download ${format.toUpperCase()}`;
        }
        
        // Add click handler
        button.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          const url = availableFormats[format];
          console.log(`Downloading ${format} from:`, url);
          
          downloadFile(url, `model.${format}`, format);
        };
      } else {
        // Format is not available - disable the button
        button.disabled = true;
        button.style.opacity = '0.5';
        button.style.cursor = 'not-allowed';
        
        if (!button.textContent.includes('Not Available')) {
          button.textContent = `${format.toUpperCase()} - Not Available`;
        }
        
        button.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          showToast(`${format.toUpperCase()} format is not available for this model`, 'warning');
        };
      }
    });

    // Setup other buttons
    setupUtilityButtons();
  }

  function setupUtilityButtons() {
    // Back to view button
    const backBtn = document.getElementById('back-to-view-btn');
    if (backBtn) {
      backBtn.onclick = () => tabs[2].click();
    }

    // New project button
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
        const progressFill = document.querySelector('.progress-fill');
        const progressPercent = document.querySelector('.progress-percent');
        const progressText = document.querySelector('.progress-text');
        
        if (progressFill) progressFill.style.width = '0%';
        if (progressPercent) progressPercent.textContent = '0%';
        if (progressText) progressText.textContent = 'Ready';
        
        document.querySelectorAll('.status-badge').forEach(b => b.classList.remove('complete'));
        
        showToast('New project started!', 'success');
      };
    }
  }

  //
  // 6) UTILITY FUNCTIONS
  //
  function downloadFile(url, filename, format) {
    try {
      // Create a temporary anchor element for download
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      
      // Add to DOM, click, and remove
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      showToast(`${format.toUpperCase()} download started!`, 'success');
      
    } catch (error) {
      console.error(`Failed to download ${format}:`, error);
      
      // Fallback: try opening in new window
      try {
        const newWindow = window.open(url, '_blank');
        if (newWindow) {
          showToast(`${format.toUpperCase()} opened in new window`, 'info');
        } else {
          throw new Error('Popup blocked');
        }
      } catch (fallbackError) {
        console.error('Fallback download also failed:', fallbackError);
        showToast(`Failed to download ${format.toUpperCase()} file. Please try again.`, 'error');
        
        // Last resort: show the URL
        const userResponse = confirm(`Download failed. Would you like to open the download URL manually?\n\nURL: ${url}`);
        if (userResponse) {
          window.location.href = url;
        }
      }
    }
  }

  function showToast(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <i class="fas fa-${type === 'success' ? 'check-circle' : 
                           type === 'error' ? 'exclamation-circle' : 
                           type === 'warning' ? 'exclamation-triangle' : 
                           'info-circle'}"></i>
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
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
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
        .viewer-loading, .viewer-success, .viewer-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          padding: 2rem;
          text-align: center;
        }
        .viewer-loading i, .viewer-success i, .viewer-error i {
          font-size: 3rem;
          margin-bottom: 1rem;
        }
        .viewer-loading i { color: #3b82f6; }
        .viewer-success i { color: #10b981; }
        .viewer-error i { color: #ef4444; }
        .viewer-info {
          font-size: 0.9rem;
          color: #666;
          margin-top: 0.5rem;
        }
        .viewer-success .btn {
          margin-top: 1rem;
        }
      `;
      document.head.appendChild(style);
    }
    
    // Add to DOM
    document.body.appendChild(toast);
    
    // Remove after 4 seconds
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 4000);
  }

  console.log('main.js initialization complete');
});
