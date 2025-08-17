""" API class for 2D to 3D model conversion endpoints. """

import os
import tempfile
import uuid
from flask import Blueprint, request, send_file, jsonify

from src.utils.local_2d_to_3d import Local2DTo3DConverter
from logger.logger import get_logger
import json

class ConvertAPI:
    """ API class for 2D to 3D model conversion endpoints. """

    def __init__(self, app=None):
        self.logger = get_logger("ConvertAPI")
        self.blueprint = Blueprint("convert_api", __name__)
        self.converter = None
        self.config = None
        self._register_routes()
        if app is not None:
            app.register_blueprint(self.blueprint, url_prefix="/api")
            self._load_config()
            self._init_converter()

    def _load_config(self):
        """Load configuration from config.json"""
        config_path = os.path.join(os.path.dirname(__file__), "../../config.json")
        config_path = os.path.abspath(config_path)
        with open(config_path, "r") as f:
            self.config = json.load(f)
        self.logger.info(f"Loaded config: {self.config}")

    def _init_converter(self):
        """Initialize the local 2D-to-3D converter."""
        model_name = self.config.get("model_name", "hunyuan3d-2/hunyuan3d-dit-v2-0")
        self.converter = Local2DTo3DConverter(model_name, self.logger)
        self.logger.info("Local2DTo3DConverter initialized successfully.")

    def _register_routes(self):
        """Register API routes."""
        @self.blueprint.route("/convert", methods=["POST"])
        def convert():
            if "file" not in request.files:
                return jsonify({"error": "No file uploaded"}), 400

            file = request.files["file"]
            if file.filename == "":
                return jsonify({"error": "Empty filename"}), 400

            # Save uploaded file to temp
            temp_dir = tempfile.mkdtemp()
            input_path = os.path.join(temp_dir, file.filename)
            file.save(input_path)

            job_id = str(uuid.uuid4())
            output_path = os.path.join("output", f"{job_id}.obj")

            try:
                if not self.converter:
                    return jsonify({"error": "Model not loaded"}), 503

                self.converter.convert(input_path, output_path)

                return jsonify({
                    "job_id": job_id,
                    "download_url": f"/api/output/{job_id}.obj"
                })
            except Exception as e:
                self.logger.error(f"Conversion failed: {e}", exc_info=True)
                return jsonify({"error": str(e)}), 500

        @self.blueprint.route("/output/<filename>", methods=["GET"])
        def download(filename):
            output_path = os.path.join("output", filename)
            if not os.path.exists(output_path):
                return jsonify({"error": "File not found"}), 404
            return send_file(output_path, as_attachment=True)
