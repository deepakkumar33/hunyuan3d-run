"""
API class for 2D->3D conversion endpoints.

- Constructor: ConvertAPI(logger, output_dir)
- Exposes: .blueprint (Flask Blueprint) so main.py can register it as convert_api.blueprint
"""

import os
import tempfile
import uuid
from flask import Blueprint, request, jsonify, send_file

from src.utils.local_2d_to_3d import Local2DTo3DConverter


class ConvertAPI:
    def __init__(self, logger, output_root):
        self.logger = logger
        self.output_root = output_root  # path where all outputs are stored
        # blueprint name 'api' keeps routes under the same prefix
        self.blueprint = Blueprint("api", __name__)
        self.add_routes()

    def add_routes(self):
        @self.blueprint.route("/convert", methods=["POST"])
        def convert_route():
            if not request.files or "images" not in request.files:
                self.logger.warning("Convert called without images")
                return jsonify({"error": "Missing images in request"}), 400

            images = request.files.getlist("images")
            if not images:
                self.logger.warning("No images provided in convert request")
                return jsonify({"error": "No images provided"}), 400

            self.logger.info(f"Received {len(images)} image(s) for conversion")

            # Save images to a temporary dir
            tmp_dir = tempfile.mkdtemp(prefix="upload_")
            image_paths = []
            for img in images:
                save_path = os.path.join(tmp_dir, img.filename)
                img.save(save_path)
                image_paths.append(save_path)

            try:
                job_id = str(uuid.uuid4())
                output_dir = os.path.join(self.output_root, job_id)
                os.makedirs(output_dir, exist_ok=True)

                # Use updated converter method
                converter = Local2DTo3DConverter(self.logger, output_dir)
                model_path = converter.convert(image_paths, output_dir)  # updated line

                # URL for frontend (without /api prefix)
                model_url = f"/output/{job_id}/{os.path.basename(model_path)}"
                self.logger.info(f"3D model generated at {model_path}")
                return jsonify({"message": "3D model generated", "model_url": model_url})

            except Exception as e:
                self.logger.error(f"Conversion failed: {e}", exc_info=True)
                return jsonify({"error": str(e)}), 500

        @self.blueprint.route("/output/<job_id>/<path:filename>", methods=["GET", "HEAD"])
        def serve_model(job_id, filename):
            filepath = os.path.join(self.output_root, job_id, filename)
            if not os.path.exists(filepath):
                self.logger.warning(f"Requested model not found: {filepath}")
                return jsonify({"error": "File not found"}), 404
            return send_file(
                filepath,
                as_attachment=False,
                download_name=os.path.basename(filepath),
                conditional=True  # allows HEAD requests
            )
