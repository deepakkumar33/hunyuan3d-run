// static/js/main.js
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM fully loaded at:', new Date().toISOString());

  // NAVIGATION
  const navLinks = document.querySelectorAll('.app-nav a');
  const sections = document.querySelectorAll('.app-section');
  navLinks.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const targetId = link.getAttribute('href').slice(1);
      navLinks.forEach(l => l.parentElement.classList.remove('active'));
      link.parentElement.classList.add('active');
      sections.forEach(sec => sec.classList.toggle('active', sec.id === targetId));
    });
  });

  // FILE UPLOAD UI
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
  ['dragenter','dragover'].forEach(evt => dropZone.addEventListener(evt, ()=>dropZone.classList.add('drag-over')));
  ['dragleave','drop'].forEach(evt => dropZone.addEventListener(evt, ()=>dropZone.classList.remove('drag-over')));
  dropZone.addEventListener('drop', e => handleFiles(e.dataTransfer.files));
  browseBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => handleFiles(fileInput.files));
  clearBtn.addEventListener('click', ()=>{ files=[]; updateList(); updateUploadBtn(); });

  function handleFiles(list) {
    files = [...files, ...list];
    updateList();
    updateUploadBtn();
  }
  function updateList() {
    if (!files.length) {
      fileList.innerHTML = `<div class="empty-state"><i class="fas fa-images"></i><p>No files selected</p></div>`;
      return;
    }
    fileList.innerHTML = '';
    files.forEach((f,i)=>{
      const div = document.createElement('div');
      div.className = 'file-item';
      div.innerHTML = `
        <i class="fas fa-file-image file-icon"></i>
        <div class="file-info">
          <div class="file-name">${f.name}</div>
          <div class="file-size">${(f.size/1024**2).toFixed(2)} MB</div>
        </div>
        <i class="fas fa-times file-remove" data-i="${i}"></i>`;
      fileList.appendChild(div);
    });
    document.querySelectorAll('.file-remove').forEach(btn=>{
      btn.addEventListener('click',()=>{
        files.splice(+btn.dataset.i,1);
        updateList();
        updateUploadBtn();
      });
    });
  }
  function updateUploadBtn() {
    uploadBtn.disabled = files.length === 0;
  }

  // MISSING ANIMATION HELPERS
  function startProcessingAnimation() {
    const txt = document.querySelector('.progress-text');
    const pct = document.querySelector('.progress-percent');
    const fill = document.querySelector('.progress-fill');
    const badges = document.querySelectorAll('.status-badge');
    let p = 0;
    const iv = setInterval(()=>{
      p = Math.min(100, p + Math.random()*15);
      fill.style.width = p+'%';
      pct.textContent = Math.floor(p)+'%';
      if (p < 30) { txt.textContent = 'Analyzing images…'; }
      else if (p < 60) { txt.textContent = 'Building cloud…'; badges[0].classList.add('complete'); badges[1].classList.add('pending'); }
      else if (p < 90) { txt.textContent = 'Meshing…'; badges[2].classList.add('pending'); }
      else { txt.textContent = 'Finalizing…'; badges[3].classList.add('pending'); }
      if (p === 100) clearInterval(iv);
      document.querySelector('.progress-container').dataset.iv = iv;
    }, 300);
  }
  function completeProcessingAnimation() {
    const txt = document.querySelector('.progress-text');
    const pct = document.querySelector('.progress-percent');
    const fill = document.querySelector('.progress-fill');
    const badges = document.querySelectorAll('.status-badge');
    const iv = document.querySelector('.progress-container').dataset.iv;
    if (iv) clearInterval(+iv);
    fill.style.width = '100%';
    pct.textContent = '100%';
    txt.textContent = 'Done!';
    badges.forEach(b=>b.classList.replace('pending','complete'));
  }

  // UPLOAD & CONVERT
  uploadBtn.addEventListener('click', async ()=>{
    if (!files.length) return;
    // switch to Process tab
    navLinks[1].click();

    const form = new FormData();
    files.forEach(f=> form.append('images', f));

    try {
      startProcessingAnimation();
      console.log('POSTing to /api/convert');
      const res = await fetch(`${window.location.origin}/api/convert`, {
        method:'POST',
        body: form
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const { model_url } = await res.json();
      if (!model_url) throw new Error('no model_url returned');

      // load 3D viewer
      const viewer = await import('/static/js/threejs-viewer.js');
      viewer.loadModel(model_url);

      // go to View tab
      setTimeout(()=> navLinks[2].click(), 500);

      // setup export
      document.querySelectorAll('.export-card').forEach(card=>{
        const fmt = card.dataset.format;
        card.querySelector('.btn-export').onclick = ()=>{
          window.location.href = `${window.location.origin}${model_url.replace('.glb','.'+fmt)}`;
        };
      });
    }
    catch(err){
      console.error(err);
      alert(`Upload failed: ${err.message}`);
      navLinks[0].click();
      completeProcessingAnimation();
    }
  });

  console.log('main.js setup complete');
});
