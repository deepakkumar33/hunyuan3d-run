// static/js/main.js
document.addEventListener('DOMContentLoaded', () => {
  console.log('main.js v2 loaded at', new Date().toISOString());

  const ORIGIN = window.location.origin;   // <-- auto picks http:// or https://
  const API    = `${ORIGIN}/api/convert`;

  // --- Tab navigation (unchanged) ---
  const links    = document.querySelectorAll('.app-nav a');
  const sections = document.querySelectorAll('.app-section');
  links.forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    const tgt = a.getAttribute('href').slice(1);
    links.forEach(x => x.parentElement.classList.remove('active'));
    a.parentElement.classList.add('active');
    sections.forEach(s => s.classList.toggle('active', s.id === tgt));
  }));

  // --- Upload UI (unchanged) ---
  const dropZone = document.getElementById('drop-zone');
  const fileInput= document.getElementById('file-input');
  const browse   = document.getElementById('browse-btn');
  const list     = document.getElementById('file-list');
  const upload   = document.getElementById('upload-btn');
  const clear    = document.getElementById('clear-btn');
  let   files    = [];

  ['dragenter','dragover','dragleave','drop'].forEach(ev =>
    dropZone.addEventListener(ev, e=>{e.preventDefault();e.stopPropagation()})
  );
  ['dragenter','dragover'].forEach(ev =>
    dropZone.addEventListener(ev, ()=> dropZone.classList.add('drag-over'))
  );
  ['dragleave','drop'].forEach(ev =>
    dropZone.addEventListener(ev, ()=> dropZone.classList.remove('drag-over'))
  );
  dropZone.addEventListener('drop', e => handleFiles(e.dataTransfer.files));
  browse  .addEventListener('click', ()=> fileInput.click());
  fileInput.addEventListener('change', ()=> handleFiles(fileInput.files));
  clear   .addEventListener('click', ()=> { files=[]; updateList(); updateUpload(); });

  function handleFiles(f) {
    files = [...files, ...f];
    updateList(); updateUpload();
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
    document.querySelectorAll('.file-remove').forEach(btn=>
      btn.addEventListener('click', ()=> {
        files.splice(+btn.dataset.i,1);
        updateList(); updateUpload();
      })
    );
  }
  function updateUpload() {
    upload.disabled = files.length===0;
  }

  // --- Upload & Convert ---
  upload.addEventListener('click', async ()=>{
    if (!files.length) return;
    // switch to “Process” tab
    links[1].click();

    const form = new FormData();
    files.forEach(f=> form.append('images', f));

    startAnimation();

    try {
      const res = await fetch(API, { method:'POST', body: form });
      if (!res.ok) {
        // guard against HTML error pages
        const ct = res.headers.get('Content-Type')||'';
        let msg;
        if (ct.includes('application/json')) {
          const j = await res.json();
          msg = j.error || JSON.stringify(j);
        } else {
          msg = await res.text();
        }
        throw new Error(msg);
      }
      const { model_url } = await res.json();
      if (!model_url) throw new Error('no model_url returned');

      // dynamically import your viewer and run it
      const viewer = await import('/static/js/threejs-viewer.js');
      await viewer.loadModel(model_url);

      // switch to “View” tab
      setTimeout(()=> links[2].click(), 500);

      // setup exports
      const base = model_url.replace(/\.(?:obj|glb)$/, '');
      setupExport({
        obj: `${base}.obj`,
        stl: `${base}.stl`,
        ply: `${base}.ply`
      });
    }
    catch(err) {
      console.error('Upload failed:', err);
      alert(`Upload failed:\n${err.message}`);
      links[0].click();
    }
    finally {
      finishAnimation();
    }
  });

  // --- Progress Animation (unchanged) ---
  function startAnimation(){
    const txt = document.querySelector('.progress-text');
    const pct = document.querySelector('.progress-percent');
    const bar = document.querySelector('.progress-fill');
    let p = 0;
    const iv = setInterval(()=>{
      p = Math.min(100, p + Math.random()*15);
      bar.style.width = p+'%';
      pct.textContent = Math.floor(p)+'%';
      txt.textContent = p<30?'Analyzing…':p<60?'Building…':p<90?'Meshing…':'Finalizing…';
      if (p>=100) clearInterval(iv);
      document.querySelector('.progress-container').dataset.iv = iv;
    },300);
  }
  function finishAnimation(){
    const iv = +document.querySelector('.progress-container').dataset.iv;
    if (iv) clearInterval(iv);
    document.querySelector('.progress-fill').style.width='100%';
    document.querySelector('.progress-percent').textContent='100%';
    document.querySelector('.progress-text').textContent='Done!';
    document.querySelectorAll('.status-badge').forEach(b=>b.classList.add('complete'));
  }

  // --- Export buttons wiring ---
  function setupExport(links) {
    document.querySelectorAll('.export-card').forEach(card=>{
      const fmt = card.dataset.format;
      const btn = card.querySelector('.btn-export');
      btn.onclick = ()=> {
        const url = links[fmt];
        if (!url) return alert(`No ${fmt} available`);
        const a = document.createElement('a');
        a.href = url;
        a.download = `model.${fmt}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };
    });
    document.getElementById('back-to-view-btn').onclick = ()=> links.obj && links.obj && links.obj && links.obj && document.querySelector('.app-nav li:nth-child(3) a').click();
    document.getElementById('new-project-btn').onclick = ()=>{
      if (!confirm('Start new project?')) return;
      files=[]; updateList(); updateUpload();
      document.getElementById('model-viewer').innerHTML = `
        <div class="viewer-empty-state">
          <i class="fas fa-cube"></i><p>3D model will appear here</p>
        </div>`;
      links[0].click();
    };
  }

  console.log('main.js fully initialized');
});
