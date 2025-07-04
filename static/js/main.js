document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded at:', new Date().toISOString());

    // Configuration - Change this to your server URL
    const SERVER_URL = 'http://143.110.215.184:5000'; // Fixed IP address
    
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
        let currentModel = null;

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
            fileInput.value = '';
            updateFileList();
            updateUploadButton();
        });

        // Upload and process
        uploadBtn.addEventListener('click', async () => {
            if (files.length === 0) return;

            // Switch to process section
            document.querySelector('.app-nav li:nth-child(2) a').click();

            const formData = new FormData();
            files.forEach(file => {
                formData.append('images', file);
            });

            try {
                startProcessingAnimation();

                console.log('Sending upload request to:', `${SERVER_URL}/upload_jewelry`);
                
                // Test server connectivity first
                const testResponse = await fetch(SERVER_URL, {
                    method: 'HEAD',
                    mode: 'cors',
                    cache: 'no-cache',
                    timeout: 5000
                }).catch(error => {
                    console.error('Server connectivity test failed:', error);
                    throw new Error(`Cannot connect to server at ${SERVER_URL}. Please check if the server is running and accessible.`);
                });

                const response = await fetch(`${SERVER_URL}/upload_jewelry`, {
                    method: 'POST',
                    body: formData,
                    mode: 'cors',
                    cache: 'no-cache',
                    headers: {
                        'Accept': 'application/json',
                    }
                });

                console.log('Response status:', response.status);
                console.log('Response headers:', response.headers);

                if (!response.ok) {
                    let errorMessage = `Upload failed with status ${response.status}`;
                    try {
                        const errorData = await response.json();
                        errorMessage = errorData.error || errorMessage;
                    } catch (e) {
                        console.error('Could not parse error response:', e);
                        const errorText = await response.text();
                        errorMessage = errorText || errorMessage;
                    }
                    throw new Error(errorMessage);
                }

                const data = await response.json();
                console.log('Upload response:', data);

                // Complete the processing animation
                completeProcessingAnimation();

                if (data.model_url) {
                    currentModel = data.model_url;
                    
                    // Wait a bit then switch to view section
                    setTimeout(() => {
                        document.querySelector('.app-nav li:nth-child(3) a').click();
                        // Load the model
                        loadModel(currentModel);
                    }, 1500);
                    
                    // Setup export buttons with available formats
                    const downloadLinks = {
                        obj: data.model_url.replace('.glb', '.obj'),
                        stl: data.model_url.replace('.glb', '.stl'),
                        ply: data.model_url.replace('.glb', '.ply')
                    };
                    setupExportButtons(downloadLinks);
                    
                } else {
                    throw new Error('No model URL returned from server');
                }
                
            } catch (error) {
                console.error('Upload Error:', error);
                completeProcessingAnimation();
                
                let errorMessage = error.message;
                if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                    errorMessage = `Cannot connect to server at ${SERVER_URL}. Please check:\n1. Server is running\n2. Server URL is correct (${SERVER_URL})\n3. CORS is enabled on server\n4. No firewall blocking the connection\n5. Network connectivity`;
                } else if (error.message.includes('parse URL')) {
                    errorMessage = `Invalid server URL: ${SERVER_URL}. Please check the URL format.`;
                }
                
                alert(`Error: ${errorMessage}`);
                document.querySelector('.app-nav li:nth-child(1) a').click();
            }
        });

        function startProcessingAnimation() {
            const progressText = document.querySelector('.progress-text');
            const progressPercent = document.querySelector('.progress-percent');
            const progressFill = document.querySelector('.progress-fill');
            const statusBadges = document.querySelectorAll('.status-badge');

            // Reset all badges
            statusBadges.forEach(badge => {
                badge.classList.remove('complete', 'pending');
            });

            let progress = 0;
            const interval = setInterval(() => {
                progress += Math.random() * 5 + 2; // Slower, more realistic progress
                if (progress > 95) progress = 95; // Don't complete automatically

                progressFill.style.width = `${progress}%`;
                progressPercent.textContent = `${Math.floor(progress)}%`;

                if (progress < 25) {
                    progressText.textContent = 'Analyzing images...';
                    statusBadges[0].classList.add('pending');
                } else if (progress < 50) {
                    progressText.textContent = 'Generating 3D point cloud...';
                    statusBadges[0].classList.remove('pending');
                    statusBadges[0].classList.add('complete');
                    statusBadges[1].classList.add('pending');
                } else if (progress < 75) {
                    progressText.textContent = 'Creating surface mesh...';
                    statusBadges[1].classList.remove('pending');
                    statusBadges[1].classList.add('complete');
                    statusBadges[2].classList.add('pending');
                } else {
                    progressText.textContent = 'Finalizing model...';
                    statusBadges[2].classList.remove('pending');
                    statusBadges[2].classList.add('complete');
                    statusBadges[3].classList.add('pending');
                }

                // Store interval ID for cleanup
                document.querySelector('.progress-container').dataset.intervalId = interval;
            }, 500);
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

        function setupExportButtons(downloadLinks) {
            const exportCards = document.querySelectorAll('.export-card');

            exportCards.forEach(card => {
                const format = card.getAttribute('data-format');
                const btn = card.querySelector('.btn-export');

                btn.addEventListener('click', () => {
                    if (downloadLinks[format]) {
                        const downloadUrl = downloadLinks[format].startsWith('http') ? 
                            downloadLinks[format] : 
                            `${SERVER_URL}${downloadLinks[format]}`;
                        
                        // Create a temporary link to trigger download
                        const link = document.createElement('a');
                        link.href = downloadUrl;
                        link.download = `jewelry_model.${format}`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
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
                    fileInput.value = '';
                    sessionId = null;
                    currentModel = null;
                    updateFileList();
                    updateUploadButton();

                    // Clear the viewer
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

        // View section controls
        document.getElementById('refine-btn').addEventListener('click', () => {
            alert('Mesh refinement feature coming soon!');
        });

        document.getElementById('export-btn').addEventListener('click', () => {
            if (currentModel) {
                document.querySelector('.app-nav li:nth-child(4) a').click();
            } else {
                alert('No model loaded. Please upload and process images first.');
            }
        });

        // Viewer controls
        setupViewerControls();

        function setupViewerControls() {
            // View buttons
            const viewButtons = document.querySelectorAll('.btn-control[data-view]');
            viewButtons.forEach(btn => {
                btn.addEventListener('click', function() {
                    viewButtons.forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    
                    const view = this.getAttribute('data-view');
                    if (window.setViewAngle) {
                        window.setViewAngle(view);
                    }
                });
            });

            // Opacity control
            const opacitySlider = document.getElementById('mesh-opacity');
            if (opacitySlider) {
                opacitySlider.addEventListener('input', function() {
                    const opacity = this.value / 100;
                    if (window.setMeshOpacity) {
                        window.setMeshOpacity(opacity);
                    }
                });
            }

            // Quality control
            const qualitySelect = document.getElementById('mesh-quality');
            if (qualitySelect) {
                qualitySelect.addEventListener('change', function() {
                    const quality = this.value;
                    if (window.setMeshQuality) {
                        window.setMeshQuality(quality);
                    }
                });
            }

            // Wireframe toggle
            const wireframeToggle = document.getElementById('show-wireframe');
            if (wireframeToggle) {
                wireframeToggle.addEventListener('change', function() {
                    const showWireframe = this.checked;
                    if (window.toggleWireframe) {
                        window.toggleWireframe(showWireframe);
                    }
                });
            }

            // Light intensity
            const lightSlider = document.getElementById('light-intensity');
            if (lightSlider) {
                lightSlider.addEventListener('input', function() {
                    const intensity = this.value / 100;
                    if (window.setLightIntensity) {
                        window.setLightIntensity(intensity);
                    }
                });
            }

            // Shadows toggle
            const shadowsToggle = document.getElementById('enable-shadows');
            if (shadowsToggle) {
                shadowsToggle.addEventListener('change', function() {
                    const enableShadows = this.checked;
                    if (window.toggleShadows) {
                        window.toggleShadows(enableShadows);
                    }
                });
            }
        }

        console.log('File upload setup complete');
    } catch (error) {
        console.error('Error in File Upload section:', error);
        alert('An error occurred while setting up file upload. Check the console.');
    }

    // Global function to load model (called from upload success)
    window.loadModel = function(modelUrl) {
        console.log('Loading model:', modelUrl);
        
        if (!modelUrl) {
            console.error('No model URL provided');
            return;
        }

        // Make sure URL is absolute
        const fullUrl = modelUrl.startsWith('http') ? modelUrl : `${SERVER_URL}${modelUrl}`;
        
        // Initialize or update viewer
        if (window.initThreeJSViewer) {
            window.initThreeJSViewer(fullUrl);
        } else {
            console.error('ThreeJS viewer not loaded');
            // Fallback: show model info
            const viewer = document.getElementById('model-viewer');
            viewer.innerHTML = `
                <div class="viewer-empty-state">
                    <i class="fas fa-cube"></i>
                    <p>3D model loaded</p>
                    <p><small>${modelUrl}</small></p>
                    <a href="${fullUrl}" target="_blank" class="btn btn-primary">View Model</a>
                </div>
            `;
        }
    };
})
