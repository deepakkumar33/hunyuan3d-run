# src/api/convert_api.py
import os
import tempfile
import uuid
import shutil
import threading
from flask import Blueprint, request, jsonify, send_file, current_app

from src.utils.local_2d_to_3d import Local2DTo3DConverter

class ConvertAPI:
    def __init__(self, logger, output_root):
        self.logger = logger
        self.output_root = output_root  # path where all outputs are stored
        self.blueprint = Blueprint("api", __name__)
        self.jobs = {}  # in-memory job status store: job_id -> dict(status, model_path, error)
        self.add_routes()

    def add_routes(self):
        @self.blueprint.route("/convert", methods=["POST"])
        def convert_route():
            # Validate request
            if not request.files or "images" not in request.files:
                self.logger.warning("Convert called without images")
                return jsonify({"error": "Missing images in request"}), 400

            images = request.files.getlist("images")
            if not images:
                self.logger.warning("No images provided in convert request")
                return jsonify({"error": "No images provided"}), 400

            self.logger.info(f"Received {len(images)} image(s) for conversion")

            # Save images to a temporary dir (we'll move/clean later)
            tmp_dir = tempfile.mkdtemp(prefix="upload_")
            image_paths = []
            try:
                for img in images:
                    save_path = os.path.join(tmp_dir, img.filename)
                    img.save(save_path)
                    image_paths.append(save_path)
            except Exception as e:
                shutil.rmtree(tmp_dir, ignore_errors=True)
                self.logger.error(f"Failed saving upload: {e}", exc_info=True)
                return jsonify({"error": "Failed to save uploaded images"}), 500

            # Create job
            job_id = str(uuid.uuid4())
            output_dir = os.path.join(self.output_root, job_id)
            os.makedirs(output_dir, exist_ok=True)

            # initialize job meta
            self.jobs[job_id] = {
                "status": "queued",
                "progress": 0,
                "model_path": None,
                "error": None,
            }

            # Start background thread for conversion
            thread = threading.Thread(
                target=self._run_conversion,
                args=(job_id, image_paths, output_dir, tmp_dir),
                daemon=True,
            )
            thread.start()

            # Return immediately with job id and polling URL
            status_url = f"/api/status/{job_id}"
            model_url = f"/output/{job_id}/generated_model.obj"
            self.logger.info(f"Started job {job_id}, status_url={status_url}")
            return jsonify({
                "job_id": job_id,
                "status_url": status_url,
                "model_url": model_url,
                "message": "Job started"
            }), 202

        @self.blueprint.route("/status/<job_id>", methods=["GET"])
        def job_status(job_id):
            job = self.jobs.get(job_id)
            if not job:
                return jsonify({"error": "Job not found"}), 404
            # Return minimal information (don't expose server paths)
            return jsonify({
                "job_id": job_id,
                "status": job.get("status"),
                "progress": job.get("progress"),
                "model_url": f"/output/{job_id}/{os.path.basename(job.get('model_path'))}" if job.get("model_path") else None,
                "error": job.get("error")
            })

        @self.blueprint.route("/output/<job_id>/<path:filename>", methods=["GET", "HEAD"])
        def serve_model(job_id, filename):
            # Serve files from output/<job_id> folder
            filepath = os.path.join(self.output_root, job_id, filename)
            if not os.path.exists(filepath):
                self.logger.warning(f"Requested model not found: {filepath}")
                return jsonify({"error": "File not found"}), 404
            # Serve inline (not forced download) so viewer can fetch easily
            return send_file(filepath, as_attachment=False, conditional=True)

    def _run_conversion(self, job_id, image_paths, output_dir, tmp_dir):
        """
        Performs the heavy conversion work in background.
        Updates self.jobs[job_id] status and removes temporary upload folder when done.
        """
        try:
            self.jobs[job_id]["status"] = "running"
            self.jobs[job_id]["progress"] = 0
            self.logger.info(f"Job {job_id}: conversion started (background thread)")

            # Create converter and run conversion (this is blocking and may take many minutes)
            converter = Local2DTo3DConverter(self.logger, output_dir)

            # Optionally: update progress in converter if it supports callbacks (not required here)
            model_path = converter.convert(image_paths, output_dir)

            # If convert returns a path, store it
            if model_path and os.path.exists(model_path):
                self.jobs[job_id]["status"] = "finished"
                self.jobs[job_id]["model_path"] = model_path
                self.jobs[job_id]["progress"] = 100
                self.logger.info(f"Job {job_id}: conversion finished -> {model_path}")
            else:
                self.jobs[job_id]["status"] = "failed"
                self.jobs[job_id]["error"] = "Conversion completed but model file missing"
                self.logger.error(f"Job {job_id}: model file missing after conversion")

        except Exception as e:
            self.logger.error(f"Job {job_id}: conversion error: {e}", exc_info=True)
            self.jobs[job_id]["status"] = "failed"
            self.jobs[job_id]["error"] = str(e)

        finally:
            # Clean up temporary upload folder
            try:
                shutil.rmtree(tmp_dir, ignore_errors=True)
            except Exception:
                pass
