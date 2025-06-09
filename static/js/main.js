// static/js/main.js
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded at:', new Date().toISOString());

  const API_BASE_URL = ''; // relative API paths

  //
  // NAVIGATION
  //
  const navLinks = document.querySelectorAll('.app-nav a');
  const sections = document.querySelectorAll('.app-section');
  navLinks.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const target = link.getAttribute('href').slice(1);
      navLinks.forEach(n => n.parentElement.classList.remove('active'));
      link.parentElement.classList.add('active');
      sections.forEach(s => s.classList.toggle('active', s.id === target));
    });
  });

  //
  // FILE UPLOAD UI
  //
  const dropZone  = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const browseBtn = document.getElementById('browse-btn');
  const fileList  = document.getElementById('file-list');
  const uploadBtn = document.getElementById('upload-btn');
  const clearBtn  = document.getElementById('clear-btn');
  let files = [];

  ['dragenter','dragover','dragleave','drop'].forEach(evt => {
    dropZone.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); });
  });
  ['dragenter','dragover'].forEach(evt => {
    dropZone.addEventListener(evt, () => dropZone.classList.add('drag-over'));
  });
  ['dragleave','drop'].forEach(evt => {
    dropZone.addEventListener(evt, () => dropZone.classList.remove('drag-over'));
  });
  dropZone.addEventListener('drop', e => handleFiles(e.dataTransfer.files));
  browseBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => handleFiles(fileInput.files));
  clearBtn.addEventListener('click', () => {
    files = [];
    updateFileList();
    updateUploadButton();
  });

  function handleFiles(newFiles) {
    files = [...files, ...newFiles];
    updateFileList();
    updateUploadButton();
  }

  function updateFileList() {
    if (!files.length) {
      fileList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-images"></i><p>No files selected</p>
        </div>`;
      return;
    }
    fileList.innerHTML = '';
    files.forEach((f,i) => {
      const item = document.createElement('div');
      item.className = 'file-item';
      item.innerHTML = `
        <i class="fas fa-file-image file-icon"></i>
        <div class="file-info">
          <div class="file-name">${f.name}</div>
          <div class="file-size">${formatFileSize(f.size)}</div>
        </div>
        <i class="fas fa-times file-remove" data-index="${i}"></i>`;
      fileList.appendChild(item);
    });
    document.querySelectorAll('.file-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        files.splice(+btn.dataset.index, 1);
        updateFileList();
        updateUploadButton();
      });
    });
  }

  function formatFileSize(b) {
    if (!b) return '0 Bytes';
    const k=1024, sizes=['Bytes','KB','MB','GB'];
    const i = Math.floor(Math.log(b)/Math.log(k));
    return `${(b/Math.pow(k,i)).toFixed(2)} ${sizes[i]}`;
  }

  function updateUploadButton() {
    uploadBtn.disabled = !files.length;
  }

  //
  // UPLOAD & CONVERT
  //
  uploadBtn.addEventListener('click', async () => {
    if (!files.length) return;
    document.querySelector('.app-nav li:nth-child(2) a').click();

    const form = new FormData();
    files.forEach(f => form.append('images', f));

    try {
      startProcessingAnimation();
      console.log('Posting to /api/convert…');
      const res = await fetch(`${API_BASE_URL}/api/convert`, {
        method: 'POST',
        body: form
      });
      if (!res.ok) {
        const err = await res.json().catch(()=>({}));
        throw new Error(err.error||`Status ${res.status}`);
      }
      const data = await res.json();
      console.log('Got:', data);
      if (!data.model_url) throw new Error('No model_url returned');

      const viewer = await loadThreeJSViewer();
      viewer.loadModel(data.model_url);

      setTimeout(() => {
        document.querySelector('.app-nav li:nth-child(3) a').click();
      }, 500);

      setupExportButtons({
        obj: data.model_url.replace('.glb','.obj')
      });

    } catch (e) {
      console.error(e);
      alert(`Upload failed: ${e.message}`);
      document.querySelector('.app-nav li:nth-child(1) a').click();
      completeProcessingAnimation();
    }
  });

  //
  // PROGRESS + EXPORT HELPERS
  //
  function startProcessingAnimation() {
    const progText = document.querySelector('.progress-text');
    const progPct  = document.querySelector('.progress-percent');
    const progBar  = document.querySelector('.progress-fill');
    let p = 0;
    const iv = setInterval(() => {
      p = Math.min(100, p + Math.random()*15);
      progBar.style.width = `${p}%`;
      progPct.textContent = `${Math.floor(p)}%`;
      if      (p<30) progText.textContent = 'Analyzing images…';
      else if (p<60) progText.textContent = 'Generating 3D point cloud…';
      else if (p<90) progText.textContent = 'Creating surface mesh…';
      else           progText.textContent = 'Finalizing model…';
      if (p===100) clearInterval(iv);
      document.querySelector('.progress-container').dataset.interval = iv;
    }, 300);
  }

  function completeProcessingAnimation() {
    const progText = document.querySelector('.progress-text');
    const progPct  = document.querySelector('.progress-percent');
    const progBar  = document.querySelector('.progress-fill');
    const iv       = document.querySelector('.progress-container').dataset.interval;
    if (iv) clearInterval(+iv);
    progBar.style.width = '100%';
    progPct.textContent = '100%';
    progText.textContent = 'Processing complete!';
    document.querySelectorAll('.status-badge')
      .forEach(b => b.classList.add('complete'));
  }

  function setupExportButtons(links) {
    document.querySelectorAll('.export-card').forEach(card => {
      const fmt = card.dataset.format;
      const btn = card.querySelector('.btn-export');
      btn.addEventListener('click', () => {
        if (links[fmt]) window.location.href = `${API_BASE_URL}${links[fmt]}`;
        else alert(`No ${fmt} available`);
      });
    });
    document.getElementById('back-to-view-btn')
      .addEventListener('click', () =>
        document.querySelector('.app-nav li:nth-child(3) a').click()
      );
    document.getElementById('new-project-btn')
      .addEventListener('click', () => {
        if (confirm('Start new project?')) {
          files = [];
          updateFileList();
          updateUploadButton();
          document.querySelector('.app-nav li:nth-child(1) a').click();
          document.getElementById('model-viewer').innerHTML = `
            <div class="viewer-empty-state">
              <i class="fas fa-cube"></i>
              <p>3D model will appear here</p>
            </div>`;
        }
      });
  }

  async function loadThreeJSViewer() {
    return await import('/static/js/threejs-viewer.js');
  }

  console.log('main.js setup complete');
});
