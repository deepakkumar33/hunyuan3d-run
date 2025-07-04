import os
from flask import Flask, send_from_directory, render_template, request, jsonify
from flask_cors import CORS
from src.utils.configuration import ConfigLoader
from src.api.convert_api import ConvertAPI
from src.api.config_api import ConfigAPI
from src.logger.logger import Logger

# 1) Point Flask at your folders
app = Flask(
    __name__,
    static_folder='static',      # serves /static/js, /static/css, etc.
    template_folder='templates'  # serves templates/index.html
)

# 2) Enable CORS so your SPA can hit /api from anywhere
CORS(app)

logger = Logger(__name__).get_logger()

# 3) Mount your two blueprints under /api
cfg = ConfigLoader()
app.register_blueprint(ConvertAPI(logger, cfg).api, url_prefix='/api')
app.register_blueprint(ConfigAPI(cfg).api,     url_prefix='/api')

# ✅ Add new endpoint for /upload_jewelry
@app.route('/upload_jewelry', methods=['POST'])
def upload_jewelry():
    if 'images' not in request.files:
        return jsonify({'error': 'No images uploaded'}), 400

    images = request.files.getlist('images')
    logger.info(f"Received {len(images)} images")

    # Save uploaded files (optional)
    upload_folder = os.path.join(app.static_folder, 'uploads')
    os.makedirs(upload_folder, exist_ok=True)

    for img in images:
        img.save(os.path.join(upload_folder, img.filename))

    # Dummy model generation logic (replace with real logic later)
    dummy_model_url = '/static/models/example.glb'
    return jsonify({ 'model_url': dummy_model_url })

# 4) Serve the SPA (index.html) for any non-/api route
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_spa(path):
    static_path = os.path.join(app.static_folder, path)
    if path and os.path.exists(static_path):
        return send_from_directory(app.static_folder, path)
    return render_template('index.html')

if __name__ == '__main__':
    logger.info("\ud83d\udd0d Registered routes:\n%s", app.url_map)
    logger.info("\ud83d\ude80 Starting Flask on 0.0.0.0:5000…")
    app.run(debug=True, host='0.0.0.0', port=5000)
