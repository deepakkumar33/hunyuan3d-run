import os
import uuid
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

# 2) Enable CORS
CORS(app)

logger = Logger(__name__).get_logger()

# 3) Mount APIs
cfg = ConfigLoader()
convert_api = ConvertAPI(logger, cfg)
config_api = ConfigAPI(cfg)
app.register_blueprint(convert_api.api, url_prefix='/api')
app.register_blueprint(config_api.api, url_prefix='/api')

# ✅ New endpoint: /upload_jewelry -> run real 2D→3D conversion
@app.route('/upload_jewelry', methods=['POST'])
def upload_jewelry():
    if 'images' not in request.files:
        return jsonify({'error': 'No images uploaded'}), 400

    images = request.files.getlist('images')
    logger.info(f"Received {len(images)} images")

    # Save uploaded files
    upload_folder = os.path.join(app.static_folder, 'uploads')
    os.makedirs(upload_folder, exist_ok=True)

    saved_paths = []
    for img in images:
        save_path = os.path.join(upload_folder, img.filename)
        img.save(save_path)
        saved_paths.append(save_path)

    # 🔥 Call your actual 2D → 3D pipeline
    try:
        job_id = str(uuid.uuid4())
        output_dir = os.path.join("output", job_id)
        os.makedirs(output_dir, exist_ok=True)

        # Run conversion (Local2DTo3DConverter from your utils)
        from src.utils.local_2d_to_3d import Local2DTo3DConverter
        converter = Local2DTo3DConverter(logger, cfg)
        model_path = converter.convert(saved_paths, output_dir)

        logger.info(f"Model generated at: {model_path}")

        # Return path that frontend can load
        model_url = f"/api/output/{job_id}/{os.path.basename(model_path)}"
        return jsonify({"model_url": model_url})

    except Exception as e:
        logger.error(f"3D conversion failed: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

# 4) Serve the SPA (index.html) for non-/api routes
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_spa(path):
    static_path = os.path.join(app.static_folder, path)
    if path and os.path.exists(static_path):
        return send_from_directory(app.static_folder, path)
    return render_template('index.html')

if __name__ == '__main__':
    logger.info("🔍 Registered routes:\n%s", app.url_map)
    logger.info("🚀 Starting Flask on 0.0.0.0:5000…")
    app.run(debug=True, host='0.0.0.0', port=5000)
