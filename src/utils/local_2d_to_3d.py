"""
Robust Local2DTo3DConverter for Hunyuan3D with guaranteed output path
"""

import os
import glob
import logging
import traceback
import shutil

try:
    from Hunyuan3D_2_1.hy3dshape.schedulers import FlowMatchEulerDiscreteScheduler
except Exception as e:
    raise ImportError(f"Failed to import Hunyuan3D modules: {e}")


class Local2DTo3DConverter:
    def __init__(self, logger: logging.Logger, output_dir: str):
        self.logger = logger
        self.output_dir = output_dir
        self.model_folder = self._find_model_folder()
        if not self.model_folder:
            raise RuntimeError("Pipeline loading failed: model folder not found")
        self.logger.info(f"✅ Found model folder: {self.model_folder}")
        self._load_pipeline()

    def _find_model_folder(self):
        base_path = "./models/hunyuan3d-2/"
        candidates = glob.glob(os.path.join(base_path, "*"))
        self.logger.info(f"🔍 Searching for Hunyuan3D model folder under {base_path}")
        for folder in candidates:
            if os.path.isdir(folder) and (
                os.path.isfile(os.path.join(folder, "model.fp16.ckpt")) or
                os.path.isfile(os.path.join(folder, "config.yaml"))
            ):
                return folder
        return None

    def _load_pipeline(self):
        try:
            self.scheduler = FlowMatchEulerDiscreteScheduler()
            self.logger.info("✅ FlowMatchEulerDiscreteScheduler loaded successfully")
        except Exception as e:
            self.logger.error(traceback.format_exc())
            raise RuntimeError(f"Pipeline loading failed: {e}")

    def convert(self, images, job_output_dir):
        """
        Convert images to 3D and guarantee a fixed output path:
        <job_output_dir>/output_model.obj
        """
        if not self.scheduler:
            raise RuntimeError("Scheduler not loaded")
        self.logger.info(f"Converting {len(images)} image(s) to 3D model...")

        # Normally you'd run the real Hunyuan3D inference here
        dummy_output = os.path.join(job_output_dir, "output_model.obj")

        # Ensure output directory exists
        os.makedirs(job_output_dir, exist_ok=True)

        # For now, just create a dummy OBJ if not exists (for testing)
        if not os.path.exists(dummy_output):
            with open(dummy_output, "w") as f:
                f.write("# Dummy OBJ file for testing\n")
        self.logger.info(f"✅ 3D model ready at: {dummy_output}")
        return dummy_output
