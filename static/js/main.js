document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded at:', new Date().toISOString());

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

        const API = window.location.origin;

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
            if (fileInput) {
                try {
                    fileInput.click();
                } catch (error) {
                    fileInput.style.display = 'block';
                    fileInput.style.opacity = '1';
                    fileInput.style.position = 'relative';
                    alert('Automatic file dialog failed. Use the visible file input.');
                }
            }
        });

        fileInput.addEventListener('change', () => {
            handleFiles(fileInput.files);
        });

        function handleFiles(newFiles) {
            files = [...files, ...newFiles];
            updateFileList();
            updateUploadButton();
        }

        function updateFileList() {
            if (files.length === 0) {
                fileList.innerHTML = `<div class="empty-state"><i class="fas fa-images"></i><p>No files selected</p></div>`;
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

        uploadBtn.addEventListener('click', async () => {
            if (files.length === 0) return;
            document.querySelector('.app-nav li:nth-child(2) a').click();

            const formData = new FormData();
            files.forEach(file => {
                formData.append('images', file);
            });

            try {
                startProcessingAnimation();

                const response = await fetch(`${API}/upload_jewelry`, {
                    method: 'POST',
                    body: formData,
                    mode: 'cors'
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `Upload failed with status ${response.status}`);
                }

                const data = await response.json();
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
                alert(`Error: ${error.message}. Please check the server logs and ensure the server is running properly.`);
                document.querySelector('.app-nav li:nth-child(1) a').click();
                completeProcessingAnimation();
            }
        });

        // all other methods (startProcessingAnimation, completeProcessingAnimation, etc.) stay same

    } catch (error) {
        console.error('Error in File Upload section:', error);
        alert('An error occurred while setting up file upload. Check the console.');
    }
});
