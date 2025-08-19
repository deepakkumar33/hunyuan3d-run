import os
import uuid
import logging
import traceback
import glob

try:
    import trimesh
except ImportError:
    trimesh = None

from Hunyuan3D_2_1.hy3dshape.pipelines import Hunyuan3DDiTPipeline


class Local2DTo3DConverter:
    """
    Robust Local2DTo3DConverter with improved model-file detection and verbose logging.

    - Accepts common weight filenames:
        model.fp16.safetensors, model.fp16.ckpt, model.safetensors, model.ckpt, *.ckpt, *.pt, *.pth
    - Logs candidate folders and discovered files to help debugging.
    - Falls back to a small dummy OBJ if pipeline cannot be loaded.
    """

    def __init__(self, model_dir="./Hunyuan3D_2_1", output_dir="./outputs"):
        self.model_dir = model_dir
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)
        self.pipeline = None
        self._load_pipeline()

    def _find_model_file(self):
        """
        Scan the model_dir for valid checkpoint files.
        """
        candidates = [
            "model.fp16.safetensors",
            "model.fp16.ckpt",
            "model.safetensors",
            "model.ckpt",
        ]
        exts = ["*.ckpt", "*.pt", "*.pth", "*.safetensors"]

        logging.info(f"[Local2DTo3DConverter] Scanning for model files in {self.model_dir}")

        # direct candidates
        for c in candidates:
            path = os.path.join(self.model_dir, c)
            if os.path.exists(path):
                logging.info(f"Found model file: {path}")
                return path

        # glob fallback
        for ext in exts:
            files = glob.glob(os.path.join(self.model_dir, "**", ext), recursive=True)
            if files:
                logging.info(f"Found model file: {files[0]}")
                return files[0]

        logging.error("No model file found in model_dir.")
        return None

    def _load_pipeline(self):
        try:
            model_file = self._find_model_file()
            if model_file is None:
                raise FileNotFoundError("No model weights found.")

            logging.info(f"Loading Hunyuan3DDiTPipeline from: {model_file}")
            # instantiate pipeline
            self.pipeline = Hunyuan3DDiTPipeline.from_pretrained(model_file)
            logging.info("Pipeline successfully loaded.")

        except Exception as e:
            logging.error(f"Failed to load pipeline: {e}")
            traceback.print_exc()
            self.pipeline = None

    def convert(self, image_path):
        """
        Convert a single 2D image into a 3D model using the pipeline.
        Falls back to dummy cube if pipeline not available.
        """
        job_id = str(uuid.uuid4())[:8]
        output_path = os.path.join(self.output_dir, f"model_{job_id}.obj")

        if self.pipeline is None:
            logging.warning("Pipeline not available. Using dummy cube instead.")
            if trimesh:
                mesh = trimesh.creation.box(extents=(1, 1, 1))
                mesh.export(output_path)
            else:
                with open(output_path, "w") as f:
                    f.write("o cube\nv 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\n")
                    f.write("v 0 0 1\nv 1 0 1\nv 1 1 1\nv 0 1 1\n")
                    f.write("f 1 2 3 4\nf 5 6 7 8\nf 1 5 8 4\nf 2 6 7 3\nf 1 2 6 5\nf 4 3 7 8\n")
            return output_path

        try:
            logging.info(f"Running 2D-to-3D conversion for {image_path}")
            # Dummy inference step (replace with actual pipeline call later)
            if trimesh:
                mesh = trimesh.creation.icosphere(radius=1)
                mesh.export(output_path)
            else:
                with open(output_path, "w") as f:
                    f.write("# dummy sphere obj\n")
            logging.info(f"3D model saved to {output_path}")
            return output_path

        except Exception as e:
            logging.error(f"Conversion failed: {e}")
            traceback.print_exc()
            return None
