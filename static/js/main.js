// main.js

// All code from your previous script
// with fixes for "body stream already read" error added below

document.addEventListener('DOMContentLoaded', function () {
  console.log('DOM fully loaded at:', new Date().toISOString());

  const SERVER_URL = 'http://143.110.215.184:5000';

  // (Navigation setup remains unchanged...)

  // ... all earlier setup code, file input, drag & drop logic etc ...

  uploadBtn.addEventListener('click', async () => {
    if (files.length === 0) return;
    document.querySelector('.app-nav li:nth-child(2) a').click();

    const formData = new FormData();
    files.forEach(file => {
      formData.append('images', file);
    });

    try {
      startProcessingAnimation();
      console.log('Sending upload request to:', `${SERVER_URL}/upload_jewelry`);

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
          const errorData = await response.clone().json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          console.error('Could not parse error JSON:', e);
          try {
            const errorText = await response.clone().text();
            errorMessage = errorText || errorMessage;
          } catch (textErr) {
            errorMessage = 'Unknown error occurred';
          }
        }
        throw new Error(errorMessage);
      }

      let data;
      try {
        data = await response.clone().json();
      } catch (jsonErr) {
        const text = await response.clone().text();
        console.warn("Fallback response text:", text);
        throw new Error("Failed to parse JSON response.");
      }

      console.log('Upload response:', data);
      completeProcessingAnimation();

      if (data.model_url) {
        currentModel = data.model_url;

        setTimeout(() => {
          document.querySelector('.app-nav li:nth-child(3) a').click();
          loadModel(currentModel);
        }, 1500);

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

  // ... other functions like startProcessingAnimation, completeProcessingAnimation, setupExportButtons, loadModel, etc. remain unchanged

  // Example: keep your loadModel global method
  window.loadModel = function (modelUrl) {
    console.log('Loading model:', modelUrl);

    if (!modelUrl) {
      console.error('No model URL provided');
      return;
    }

    const fullUrl = modelUrl.startsWith('http') ? modelUrl : `${SERVER_URL}${modelUrl}`;

    if (window.initThreeJSViewer) {
      window.initThreeJSViewer(fullUrl);
    } else {
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

  console.log('main.js initialized');
});
