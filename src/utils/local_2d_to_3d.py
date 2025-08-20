"""
Robust Local2DTo3DConverter with fixed model folder detection
for your Hunyuan3D setup.
"""

import os
import glob
import logging
import traceback

try:
    from Hunyuan3D_2_1.hy3dshape.conditioners import ConditionerV2
    from Hunyuan3D_2_1.hy3dshape.schedulers import FlowMatchEulerDiscreteScheduler
except Exception as e:
    raise ImportError(f"Failed to import Hunyuan3D modules: {e}")


logger = logging.getLogger(__name__)


class Local2DTo3DConverter:
    def __init__(self, logger, output_dir):
        self.logger = logger
        self.output_dir = output_dir
        self.model_folder = None
        self.pipeline = None
        self._load_pipeline()

    def _find_model_folder(self):
        """
        Correctly finds the model folder for your setup.
        """
        base_path = "models/hunyuan3d-2/"
        candidates = glob.glob(os.path.join(base_path, "*"))
        for folder in candidates:
            if os.path.isdir(folder):
                cfg = os.path.join(folder, "config.yaml")
                ckpt = os.path.join(folder, "model.fp16.ckpt")
                if os.path.isfile(cfg) and os.path.isfile(ckpt):
                    logger.info(f"Found model folder: {folder}")
                    return folder
        return None

    def _load_pipeline(self):
        """
        Load Hunyuan3D pipeline using found model folder.
        """
        self.logger.info("🔍 Searching for Hunyuan3D model folder...")
        self.model_folder = self._find_model_folder()
        if not self.model_folder:
            self.logger.error("No valid model folder found under models/hunyuan3d-2/")
            raise RuntimeError("Pipeline loading failed: model folder not found")

        # Example: initialize scheduler (adapt if pipeline API differs)
        try:
            self.pipeline = {
                "scheduler": FlowMatchEulerDiscreteScheduler()
                # Add more pipeline initialization if required
            }
            self.logger.info(f"✅ Pipeline loaded from {self.model_folder}")
        except Exception as e:
            self.logger.error(f"Pipeline initialization failed: {e}")
            traceback.print_exc()
            raise RuntimeError(f"Pipeline loading failed: {e}")

    def convert_images(self, images):
        """
        Dummy example method: replace with actual 2D→3D logic.
        """
        if self.pipeline is None:
            raise RuntimeError("Pipeline not loaded")
        self.logger.info(f"Converting {len(images)} image(s) to 3D models...")
        # TODO: actual conversion code
        return ["dummy_model.obj" for _ in images]
