import os
import tempfile
import uuid
from flask import Blueprint, request, jsonify, send_file
from src.utils.local_2d_to_3d import Local2DTo3DConverter

class ConvertAPI:
    """
    API class for 2D to 3D model conversion endpoints.
    """

    def __init__(self, logger, config):
        self.logger = logger
        self.config = config
        self.api = Blueprint("convert_api", __name__)  # ✅ attach blueprint here

        # Register routes on the blueprint
        self.api.add_url_rule(
            "/convert",
            view_func=self.convert,
            methods=["POST"]
        )

    def convert(self):
        """Handle 2D → 3D model conversion requests."""
        if 'images' not in request.files:
            return jsonify({"error": "No images uploaded"}), 400

        images = request.files.getlist("images")
        self.logger.info(f"Received {len(images)} images")

        # Save uploads to temp dir
        tmp_dir = tempfile.mkdtemp()
        image_paths = []
        for img in images:
            save_path = os.path.join(tmp_dir, img.filename)
            img.save(save_path)
            image_paths.append(save_path)

        # Run conversion
        try:
            output_dir = os.path.join("output", str(uuid.uuid4()))
            os.makedirs(output_dir, exist_ok=True)

            converter = Local2DTo3DConverter(self.logger, self.config)
            model_path = converter.convert(image_paths, output_dir)

            return jsonify({
                "message": "3D model generated",
                "model_url": f"/api/output/{os.path.basename(output_dir)}/{os.path.basename(model_path)}"
            })

        except Exception as e:
            self.logger.error(f"Conversion failed: {e}", exc_info=True)
            return jsonify({"error": str(e)}), 500
