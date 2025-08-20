// static/js/main.js
document.addEventListener('DOMContentLoaded', () => {
  console.log('main.js loaded', new Date().toISOString());

  // Always hit port 5000 where Flask is listening
  const HOST = window.location.hostname;
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
    // Filter for image files only
    const imageFiles = Array.from(list).filter(file => {
      return file.type.startsWith('image/');
    });
    
    if (imageFiles.length === 0) {
      showToast('Please select image files only', 'warning');
      return;
    }
    
    files = [...files, ...imageFiles];
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
    if (!files.length) {
      showToast('Please select at least one image file', 'warning');
      return;
    }

    // Validate file types and sizes
    const maxSize = 10 * 1024 * 1024; // 10MB
    for (let file of files) {
      if (!file.type.startsWith('image/')) {
        showToast(`${file.name} is not a valid image file`, 'error');
        return;
      }
      if (file.size > maxSize) {
        showToast(`${file.name} is too large (max 10MB)`, 'error');
        return;
      }
    }

    // Switch to "Process" tab
    tabs[1].click();

    // Build form data
    const form = new FormData();
    files.forEach(f => form.append('images', f));

    console.log(`Starting conversion with ${files.length} image(s)`);
    startProgress();
    
    let modelUrl;
    let exportFormats = {};

    try {
      console.log('Sending request to:', CONVERT_API);
      
      const res = await fetch(CONVERT_API, { 
        method: 'POST', 
        body: form,
        // Add timeout handling
        signal: AbortSignal.timeout(300000) // 5 minute timeout
      });
      
      console.log('Response status:', res.status);
      console.log('Response headers:', Object.fromEntries(res.headers.entries()));
      
      if (!res.ok) {
        const ct = res.headers.get('Content-Type') || '';
        let errorMessage;
        
        try {
          if (ct.includes('application/json')) {
            const errorJson = await res.json();
            errorMessage = errorJson.error || errorJson.message || JSON.stringify(errorJson);
            console.error('API Error JSON:', errorJson);
          } else {
            errorMessage = await res.text();
            console.error('API Error Text:', errorMessage);
          }
        } catch (parseError) {
          console.error('Error parsing response:', parseError);
          errorMessage = `HTTP ${res.status}: ${res.statusText}`;
        }
        
        throw new Error(errorMessage);
      }

      const json = await res.json();
      console.log('API Response:', json);

      // Validate response structure
      if (!json.model_url) {
        throw new Error('No model_url in response. Expected format: {"model_url": "/api/output/filename"}');
      }

      // Get the primary model URL for the 3D viewer
      modelUrl = `http://${HOST}:5000${json.model_url}`;
      console.log('Model URL:', modelUrl);

      // Get available export formats
      if (json.formats) {
        // Convert relative URLs to full API URLs
        Object.keys(json.formats).forEach(format => {
          exportFormats[format] = `http://${HOST}:5000${json.formats[format]}`;
        });
        console.log('Available formats from API:', exportFormats);
      } else {
        // Fallback: derive format from primary model URL
        const extension = json.model_url.split('.').pop().toLowerCase();
        exportFormats[extension] = modelUrl;
        console.log('Fallback format detection:', extension);
      }

      // Ensure common formats are available
      if (!exportFormats.obj && !exportFormats.glb && !exportFormats.gltf) {
        console.warn('No common 3D formats found, using primary model URL');
        const extension = json.model_url.split('.').pop().toLowerCase();
        exportFormats[extension] = modelUrl;
      }

      // Store model data globally
      currentModelData = {
        modelUrl: modelUrl,
        exportFormats: exportFormats,
        originalResponse: json
      };

      console.log('Model data stored:', currentModelData);

    } catch(err) {
      console.error('Conversion failed:', err);
      
      let errorMsg = 'Conversion failed';
      if (err.name === 'AbortError') {
        errorMsg = 'Request timed out. The model generation is taking too long.';
      } else if (err.message) {
        errorMsg = err.message;
      }
      
      showToast(`Error: ${errorMsg}`, 'error');
      tabs[0].click(); // Go back to upload tab
      finishProgress();
      return;
    }

    finishProgress();
    
    // Wait a moment, then switch to View tab and initialize viewer
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
      console.error('No model data available');
      showFallbackViewer('No model data available');
      return;
    }

    const modelViewer = document.getElementById('model-viewer');
    if (!modelViewer) {
      console.error('Model viewer element not found');
      return;
    }

    // Show loading state
    modelViewer.innerHTML = `
      <div class="viewer-loading">
        <i class="fas fa-spinner fa-spin"></i>
        <p>Loading 3D model...</p>
        <p class="viewer-info">This may take a moment</p>
      </div>
    `;

    try {
      console.log('Initializing 3D viewer with URL:', currentModelData.modelUrl);
      
      // Check if the model file exists by making a HEAD request
      const checkResponse = await fetch(currentModelData.modelUrl, { method: 'HEAD' });
      if (!checkResponse.ok) {
        throw new Error(`Model file not accessible: ${checkResponse.status} ${checkResponse.statusText}`);
      }
      
      // Use the global ThreeJSViewer object if available
      if (window.ThreeJSViewer && typeof window.ThreeJSViewer.loadModel === 'function') {
        console.log('Using ThreeJSViewer to load model');
        await window.ThreeJSViewer.loadModel(currentModelData.modelUrl);
        console.log('3D viewer loaded successfully');
        showToast('3D model loaded successfully!', 'success');
      } else {
        console.warn('ThreeJSViewer not available, showing fallback');
        showFallbackViewer('3D viewer is not available');
      }
      
    } catch(err) {
      console.error('Viewer initialization failed:', err);
      showFallbackViewer(`Failed to load 3D model: ${err.message}`);
      showToast(`3D viewer error: ${err.message}`, 'error');
    }
  }

  function showFallbackViewer(message = '3D viewer is not available') {
    const modelViewer = document.getElementById('model-viewer');
    if (!modelViewer) return;
    
    modelViewer.innerHTML = `
      <div class="viewer-success">
        <i class="fas fa-cube"></i>
        <p>3D model generated successfully!</p>
        <p class="viewer-info">${message}</p>
        <p class="viewer-info">You can still export your model below.</p>
        <button onclick="document.querySelector('[href=\\'#export-section\\']').click()" class="btn btn-primary">
          <i class="fas fa-download"></i>
          Go to Export
        </button>
      </div>
    `;
  }

  //
  // 5) VIEW SECTION BUTTONS
  //
  // Refine button (placeholder functionality)
  document.getElementById('refine-btn').onclick = () => {
    showToast('Mesh refinement is coming soon! 🔧', 'info');
  };

  // Export button in view section - should navigate to export section
  document.getElementById('export-btn').onclick = () => {
    if (!currentModelData) {
      showToast('No model available for export', 'error');
      return;
    }
    
    // Switch to export section
    tabs[3].click();
    setupExportSection();
  };

  //
  // 6) EXPORT SECTION SETUP
  //
  function setupExportSection() {
    if (!currentModelData) {
      console.error('No model data available for export');
      return;
    }

    const exportOptionsContainer = document.querySelector('.export-options');
    if (!exportOptionsContainer) {
      console.error('Export options container not found');
      return;
    }

    // Clear existing content
    exportOptionsContainer.innerHTML = '';

    // Create export format cards based on available formats
    const availableFormats = Object.keys(currentModelData.exportFormats);
    console.log('Setting up export for formats:', availableFormats);

    const formatConfigs = [
      {
        name: 'OBJ',
        description: 'Standard 3D format, widely supported',
        icon: 'fas fa-cube',
        extension: 'obj',
        priority: 1
      },
      {
        name: 'STL',
        description: 'Perfect for 3D printing',
        icon: 'fas fa-print',
        extension: 'stl',
        priority: 2
      },
      {
        name: 'GLB',
        description: 'Modern format with materials',
        icon: 'fas fa-gem',
        extension: 'glb',
        priority: 3
      },
      {
        name: 'GLTF',
        description: 'WebGL-ready format',
        icon: 'fas fa-code',
        extension: 'gltf',
        priority: 4
      },
      {
        name: 'PLY',
        description: 'Point cloud and mesh format',
        icon: 'fas fa-cloud',
        extension: 'ply',
        priority: 5
      }
    ];

    // Sort by priority and filter by availability
    const formats = formatConfigs
      .map(config => ({
        ...config,
        available: !!currentModelData.exportFormats[config.extension]
      }))
      .sort((a, b) => {
        if (a.available && !b.available) return -1;
        if (!a.available && b.available) return 1;
        return a.priority - b.priority;
      });

    formats.forEach(format => {
      const card = document.createElement('div');
      card.className = `export-card ${format.available ? 'available' : 'unavailable'}`;
      
      card.innerHTML = `
        <div class="export-card-header">
          <i class="${format.icon}"></i>
          <h3>${format.name}</h3>
          ${format.available ? '<span class="status-badge available">Available</span>' : '<span class="status-badge unavailable">Not Available</span>'}
        </div>
        <div class="export-card-body">
          <p>${format.description}</p>
          <div class="export-card-actions">
            <button class="btn ${format.available ? 'btn-primary' : 'btn-disabled'}" 
                    data-format="${format.extension}"
                    ${format.available ? '' : 'disabled'}>
              <i class="fas fa-download"></i>
              Download ${format.name}
            </button>
          </div>
        </div>
      `;

      exportOptionsContainer.appendChild(card);
    });

    // Add event listeners to download buttons
    document.querySelectorAll('.export-card button[data-format]').forEach(button => {
      button.addEventListener('click', (e) => {
        const format = e.target.getAttribute('data-format');
        downloadModel(format);
      });
    });

    // Add styling
    addExportCardStyles();
  }

  // Improved download function with better error handling
  async function downloadModel(format) {
    if (!currentModelData || !currentModelData.exportFormats[format]) {
      showToast(`${format.toUpperCase()} format is not available`, 'error');
      return;
    }

    const url = currentModelData.exportFormats[format];
    const filename = `jewelry_model.${format}`;

    try {
      showToast(`Downloading ${format.toUpperCase()}...`, 'info');
      console.log(`Downloading ${format} from:`, url);
      
      // Use fetch to download the file with timeout
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Check content type
      const contentType = response.headers.get('Content-Type');
      console.log(`Content-Type for ${format}:`, contentType);
      
      // Get the blob data
      const blob = await response.blob();
      console.log(`Downloaded ${format} blob size:`, blob.size, 'bytes');
      
      if (blob.size === 0) {
        throw new Error('Downloaded file is empty');
      }
      
      // Create blob URL
      const blobUrl = window.URL.createObjectURL(blob);
      
      // Create download link
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.style.display = 'none';
      
      // Trigger download
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Clean up blob URL
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
      
      showToast(`${format.toUpperCase()} downloaded successfully!`, 'success');
      
    } catch (error) {
      console.error(`Download failed for ${format}:`, error);
      
      let errorMsg = `Download failed: ${error.message}`;
      if (error.name === 'AbortError') {
        errorMsg = 'Download timed out';
      }
      
      showToast(errorMsg, 'error');
      
      // Fallback: try direct link
      try {
        console.log('Trying fallback direct link...');
        window.open(url, '_blank');
        showToast(`${format.toUpperCase()} opened in new tab`, 'info');
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
    }
  }

  //
  // 7) EXPORT SECTION UTILITY BUTTONS
  //
  // Back to view button
  document.getElementById('back-to-view-btn').onclick = () => {
    tabs[2].click();
  };

  // New project button
  document.getElementById('new-project-btn').onclick = () => {
    if (!confirm('Start new project? This will clear the current model.')) return;
    
    // Reset the application state
    files = [];
    currentModelData = null;
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
    
    // Clear export section
    const exportOptionsContainer = document.querySelector('.export-options');
    if (exportOptionsContainer) {
      exportOptionsContainer.innerHTML = '';
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

  //
  // 8) PROGRESS ANIMATION
  //
  function startProgress() {
    const txt = document.querySelector('.progress-text');
    const pct = document.querySelector('.progress-percent');
    const bar = document.querySelector('.progress-fill');
    let p = 0;
    const iv = setInterval(() => {
      p = Math.min(95, p + Math.random()*8 + 2);
      bar.style.width = p + '%';
      pct.textContent = Math.floor(p) + '%';
      
      if (p < 20) {
        txt.textContent = 'Uploading images...';
      } else if (p < 40) {
        txt.textContent = 'Analyzing images...';
      } else if (p < 60) {
        txt.textContent = 'Processing with Hunyuan3D...';
      } else if (p < 80) {
        txt.textContent = 'Generating 3D mesh...';
      } else {
        txt.textContent = 'Finalizing model...';
      }
      
      document.querySelector('.progress-container').dataset.iv = iv;
    }, 400);
  }

  function finishProgress() {
    const iv = +document.querySelector('.progress-container').dataset.iv;
    if (iv) clearInterval(iv);
    document.querySelector('.progress-fill').style.width = '100%';
    document.querySelector('.progress-percent').textContent = '100%';
    document.querySelector('.progress-text').textContent = 'Complete!';
    document.querySelectorAll('.status-badge').forEach(b => b.classList.add('complete'));
  }

  //
  // 9) UTILITY FUNCTIONS
  //
  function addExportCardStyles() {
    // Add styles for export cards if they don't exist
    if (!document.querySelector('#export-card-styles')) {
      const style = document.createElement('style');
      style.id = 'export-card-styles';
      style.textContent = `
        .export-options {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
          margin: 2rem 0;
        }
        .export-card {
          background: white;
          border-radius: 12px;
          padding: 1.5rem;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          border: 2px solid #e5e7eb;
          transition: all 0.3s ease;
        }
        .export-card.available {
          border-color: #10b981;
        }
        .export-card.unavailable {
          border-color: #ef4444;
          opacity: 0.7;
        }
        .export-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1rem;
        }
        .export-card-header i {
          font-size: 1.5rem;
          color: #6b7280;
        }
        .export-card-header h3 {
          margin: 0;
          font-size: 1.2rem;
          font-weight: 600;
          color: #1f2937;
        }
        .export-card-body p {
          color: #6b7280;
          margin-bottom: 1rem;
          font-size: 0.9rem;
        }
        .status-badge {
          padding: 0.25rem 0.5rem;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 500;
          text-transform: uppercase;
        }
        .status-badge.available {
          background-color: #d1fae5;
          color: #065f46;
        }
        .status-badge.unavailable {
          background-color: #fee2e2;
          color: #991b1b;
        }
        .export-card-actions {
          display: flex;
          gap: 0.5rem;
        }
        .btn-disabled {
          background-color: #e5e7eb !important;
          color: #9ca3af !important;
          cursor: not-allowed !important;
        }
        .btn-disabled:hover {
          background-color: #e5e7eb !important;
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
        .viewer-loading i { 
          color: #3b82f6; 
          animation: spin 1s linear infinite;
        }
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
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
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
  refreshList(); // Initialize empty state
});
