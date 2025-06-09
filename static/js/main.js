// main.js
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded at:', new Date().toISOString());

    // If you need an explicit host (e.g. your ngrok URL), set it here.
    // But by default we use a relative path so `fetch('/api/convert')` works.
    const API_BASE_URL = '';

    // Navigation
    const navLinks = document.querySelectorAll('.app-nav a');
    const sections = document.querySelectorAll('.app-section');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            navLinks.forEach(n => n.parentElement.classList.remove('active'));
            this.parentElement.classList.add('active');
            sections.forEach(s => s.classList.toggle('active', s.id === targetId));
        });
    });

    // File Upload UI
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('browse-btn');
    const fileList = document.getElementById('file-list');
    const uploadBtn = document.getElementById('upload-btn');
    const clearBtn  = document.getElementById('clear-btn');
    let files = [];

    // Prevent default drag/drop
    ['dragenter','dragover','dragleave','drop'].forEach(evt =>
        dropZone.addEventListener(evt, e=>{ e.preventDefault(); e.stopPropagation(); })
    );
    ['dragenter','dragover'].forEach(evt =>
        dropZone.addEventListener(evt, ()=> dropZone.classList.add('drag-over'))
    );
    ['dragleave','drop'].forEach(evt =>
        dropZone.addEventListener(evt, ()=> dropZone.classList.remove('drag-over'))
    );
    dropZone.addEventListener('drop', e => handleFiles(e.dataTransfer.files));

    browseBtn.addEventListener('click', ()=> fileInput.click());
    fileInput.addEventListener('change', ()=> handleFiles(fileInput.files));

    clearBtn.addEventListener('click', () => {
        files = []; updateFileList(); updateUploadButton();
    });

    function handleFiles(newFiles) {
        files = [...files, ...newFiles];
        updateFileList();
        updateUploadButton();
    }

    function updateFileList() {
        if (!files.length) {
            fileList.innerHTML = `<div class="empty-state"><i class="fas fa-images"></i><p>No files selected</p></div>`;
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
        document.querySelectorAll('.file-remove').forEach(btn =>
            btn.addEventListener('click', () => {
                files.splice(+btn.dataset.index,1);
                updateFileList(); updateUploadButton();
            })
        );
    }

    function formatFileSize(b) {
        const sizes=['Bytes','KB','MB','GB'], k=1024;
        if (!b) return '0 Bytes';
        const i = Math.floor(Math.log(b)/Math.log(k));
        return `${(b/Math.pow(k,i)).toFixed(2)} ${sizes[i]}`;
    }

    function updateUploadButton() {
        uploadBtn.disabled = !files.length;
    }

    // Upload & convert
    uploadBtn.addEventListener('click', async () => {
        if (!files.length) return;
        document.querySelector('.app-nav li:nth-child(2) a').click();

        const formData = new FormData();
        files.forEach(f => formData.append('images', f));

        try {
            startProcessingAnimation();

            console.log('Sending upload request to /api/convert');
            const res = await fetch(`${API_BASE_URL}/api/convert`, {
                method: 'POST',
                body: formData
            });
            if (!res.ok) {
                const err = await res.json().catch(()=>({}));
                throw new Error(err.error || `Status ${res.status}`);
            }
            const data = await res.json();
            console.log('Convert response:', data);

            if (!data.model_url) throw new Error('No model_url returned');
            const viewer = await import('/static/js/threejs-viewer.js');
            viewer.loadModel(data.model_url, null);
            setTimeout(()=> document.querySelector('.app-nav li:nth-child(3) a').click(), 500);
            setupExportButtons({ obj: data.model_url.replace('.glb','.obj') });
        } catch (e) {
            console.error(e);
            alert(`Upload failed: ${e.message}`);
            document.querySelector('.app-nav li:nth-child(1) a').click();
            completeProcessingAnimation();
        }
    });

    // (progress animation, export buttons, etc—unchanged…)
    // …
});
