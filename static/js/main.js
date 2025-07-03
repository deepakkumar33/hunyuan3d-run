// static/js/main.js
import { loadModel } from './threejs-viewer.js';  // local module import

document.addEventListener('DOMContentLoaded', () => {
  console.log('main.js loaded at', new Date().toISOString());
  const API = '';

  // Navigation
  const tabs = Array.from(document.querySelectorAll('.app-nav a'));
  const sections = Array.from(document.querySelectorAll('.app-section'));
  tabs.forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    const id = a.getAttribute('href').slice(1);
    tabs.forEach(t=>t.parentElement.classList.remove('active'));
    a.parentElement.classList.add('active');
    sections.forEach(s=>s.id===id ? s.classList.add('active') : s.classList.remove('active'));
  }));

  // File selection
  const dropZone=document.getElementById('drop-zone');
  const fileInput=document.getElementById('file-input');
  const fileList=document.getElementById('file-list');
  const uploadBtn=document.getElementById('upload-btn');
  const clearBtn=document.getElementById('clear-btn');
  let files=[];

  ['dragenter','dragover','dragleave','drop'].forEach(ev=> dropZone.addEventListener(ev,e=>{e.preventDefault();e.stopPropagation();}));
  ['dragenter','dragover'].forEach(ev=> dropZone.addEventListener(ev,()=>dropZone.classList.add('drag-over')));
  ['dragleave','drop'].forEach(ev=> dropZone.addEventListener(ev,()=>dropZone.classList.remove('drag-over')));
  dropZone.addEventListener('drop', e=> addFiles(e.dataTransfer.files));
  clearBtn.addEventListener('click', ()=>{ files=[]; renderList(); toggleUpload(); });
  document.getElementById('browse-btn').addEventListener('click', ()=> fileInput.click());
  fileInput.addEventListener('change', ()=> addFiles(fileInput.files));

  function addFiles(fileListObj) {
    files = [...files, ...fileListObj]; renderList(); toggleUpload();
  }
  function renderList() {
    if(!files.length) return fileList.innerHTML='<div class="empty-state"><i class="fas fa-images"></i><p>No files selected</p></div>';
    fileList.innerHTML='';
    files.forEach((f,i)=>{
      const div=document.createElement('div'); div.className='file-item';
      div.innerHTML=`<i class="fas fa-file-image file-icon"></i><div class="file-info"><div class="file-name">${f.name}</div><div class="file-size">${(f.size/1024**2).toFixed(2)} MB</div></div><i class="fas fa-times file-remove" data-index="${i}"></i>`;
      fileList.appendChild(div);
    });
    fileList.querySelectorAll('.file-remove').forEach(btn=> btn.onclick=()=>{ files.splice(+btn.dataset.index,1); renderList(); toggleUpload(); });
  }
  function toggleUpload(){ uploadBtn.disabled = files.length===0; }

  // Conversion
  uploadBtn.addEventListener('click', async ()=>{
    if(!files.length) return;
    tabs[1].click(); // go to processing
    const form=new FormData(); files.forEach(f=> form.append('images',f));
    try {
      animateProgress(true);
      const resp=await fetch(`${API}/api/convert`,{method:'POST',body:form});
      if(!resp.ok) throw new Error((await resp.json()).error||resp.status);
      const {model_url}=await resp.json();
      loadModel(model_url);
      tabs[2].click();
      setupExport(model_url);
    } catch(err){ alert(`Error: ${err.message}`); tabs[0].click(); animateProgress(false); }
  });

  // Progress UI
  function animateProgress(start){ const txt=document.querySelector('.progress-text'), pct=document.querySelector('.progress-percent'), bar=document.querySelector('.progress-fill'); if(start){ bar.style.width='0%'; pct.textContent='0%'; txt.textContent='Starting...'; } else { bar.style.width='100%'; pct.textContent='100%'; txt.textContent='Done'; } }

  // Export
  function setupExport(url){ document.querySelectorAll('.export-card').forEach(card=>{
    const fmt=card.dataset.format;
    card.querySelector('.btn-export').onclick=()=> location.href=`${url.replace(/\.obj$/,'.'+fmt)}`;
  });
  document.getElementById('back-to-view-btn').onclick=()=> tabs[2].click();
  document.getElementById('new-project-btn').onclick=()=> location.reload(); }

  console.log('main.js initialized');
});
