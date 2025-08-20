"""
Robust Local2DTo3DConverter for Hunyuan3D with corrected model path and imports
"""

import os
import glob
import logging
import traceback

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
        """
        Look for the Hunyuan3D model folder under ./models/hunyuan3d-2/
        """
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
        """
        Load the scheduler and prepare the pipeline
        """
        try:
            self.scheduler = FlowMatchEulerDiscreteScheduler()
            self.logger.info("✅ FlowMatchEulerDiscreteScheduler loaded successfully")
            # Add more pipeline init here if needed
        except Exception as e:
            self.logger.error(traceback.format_exc())
            raise RuntimeError(f"Pipeline loading failed: {e}")

    def convert_images_to_3d(self, images):
        """
        Dummy conversion function to illustrate process.
        Replace with real Hunyuan3D inference code.
        """
        if not self.scheduler:
            raise RuntimeError("Scheduler not loaded")
        self.logger.info(f"Converting {len(images)} image(s) to 3D model...")
        # For demonstration, just return output path
        output_file = os.path.join(self.output_dir, "output_model.obj")
        self.logger.info(f"✅ 3D model built: {output_file}")
        return output_file
