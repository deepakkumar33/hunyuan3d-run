// static/js/main.js
document.addEventListener('DOMContentLoaded', () => {
  console.log('main.js loaded', new Date().toISOString());

  // Always hit port 5000 where Flask is listening
  const HOST = window.location.hostname;
  const CONVERT_API = `http://${HOST}:5000/api/convert`;
  const STATUS_API_BASE = `http://${HOST}:5000/api/status`;

  // Global variables for model data and polling
  let currentModelData = null;
  let currentJobId = null;
  let pollingInterval = null;

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
  // 3) UPLOAD & PROCESS WITH POLLING
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
    
    // Reset any previous job state
    stopPolling();
    currentJobId = null;
    currentModelData = null;
    clearErrorMessage();
    
    // Start conversion process
    await startConversion(form);
  });

  /**
   * Start the conversion process by submitting to /api/convert
   */
  async function startConversion(formData) {
    updateProgress(0, 'Uploading images...', 'uploading');
    
    try {
      console.log('Sending request to:', CONVERT_API);
      
      const res = await fetch(CONVERT_API, { 
        method: 'POST', 
        body: formData,
        signal: AbortSignal.timeout(30000) // 30 second timeout for upload
      });
      
      console.log('Response status:', res.status);
      console.log('Response headers:', Object.fromEntries(res.headers.entries()));
      
      // Handle different success responses
      if (res.status === 202) {
        // Expected: 202 Accepted with job info
        const json = await res.json();
        console.log('Conversion started:', json);
        
        // Extract job ID and status URL
        currentJobId = json.job_id;
        let statusUrl = json.status_url;
        
        if (!currentJobId) {
          throw new Error('No job_id in 202 response');
        }
        
        // Build status URL if not provided
        if (!statusUrl) {
          statusUrl = `/api/status/${currentJobId}`;
        }
        
        // Start polling for status
        startPolling(statusUrl);
        
      } else if (res.status === 201 || res.status === 200) {
        // Fallback: immediate completion (legacy behavior)
        const json = await res.json();
        console.log('Immediate completion:', json);
        
        if (json.model_url) {
          handleConversionComplete(json);
        } else {
          throw new Error('No model_url in immediate response');
        }
        
      } else if (res.status === 302 || res.status === 303) {
        // Redirect to status URL
        const location = res.headers.get('Location');
        if (location && location.includes('/api/status/')) {
          currentJobId = location.split('/').pop();
          startPolling(location);
        } else {
          throw new Error('Invalid redirect location');
        }
        
      } else {
        // Error response
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

    } catch(err) {
      console.error('Conversion start failed:', err);
      
      let errorMsg = 'Failed to start conversion';
      if (err.name === 'AbortError') {
        errorMsg = 'Upload timed out. Please try again.';
      } else if (err.message) {
        errorMsg = err.message;
      }
      
      showErrorMessage(`Error: ${errorMsg}`);
      showToast(`Error: ${errorMsg}`, 'error');
      updateProgress(0, 'Failed', 'error');
      tabs[0].click(); // Go back to upload tab
    }
  }

  /**
   * Start polling the status endpoint for job updates
   */
  function startPolling(statusUrl) {
    console.log('Starting polling for:', statusUrl);
    updateProgress(5, 'Processing started...', 'running');
    
    // Ensure we have a full URL
    const fullStatusUrl = statusUrl.startsWith('http') ? statusUrl : `http://${HOST}:5000${statusUrl}`;
    
    // Poll every 2 seconds
    pollingInterval = setInterval(async () => {
      await pollStatus(fullStatusUrl);
    }, 2000);
    
    // Also poll immediately
    pollStatus(fullStatusUrl);
  }

  /**
   * Poll the status endpoint once
   */
  async function pollStatus(statusUrl) {
    try {
      console.log('Polling status:', statusUrl);
      
      const res = await fetch(statusUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(30000) // Increased to 30 second timeout for status check
      });
      
      if (!res.ok) {
        throw new Error(`Status check failed: ${res.status} ${res.statusText}`);
      }
      
      const status = await res.json();
      console.log('Status update:', status);
      
      handleStatusUpdate(status);
      
    } catch (err) {
      console.error('Status polling error:', err);
      
      // Don't stop polling for network errors, just log them
      if (err.name !== 'AbortError') {
        console.warn('Continuing polling despite error:', err.message);
      } else {
        console.warn('Status polling timed out, will retry on next interval');
      }
    }
  }

  /**
   * Handle a status update from the polling endpoint
   */
  function handleStatusUpdate(status) {
    const { status: jobStatus, progress, message, model_url } = status;
    
    // Normalize progress value (handle both 0-1 and 0-100 ranges)
    let normalizedProgress = progress || 0;
    if (normalizedProgress > 1) {
      // Already in 0-100 range
      normalizedProgress = Math.min(100, normalizedProgress);
    } else {
      // Convert 0-1 to 0-100 range
      normalizedProgress = normalizedProgress * 100;
    }
    
    switch (jobStatus) {
      case 'pending':
        updateProgress(
          Math.max(5, normalizedProgress), 
          message || 'Waiting in queue...', 
          'pending'
        );
        break;
        
      case 'running':
        updateProgress(
          Math.max(10, Math.min(95, normalizedProgress)), 
          message || 'Processing with Hunyuan3D...', 
          'running'
        );
        break;
        
      case 'done':
      case 'finished': // Handle both 'done' and 'finished' as completion states
        stopPolling();
        console.log('🏁 Job completed, stopping status polling');
        updateProgress(100, 'Conversion complete! Preparing to load model...', 'done');
        
        if (model_url) {
          handleConversionComplete({ model_url });
        } else {
          showErrorMessage('Conversion completed but no model URL provided');
          updateProgress(100, 'Error: No model generated', 'error');
        }
        break;
        
      case 'error':
      case 'failed': // Handle both 'error' and 'failed' as error states
        stopPolling();
        const errorMsg = message || 'Conversion failed';
        showErrorMessage(`Conversion error: ${errorMsg}`);
        showToast(`Conversion failed: ${errorMsg}`, 'error');
        updateProgress(0, 'Failed', 'error');
        tabs[0].click(); // Go back to upload tab
        break;
        
      default:
        console.warn('Unknown job status:', jobStatus);
        // For unknown statuses, assume it's still running
        updateProgress(
          Math.max(10, Math.min(95, normalizedProgress)), 
          message || `Status: ${jobStatus}`, 
          'running'
        );
    }
  }

  /**
   * Handle successful conversion completion
   */
  async function handleConversionComplete(result) {
    console.log('Conversion completed:', result);
    
    // Build absolute model URL
    let modelUrl;
    if (result.model_url.startsWith('http')) {
      // Already absolute URL
      modelUrl = result.model_url;
    } else {
      // Relative URL, make it absolute
      modelUrl = `http://${HOST}:5000${result.model_url}`;
    }
    
    console.log('Absolute model URL:', modelUrl);

    // Get available export formats
    let exportFormats = {};
    if (result.formats) {
      // Convert relative URLs to full API URLs
      Object.keys(result.formats).forEach(format => {
        const formatUrl = result.formats[format];
        exportFormats[format] = formatUrl.startsWith('http') ? formatUrl : `http://${HOST}:5000${formatUrl}`;
      });
      console.log('Available formats from API:', exportFormats);
    } else {
      // Fallback: derive format from primary model URL
      const extension = result.model_url.split('.').pop().toLowerCase();
      exportFormats[extension] = modelUrl;
      console.log('Fallback format detection:', extension);
    }

    // Ensure common formats are available
    if (!exportFormats.obj && !exportFormats.glb && !exportFormats.gltf) {
      console.warn('No common 3D formats found, using primary model URL');
      const extension = result.model_url.split('.').pop().toLowerCase();
      exportFormats[extension] = modelUrl;
    }

    // Store model data globally
    currentModelData = {
      modelUrl: modelUrl,
      exportFormats: exportFormats,
      originalResponse: result,
      jobId: currentJobId
    };

    console.log('Model data stored:', currentModelData);
    
    // Wait a moment, then switch to View tab and load with retry logic
    setTimeout(() => {
      tabs[2].click();
      loadModelWithRetry(modelUrl);
    }, 1000);
  }

  /**
   * Handle successful conversion completion
   */
  async function handleConversionComplete(result) {
    console.log('Conversion completed:', result);
    
    // Build absolute model URL
    let modelUrl;
    if (result.model_url.startsWith('http')) {
      modelUrl = result.model_url;
    } else {
      modelUrl = `http://${HOST}:5000${result.model_url}`;
    }
    
    console.log('Absolute model URL:', modelUrl);

    // Get available export formats
    let exportFormats = {};
    if (result.formats) {
      Object.keys(result.formats).forEach(format => {
        const formatUrl = result.formats[format];
        exportFormats[format] = formatUrl.startsWith('http') ? formatUrl : `http://${HOST}:5000${formatUrl}`;
      });
      console.log('Available formats from API:', exportFormats);
    } else {
      const extension = result.model_url.split('.').pop().toLowerCase();
      exportFormats[extension] = modelUrl;
      console.log('Fallback format detection:', extension);
    }

    if (!exportFormats.obj && !exportFormats.glb && !exportFormats.gltf) {
      console.warn('No common 3D formats found, using primary model URL');
      const extension = result.model_url.split('.').pop().toLowerCase();
      exportFormats[extension] = modelUrl;
    }

    // Store model data globally
    currentModelData = {
      modelUrl: modelUrl,
      exportFormats: exportFormats,
      originalResponse: result,
      jobId: currentJobId
    };

    console.log('Model data stored:', currentModelData);
    
    // Switch to View tab and load model - no delays, just do it
    tabs[2].click();
    
    // Simple load with auto-retry on failure
    try {
      await loadModelIntoViewer(modelUrl);
      console.log('✅ Model loaded successfully');
      updateProgress(100, 'Model loaded successfully!', 'done');
      showToast('3D model loaded successfully!', 'success');
    } catch (err) {
      console.log('❌ First load failed, trying once more in 2 seconds...');
      setTimeout(async () => {
        try {
          await loadModelIntoViewer(modelUrl);
          console.log('✅ Model loaded on retry');
          updateProgress(100, 'Model loaded successfully!', 'done');
          showToast('3D model loaded successfully!', 'success');
        } catch (retryErr) {
          console.error('❌ Retry also failed:', retryErr);
          showErrorMessage(`Model loading failed: ${retryErr.message}`);
          showSimpleRetryViewer(modelUrl);
        }
      }, 2000);
    }
  }

  /**
   * Load the model into the Three.js viewer
   */
  async function loadModelIntoViewer(modelUrl) {
    console.log('🎮 Loading model into viewer:', modelUrl);
    
    const modelViewer = document.getElementById('model-viewer');
    if (!modelViewer) {
      throw new Error('Model viewer element not found');
    }

    // Show loading state
    modelViewer.innerHTML = `
      <div class="viewer-loading">
        <i class="fas fa-spinner fa-spin"></i>
        <p>Loading 3D model...</p>
        <p class="viewer-info">This may take up to 10 minutes for large files...</p>
      </div>
    `;

    // Try ThreeJSViewer with longer timeout
    if (window.ThreeJSViewer && typeof window.ThreeJSViewer.loadModel === 'function') {
      console.log('📞 Using ThreeJSViewer.loadModel');
      
      // Set a longer timeout for the viewer
      const originalTimeout = window.ThreeJSViewer.timeout || 60000;
      window.ThreeJSViewer.timeout = 600000; // 10 minutes
      
      try {
        await window.ThreeJSViewer.loadModel(modelUrl);
        console.log('✅ Model loaded successfully via ThreeJSViewer');
        return;
      } finally {
        // Restore original timeout
        window.ThreeJSViewer.timeout = originalTimeout;
      }
    }
    
    // Try initializeViewer
    if (window.initializeViewer && typeof window.initializeViewer === 'function') {
      console.log('📞 Calling initializeViewer function');
      await window.initializeViewer(modelUrl);
      console.log('✅ Model loaded successfully via initializeViewer');
      return;
    }
    
    // If neither method is available
    console.warn('⚠️ No 3D viewer functions available');
    showFallbackViewer('3D viewer functions not available');
  }

  /**
   * Show simple retry viewer with viewer-only reload
   */
  function showSimpleRetryViewer(modelUrl) {
    const modelViewer = document.getElementById('model-viewer');
    if (!modelViewer) return;
    
    modelViewer.innerHTML = `
      <div class="viewer-error">
        <i class="fas fa-exclamation-triangle"></i>
        <p>3D model loading timed out</p>
        <p class="viewer-info">The model was generated successfully but took too long to load in the viewer.</p>
        <div style="margin-top: 1rem;">
          <button class="btn btn-primary" onclick="window.reloadViewerOnly('${modelUrl}')" style="margin-right: 0.5rem;">
            <i class="fas fa-refresh"></i> Reload Viewer Only
          </button>
          <button class="btn btn-primary" onclick="window.simpleRetry('${modelUrl}')" style="margin-right: 0.5rem;">
            <i class="fas fa-redo"></i> Try Again
          </button>
          <button onclick="document.querySelector('[href=\\'#export-section\\']').click()" class="btn btn-secondary">
            <i class="fas fa-download"></i> Go to Export
          </button>
        </div>
        <p class="viewer-info" style="margin-top: 0.5rem; font-size: 0.8rem;">
          "Reload Viewer Only" resets just the 3D viewer without losing your progress.
        </p>
      </div>
    `;
  }

  // Enhanced retry functions
  window.simpleRetry = async function(modelUrl) {
    console.log('🔄 Simple retry requested');
    try {
      await loadModelIntoViewer(modelUrl);
      updateProgress(100, 'Model loaded successfully!', 'done');
      showToast('3D model loaded successfully!', 'success');
    } catch (err) {
      console.error('❌ Retry failed:', err);
      showToast('Loading still failed - try "Reload Viewer Only"', 'error');
    }
  };

  // New function: Reload only the 3D viewer without losing progress
  window.reloadViewerOnly = async function(modelUrl) {
    console.log('🔄 Reloading viewer only (not full page)');
    
    const modelViewer = document.getElementById('model-viewer');
    if (!modelViewer) {
      showToast('Model viewer not found', 'error');
      return;
    }
    
    try {
      // Show reloading state
      modelViewer.innerHTML = `
        <div class="viewer-loading">
          <i class="fas fa-sync-alt fa-spin"></i>
          <p>Reloading 3D viewer...</p>
          <p class="viewer-info">Resetting viewer without losing your progress</p>
        </div>
      `;
      
      // Clear any existing Three.js state
      if (window.ThreeJSViewer) {
        // Reset Three.js viewer variables
        if (window.ThreeJSViewer.scene) {
          // Clear the scene
          while(window.ThreeJSViewer.scene.children.length > 0) {
            window.ThreeJSViewer.scene.remove(window.ThreeJSViewer.scene.children[0]);
          }
        }
        
        // Reinitialize the entire viewer
        console.log('🔄 Reinitializing Three.js viewer...');
        await window.ThreeJSViewer.initThreeJSViewer();
        
        // Wait a moment for initialization
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Load the model
        console.log('🎮 Loading model into fresh viewer...');
        await window.ThreeJSViewer.loadModel(modelUrl);
        
        updateProgress(100, 'Model loaded successfully!', 'done');
        showToast('3D viewer reloaded successfully!', 'success');
        
      } else {
        throw new Error('ThreeJSViewer not available');
      }
      
    } catch (err) {
      console.error('❌ Viewer reload failed:', err);
      showToast('Viewer reload failed - model files are still available for export', 'error');
      showSimpleRetryViewer(modelUrl);
    }
  };

  /**
   * Stop polling
   */
  function stopPolling() {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
      console.log('Polling stopped');
    }
  }

  //
  // 4) PROGRESS MANAGEMENT
  //
  function updateProgress(percent, text, status = 'running') {
    // Update progress bar
    const progressFill = document.querySelector('.progress-fill');
    const progressPercent = document.querySelector('.progress-percent');
    const progressText = document.querySelector('.progress-text');
    
    if (progressFill) {
      progressFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    }
    
    if (progressPercent) {
      progressPercent.textContent = `${Math.floor(percent)}%`;
    }
    
    if (progressText) {
      progressText.textContent = text;
    }
    
    // Update status badges based on progress
    const statusBadges = document.querySelectorAll('.status-badge');
    statusBadges.forEach(badge => {
      if (status === 'done') {
        badge.classList.add('complete');
      } else if (status === 'error') {
        badge.classList.remove('complete');
        badge.classList.add('error');
      } else {
        badge.classList.remove('complete', 'error');
      }
    });
    
    console.log(`Progress: ${percent}% - ${text} (${status})`);
  }

  function showErrorMessage(message) {
    const errorElement = document.getElementById('error-message');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = 'block';
    }
  }

  function clearErrorMessage() {
    const errorElement = document.getElementById('error-message');
    if (errorElement) {
      errorElement.style.display = 'none';
      errorElement.textContent = '';
    }
  }

  //
  // 5) LEGACY VIEWER INITIALIZATION (keeping for backward compatibility)
  //
  async function initializeViewer() {
    if (!currentModelData) {
      console.error('No model data available');
      showFallbackViewer('No model data available');
      return;
    }

    // Use simple load function
    await loadModelIntoViewer(currentModelData.modelUrl);
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
  // 6) VIEW SECTION BUTTONS
  //
  // Refine button (placeholder functionality)
  const refineBtn = document.getElementById('refine-btn');
  if (refineBtn) {
    refineBtn.onclick = () => {
      showToast('Mesh refinement is coming soon! 🔧', 'info');
    };
  }

  // Export button in view section - should navigate to export section
  const exportBtn = document.getElementById('export-btn');
  if (exportBtn) {
    exportBtn.onclick = () => {
      if (!currentModelData) {
        showToast('No model available for export', 'error');
        return;
      }
      
      // Switch to export section
      tabs[3].click();
      setupExportSection();
    };
  }

  //
  // 7) EXPORT SECTION SETUP
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
  // 8) EXPORT SECTION UTILITY BUTTONS
  //
  // Back to view button
  const backToViewBtn = document.getElementById('back-to-view-btn');
  if (backToViewBtn) {
    backToViewBtn.onclick = () => {
      tabs[2].click();
    };
  }

  // New project button
  const newProjectBtn = document.getElementById('new-project-btn');
  if (newProjectBtn) {
    newProjectBtn.onclick = () => {
      if (!confirm('Start new project? This will clear the current model.')) return;
      
      // Stop any active polling
      stopPolling();
      
      // Reset the application state
      files = [];
      currentModelData = null;
      currentJobId = null;
      refreshList();
      tabs[0].click();
      clearErrorMessage();
      
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
      updateProgress(0, 'Ready', 'ready');
      
      showToast('New project started!', 'success');
    };
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
        .status-badge.complete {
          background-color: #d1fae5;
          color: #065f46;
        }
        .status-badge.error {
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
        .viewer-error .btn {
          margin: 0.25rem;
          padding: 0.5rem 1rem;
          font-size: 0.9rem;
        }
        .btn-secondary {
          background-color: #6b7280;
          color: white;
          border: none;
          border-radius: 0.375rem;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        .btn-secondary:hover {
          background-color: #4b5563;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        #error-message {
          display: none;
          background-color: #fee2e2;
          border: 1px solid #fecaca;
          color: #991b1b;
          padding: 0.75rem;
          border-radius: 0.375rem;
          margin: 1rem 0;
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

  // Cleanup polling on page unload
  window.addEventListener('beforeunload', () => {
    stopPolling();
  });

  console.log('main.js initialization complete');
  refreshList(); // Initialize empty state
});
