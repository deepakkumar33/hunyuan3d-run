document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM fully loaded at:', new Date().toISOString());

    const SERVER_URL = 'http://143.110.215.184:5000';

    // Navigation
    try {
        const navLinks = document.querySelectorAll('.app-nav a');
        const sections = document.querySelectorAll('.app-section');

        navLinks.forEach(link => {
            link.addEventListener('click', function (e) {
                e.preventDefault();
                const targetId = this.getAttribute('href').substring(1);

                navLinks.forEach(navLink => navLink.parentElement.classList.remove('active'));
                this.parentElement.classList.add('active');

                sections.forEach(section => {
                    section.classList.remove('active');
                    if (section.id === targetId) {
                        section.classList.add('active');
                    }
                });
            });
        });
    } catch (err) {
        console.error('Navigation setup failed:', err);
    }

    // Upload Logic
    try {
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');
        const browseBtn = document.getElementById('browse-btn');
        const fileList = document.getElementById('file-list');
        const uploadBtn = document.getElementById('upload-btn');
        const clearBtn = document.getElementById('clear-btn');

        let files = [];
        let currentModel = null;

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
            dropZone.addEventListener(event, preventDefaults, false);
        });

        dropZone.addEventListener('dragover', () => dropZone.classList.add('drag-over'));
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
        dropZone.addEventListener('drop', (e) => {
            dropZone.classList.remove('drag-over');
            handleFiles(e.dataTransfer.files);
        });

        browseBtn.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', () => {
            handleFiles(fileInput.files);
        });

        clearBtn.addEventListener('click', () => {
            files = [];
            updateFileList();
        });

        function handleFiles(newFiles) {
            files = [...files, ...newFiles];
            updateFileList();
        }

        function updateFileList() {
            fileList.innerHTML = '';

            if (files.length === 0) {
                fileList.innerHTML = `<p>No files selected</p>`;
                return;
            }

            files.forEach((file, index) => {
                const div = document.createElement('div');
                div.textContent = `${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
                const removeBtn = document.createElement('button');
                removeBtn.textContent = 'X';
                removeBtn.addEventListener('click', () => {
                    files.splice(index, 1);
                    updateFileList();
                });
                div.appendChild(removeBtn);
                fileList.appendChild(div);
            });

            uploadBtn.disabled = files.length === 0;
        }

        uploadBtn.addEventListener('click', async () => {
            if (!files.length) return;

            document.querySelector('.app-nav li:nth-child(2) a').click();

            const formData = new FormData();
            files.forEach(file => formData.append('images', file));

            try {
                startProcessingAnimation();

                const res = await fetch(`${SERVER_URL}/upload_jewelry`, {
                    method: 'POST',
                    body: formData
                });

                const cloned = res.clone();
                const data = await res.json().catch(() => ({}));

                if (!res.ok || !data.model_url) {
                    const errorText = await cloned.text();
                    throw new Error(`Upload failed: ${errorText}`);
                }

                currentModel = data.model_url;
                completeProcessingAnimation();

                setTimeout(() => {
                    document.querySelector('.app-nav li:nth-child(3) a').click();
                    window.loadModel(currentModel);
                }, 1000);

            } catch (err) {
                completeProcessingAnimation();
                alert(`Upload error: ${err.message}`);
                document.querySelector('.app-nav li:nth-child(1) a').click();
            }
        });

        function startProcessingAnimation() {
            const fill = document.querySelector('.progress-fill');
            const text = document.querySelector('.progress-text');
            const percent = document.querySelector('.progress-percent');

            let progress = 0;
            const interval = setInterval(() => {
                progress += 5;
                if (progress >= 100) {
                    progress = 100;
                    clearInterval(interval);
                }
                fill.style.width = `${progress}%`;
                percent.textContent = `${progress}%`;
                text.textContent = 'Processing...';
            }, 300);

            document.querySelector('.progress-container').dataset.intervalId = interval;
        }

        function completeProcessingAnimation() {
            const intervalId = document.querySelector('.progress-container').dataset.intervalId;
            if (intervalId) clearInterval(parseInt(intervalId));

            document.querySelector('.progress-fill').style.width = '100%';
            document.querySelector('.progress-percent').textContent = '100%';
            document.querySelector('.progress-text').textContent = 'Done!';
        }

        window.loadModel = function (url) {
            const viewer = document.getElementById('model-viewer');
            const fullUrl = url.startsWith('http') ? url : `${SERVER_URL}${url}`;
            viewer.innerHTML = `<a href="${fullUrl}" target="_blank">Download Model</a>`;
        };
    } catch (err) {
        console.error('Upload section error:', err);
    }
});
