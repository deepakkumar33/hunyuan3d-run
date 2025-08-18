""" API class for 2D to 3D model conversion endpoints. """

import os
import tempfile
import uuid
import json
import logging
from flask import Blueprint, request, send_file, jsonify

from src.utils.local_2d_to_3d import Local2DTo3DConverter


class ConvertAPI:
    """ API class for 2D to 3D model conversion endpoints. """

    def __init__(self, app=None):
        # Use built-in logger
        self.logger = logging.getLogger("ConvertAPI")
        logging.basicConfig(level=logging.INFO)

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

        if os.path.exists(config_path):
            with open(config_path, "r") as f:
                self.config = json.load(f)
            self.logger.info(f"Loaded config: {self.config}")
        else:
            self.logger.warning("No config.json found, using defaults.")
            self.config = {}

    def _init_converter(self):
        """Initialize the local 2D-to-3D converter."""
        output_dir = self.config.get("output_dir", "output")
        os.makedirs(output_dir, exist_ok=True)

        # Initialize converter
        self.converter = Local2DTo3DConverter(
            input_path=None,  # Will be set per-request
            output_dir=output_dir
        )
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
            output_dir = os.path.join("output", job_id)
            os.makedirs(output_dir, exist_ok=True)

            try:
                if not self.converter:
                    return jsonify({"error": "Model not loaded"}), 503

                # Run conversion
                converter = Local2DTo3DConverter(input_path, output_dir)
                result = converter.convert()

                return jsonify({
                    "job_id": job_id,
                    "results": result,
                    "download_url": f"/api/output/{job_id}"
                })
            except Exception as e:
                self.logger.error(f"Conversion failed: {e}", exc_info=True)
                return jsonify({"error": str(e)}), 500

        @self.blueprint.route("/output/<job_id>", methods=["GET"])
        def download(job_id):
            output_dir = os.path.join("output", job_id)
            if not os.path.exists(output_dir):
                return jsonify({"error": "Result not found"}), 404

            # Find first OBJ file in output folder
            for fname in os.listdir(output_dir):
                if fname.endswith(".obj"):
                    return send_file(os.path.join(output_dir, fname), as_attachment=True)

            return jsonify({"error": "No OBJ file generated"}), 404
