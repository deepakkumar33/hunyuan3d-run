import os
import uuid
from flask import Flask, send_from_directory, render_template, request, jsonify
from flask_cors import CORS
from src.utils.configuration import ConfigLoader
from src.api.convert_api import ConvertAPI
from src.api.config_api import ConfigAPI
from src.logger.logger import Logger

app = Flask(
    __name__,
    static_folder='static',
    template_folder='templates'
)

CORS(app)

logger = Logger(__name__).get_logger()

# Load config
cfg = ConfigLoader()  # for other app configs
output_root = os.path.join(os.getcwd(), "output")  # path where all 3D models will be saved
os.makedirs(output_root, exist_ok=True)

# Initialize APIs
convert_api = ConvertAPI(logger, output_root)  # pass string path, not ConfigLoader
config_api = ConfigAPI(cfg)

# Register blueprints
app.register_blueprint(convert_api.blueprint, url_prefix='/api')
app.register_blueprint(config_api.api, url_prefix='/api')


@app.route('/upload_jewelry', methods=['POST'])
def upload_jewelry():
    if 'images' not in request.files:
        return jsonify({'error': 'No images uploaded'}), 400

    images = request.files.getlist('images')
    logger.info(f"Received {len(images)} images")

    upload_folder = os.path.join(app.static_folder, 'uploads')
    os.makedirs(upload_folder, exist_ok=True)

    saved_paths = []
    for img in images:
        save_path = os.path.join(upload_folder, img.filename)
        img.save(save_path)
        saved_paths.append(save_path)

    try:
        job_id = str(uuid.uuid4())
        job_output_dir = os.path.join(output_root, job_id)
        os.makedirs(job_output_dir, exist_ok=True)

        from src.utils.local_2d_to_3d import Local2DTo3DConverter
        converter = Local2DTo3DConverter(logger, output_root)

        # Convert images to 3D
        model_path = converter.convert(saved_paths, job_output_dir)
        logger.info(f"Model generated at: {model_path}")

        # Return URL pointing to <job_output_dir>/output_model.obj
        model_url = f"/output/{job_id}/output_model.obj"
        return jsonify({"model_url": model_url})

    except Exception as e:
        logger.error(f"3D conversion failed: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_spa(path):
    static_path = os.path.join(app.static_folder, path)
    if path and os.path.exists(static_path):
        return send_from_directory(app.static_folder, path)
    return render_template('index.html')


# Serve 3D models from output folder
@app.route('/output/<job_id>/<filename>')
def serve_output(job_id, filename):
    model_dir = os.path.join(output_root, job_id)
    return send_from_directory(model_dir, filename)


if __name__ == '__main__':
    logger.info("Registered routes:\n%s", app.url_map)
    logger.info("🚀 Starting Flask on 0.0.0.0:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)
