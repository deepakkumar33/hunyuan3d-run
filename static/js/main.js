// main.js
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded at:', new Date().toISOString());

    const API_BASE_URL = "https://0333-103-196-86-110.ngrok-free.app";

    // Navigation
    try {
        const navLinks = document.querySelectorAll('.app-nav a');
        const sections = document.querySelectorAll('.app-section');
        
        if (!navLinks.length || !sections.length) {
            console.error('Navigation elements not found:', {
                navLinks: navLinks.length,
                sections: sections.length
            });
            return;
        }

        navLinks.forEach(link => {
            link.addEventListener('click', function(e) {
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
        console.log('Navigation setup complete');
    } catch (error) {
        console.error('Error in Navigation setup:', error);
        return;
    }

    // File Upload
    try {
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');
        const browseBtn = document.getElementById('browse-btn');
        const fileList = document.getElementById('file-list');
        const uploadBtn = document.getElementById('upload-btn');
        const clearBtn = document.getElementById('clear-btn');

        console.log('Checking DOM elements:');
        console.log('dropZone:', !!dropZone);
        console.log('fileInput:', !!fileInput);
        console.log('browseBtn:', !!browseBtn);
        console.log('fileList:', !!fileList);
        console.log('uploadBtn:', !!uploadBtn);
        console.log('clearBtn:', !!clearBtn);

        if (!dropZone || !fileInput || !browseBtn || !fileList || !uploadBtn || !clearBtn) {
            console.error('One or more DOM elements not found:', {
                dropZone: !!dropZone,
                fileInput: !!fileInput,
                browseBtn: !!browseBtn,
                fileList: !!fileList,
                uploadBtn: !!uploadBtn,
                clearBtn: !!clearBtn
            });
            alert('Error: Some UI elements are missing. Check the console.');
            return;
        }

        let files = [];
        let sessionId = null;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, unhighlight, false);
        });

        function highlight() {
            dropZone.classList.add('drag-over');
        }

        function unhighlight() {
            dropZone.classList.remove('drag-over');
        }

        dropZone.addEventListener('drop', handleDrop, false);

        function handleDrop(e) {
            const dt = e.dataTransfer;
            const newFiles = dt.files;
            handleFiles(newFiles);
        }

        browseBtn.addEventListener('click', () => {
            console.log('Browse button clicked at:', new Date().toISOString());
            if (fileInput) {
                try {
                    fileInput.click();
                    console.log('fileInput.click() triggered');
                } catch (error) {
                    console.error('Error triggering fileInput.click():', error);
                    fileInput.style.display = 'block';
                    fileInput.style.opacity = '1';
                    fileInput.style.position = 'relative';
                    alert('Automatic file dialog failed. Use the visible file input.');
                }
            } else {
                console.error('fileInput not found');
            }
        });

        fileInput.addEventListener('change', () => {
            console.log('File input changed at:', new Date().toISOString());
            console.log('Files selected:', fileInput.files);
            handleFiles(fileInput.files);
        });

        function handleFiles(newFiles) {
            files = [...files, ...newFiles];
            updateFileList();
            updateUploadButton();
        }

        function updateFileList() {
            if (files.length === 0) {
                fileList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-images"></i>
                        <p>No files selected</p>
                    </div>
                `;
                return;
            }

            fileList.innerHTML = '';

            files.forEach((file, index) => {
                const fileItem = document.createElement('div');
                fileItem.className = 'file-item';
                fileItem.innerHTML = `
                    <i class="fas fa-file-image file-icon"></i>
                    <div class="file-info">
                        <div class="file-name">${file.name}</div>
                        <div class="file-size">${formatFileSize(file.size)}</div>
                    </div>
                    <i class="fas fa-times file-remove" data-index="${index}"></i>
                `;
                fileList.appendChild(fileItem);
            });

            document.querySelectorAll('.file-remove').forEach(btn => {
                btn.addEventListener('click', function() {
                    const index = parseInt(this.getAttribute('data-index'));
                    files.splice(index, 1);
                    updateFileList();
                    updateUploadButton();
                });
            });
        }

        function formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }

        function updateUploadButton() {
            uploadBtn.disabled = files.length === 0;
        }

        clearBtn.addEventListener('click', () => {
            files = [];
            updateFileList();
            updateUploadButton();
        });

        // Upload and process
        uploadBtn.addEventListener('click', async () => {
            if (files.length === 0) return;

            document.querySelector('.app-nav li:nth-child(2) a').click();

            const formData = new FormData();
            files.forEach(file => {
                formData.append('images', file);
            });

            try {
                startProcessingAnimation();

                console.log('Sending upload request to /upload_jewelry');
                const response = await fetch(`${API_BASE_URL}/upload_jewelry`, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `Upload failed with status ${response.status}`);
                }

                const data = await response.json();
                console.log('Upload response:', data);

                if (data.model_url) {
                    const threeJSViewer = await loadThreeJSViewer();
                    if (threeJSViewer) {
                        threeJSViewer.loadModel(data.model_url, null);
                        setTimeout(() => {
                            document.querySelector('.app-nav li:nth-child(3) a').click();
                        }, 1000);
                        setupExportButtons(null, { obj: data.model_url.replace('.glb', '.obj') });
                    }
                } else {
                    throw new Error('No model URL returned from upload');
                }
            } catch (error) {
                console.error('Error:', error);
                alert(`Error: ${error.message}. Please check the server logs and ensure the server is running on ${API_BASE_URL}.`);
                document.querySelector('.app-nav li:nth-child(1) a').click();
                completeProcessingAnimation();
            }
        });

        async function loadThreeJSViewer() {
            try {
                const module = await import('/static/js/threejs-viewer.js');
                return module;
            } catch (error) {
                console.error('Failed to load threejs-viewer.js:', error);
                alert('Error loading 3D viewer. Check the console.');
                return null;
            }
        }

        function completeProcessingAnimation() {
            const progressText = document.querySelector('.progress-text');
            const progressPercent = document.querySelector('.progress-percent');
            const progressFill = document.querySelector('.progress-fill');
            const statusBadges = document.querySelectorAll('.status-badge');
            const intervalId = document.querySelector('.progress-container').dataset.intervalId;

            if (intervalId) {
                clearInterval(parseInt(intervalId));
            }

            progressFill.style.width = '100%';
            progressPercent.textContent = '100%';
            progressText.textContent = 'Processing complete!';

            statusBadges.forEach(badge => {
                badge.classList.remove('pending');
                badge.classList.add('complete');
            });
        }

        function startProcessingAnimation() {
            const progressText = document.querySelector('.progress-text');
            const progressPercent = document.querySelector('.progress-percent');
            const progressFill = document.querySelector('.progress-fill');
            const statusBadges = document.querySelectorAll('.status-badge');

            let progress = 0;
            const interval = setInterval(() => {
                progress += Math.random() * 10;
                if (progress > 100) progress = 100;

                progressFill.style.width = `${progress}%`;
                progressPercent.textContent = `${Math.floor(progress)}%`;

                if (progress < 30) {
                    progressText.textContent = 'Analyzing images...';
                } else if (progress < 60) {
                    progressText.textContent = 'Generating 3D point cloud...';
                    statusBadges[0].classList.add('complete');
                    statusBadges[1].classList.add('pending');
                } else if (progress < 90) {
                    progressText.textContent = 'Creating surface mesh...';
                    statusBadges[2].classList.add('pending');
                } else {
                    progressText.textContent = 'Finalizing model...';
                    statusBadges[3].classList.add('pending');
                }

                document.querySelector('.progress-container').dataset.intervalId = interval;

                if (progress === 100) {
                    clearInterval(interval);
                }
            }, 300);
        }

        function setupExportButtons(sessionId, downloadLinks) {
            const exportCards = document.querySelectorAll('.export-card');

            exportCards.forEach(card => {
                const format = card.getAttribute('data-format');
                const btn = card.querySelector('.btn-export');

                btn.addEventListener('click', () => {
                    if (downloadLinks[format]) {
                        window.location.href = `${API_BASE_URL}${downloadLinks[format]}`;
                    } else {
                        alert(`File format ${format} not available`);
                    }
                });
            });

            document.getElementById('back-to-view-btn').addEventListener('click', () => {
                document.querySelector('.app-nav li:nth-child(3) a').click();
            });

            document.getElementById('new-project-btn').addEventListener('click', () => {
                if (confirm('Start a new project? All current data will be lost.')) {
                    files = [];
                    sessionId = null;
                    updateFileList();
                    updateUploadButton();

                    const viewer = document.getElementById('model-viewer');
                    viewer.innerHTML = `
                        <div class="viewer-empty-state">
                            <i class="fas fa-cube"></i>
                            <p>3D model will appear here</p>
                        </div>
                    `;

                    document.querySelector('.app-nav li:nth-child(1) a').click();
                }
            });
        }

        document.getElementById('refine-btn').addEventListener('click', () => {
            alert('Mesh refinement would be implemented here');
        });

        document.getElementById('export-btn').addEventListener('click', () => {
            document.querySelector('.app-nav li:nth-child(4) a').click();
        });

        console.log('File upload setup complete');
    } catch (error) {
        console.error('Error in File Upload section:', error);
        alert('An error occurred while setting up file upload. Check the console.');
    }
});
