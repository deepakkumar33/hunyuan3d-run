// static/js/main.js
document.addEventListener('DOMContentLoaded', () => {
  console.log('main.js loaded at', new Date().toISOString());

  const API = ''; // use relative

  // NAVIGATION
  const links   = document.querySelectorAll('.app-nav a');
  const sections = document.querySelectorAll('.app-section');
  links.forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    const t = a.getAttribute('href').slice(1);
    links.forEach(n => n.parentElement.classList.remove('active'));
    a.parentElement.classList.add('active');
    sections.forEach(s => s.classList.toggle('active', s.id === t));
  }));

  // UPLOAD UI
  const dropZone = document.getElementById('drop-zone');
  const fi       = document.getElementById('file-input');
  const browse   = document.getElementById('browse-btn');
  const list     = document.getElementById('file-list');
  const upload   = document.getElementById('upload-btn');
  const clear    = document.getElementById('clear-btn');
  let files = [];

  ['dragenter','dragover','dragleave','drop'].forEach(e =>
    dropZone.addEventListener(e, ev => { ev.preventDefault(); ev.stopPropagation(); })
  );
  ['dragenter','dragover'].forEach(e =>
    dropZone.addEventListener(e, ()=> dropZone.classList.add('drag-over'))
  );
  ['dragleave','drop'].forEach(e =>
    dropZone.addEventListener(e, ()=> dropZone.classList.remove('drag-over'))
  );
  dropZone.addEventListener('drop', ev => handleFiles(ev.dataTransfer.files));
  browse.addEventListener('click', ()=> fi.click());
  fi.addEventListener('change', ()=> handleFiles(fi.files));
  clear.addEventListener('click', ()=>{
    files = []; updateList(); updateUpload();
  });

  function handleFiles(f) {
    files = [...files, ...f];
    updateList();
    updateUpload();
  }

  function updateList() {
    if (!files.length) {
      list.innerHTML = `<div class="empty-state"><i class="fas fa-images"></i><p>No files selected</p></div>`;
      return;
    }
    list.innerHTML = '';
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
      list.appendChild(div);
    });
    document.querySelectorAll('.file-remove').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        files.splice(+btn.dataset.i,1);
        updateList(); updateUpload();
      });
    });
  }

  function updateUpload() {
    upload.disabled = files.length===0;
  }

  // UPLOAD & CONVERT
  upload.addEventListener('click', async ()=>{
    if (!files.length) return;
    links[1].click(); // go to process

    const form = new FormData();
    files.forEach(f=> form.append('images', f));

    try {
      startAnimation();
      console.log('POST /api/convert …');
      const res = await fetch(`${API}/api/convert`, { method:'POST', body:form });
      if (!res.ok) {
        const err = await res.json().catch(()=>({}));
        throw new Error(err.error||`Status ${res.status}`);
      }
      const json = await res.json();
      if (!json.model_url) throw new Error('no model_url');
      const viewer = await loadViewer();
      viewer.loadModel(json.model_url);
      setTimeout(()=> links[2].click(), 500);
      setupExport({ obj:json.model_url.replace('.glb','.obj') });
    }
    catch(e){
      console.error(e);
      alert(`Upload failed: ${e.message}`);
      links[0].click();
      finishAnimation();
    }
  });

  // SIMPLE PROGRESS ANIMATION
  function startAnimation(){
    const txt = document.querySelector('.progress-text');
    const pct = document.querySelector('.progress-percent');
    const bar = document.querySelector('.progress-fill');
    let p=0;
    const iv = setInterval(()=>{
      p = Math.min(100, p + Math.random()*15);
      bar.style.width = p+'%';
      pct.textContent = Math.floor(p)+'%';
      txt.textContent = p<30 ? 'Analyzing…' : p<60 ? 'Building cloud…' : p<90 ? 'Meshing…' : 'Finalizing…';
      if (p>=100) clearInterval(iv);
      document.querySelector('.progress-container').dataset.iv = iv;
    },300);
  }
  function finishAnimation(){
    const txt = document.querySelector('.progress-text');
    const pct = document.querySelector('.progress-percent');
    const bar = document.querySelector('.progress-fill');
    const iv  = document.querySelector('.progress-container').dataset.iv;
    if (iv) clearInterval(+iv);
    bar.style.width='100%';
    pct.textContent='100%';
    txt.textContent='Done!';
    document.querySelectorAll('.status-badge').forEach(b=>b.classList.add('complete'));
  }

  function setupExport(links){
    document.querySelectorAll('.export-card').forEach(card=>{
      const fmt = card.dataset.format;
      card.querySelector('.btn-export').addEventListener('click', ()=>{
        if (links[fmt]) window.location.href=links[fmt];
        else alert(`No ${fmt}`);
      });
    });
    document.getElementById('back-to-view-btn')
      .addEventListener('click', ()=> links[2].click());
    document.getElementById('new-project-btn')
      .addEventListener('click', ()=>{
        if(confirm('New project?')){
          files=[]; updateList(); updateUpload();
          links[0].click();
          document.getElementById('model-viewer').innerHTML = `
            <div class="viewer-empty-state"><i class="fas fa-cube"></i><p>3D model will appear here</p></div>`;
        }
      });
  }

  async function loadViewer(){
    return await import('/static/js/threejs-viewer.js');
  }

  console.log('main.js ready');
});
