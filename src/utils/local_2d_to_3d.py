"""
Robust Local2DTo3DConverter for Hunyuan3D

- Automatically detects available model folder under Hunyuan3D_2_1/models/hunyuan3d-2/
- Uses FlowMatchEulerDiscreteScheduler as scheduler
- Provides verbose logging for debugging
"""

import os
import glob
import logging
import traceback

import torch
import numpy as np

# Import correct scheduler classes
try:
    from Hunyuan3D_2_1.hy3dshape.schedulers import FlowMatchEulerDiscreteScheduler, ConsistencyFlowMatchEulerDiscreteScheduler
except Exception as e:
    raise ImportError(f"Failed to import Hunyuan3D modules: {e}")

logger = logging.getLogger(__name__)

class Local2DTo3DConverter:
    def __init__(self, logger=None, output_dir="output"):
        self.logger = logger or logging.getLogger(__name__)
        self.output_dir = output_dir
        self.model_folder = None
        self.pipeline = None

        os.makedirs(self.output_dir, exist_ok=True)

        self._load_pipeline()

    def _find_model_folder(self):
        # look for any folder with config.yaml and model.fp16.ckpt
        base_path = "Hunyuan3D_2_1/models/hunyuan3d-2/"
        candidates = glob.glob(os.path.join(base_path, "*"))
        for folder in candidates:
            if os.path.isdir(folder):
                cfg = os.path.join(folder, "config.yaml")
                ckpt = os.path.join(folder, "model.fp16.ckpt")
                if os.path.isfile(cfg) and os.path.isfile(ckpt):
                    return folder
        return None

    def _load_pipeline(self):
        self.logger.info("🔍 Searching for Hunyuan3D model folder...")
        self.model_folder = self._find_model_folder()
        if not self.model_folder:
            self.logger.error("No valid model folder found under Hunyuan3D_2_1/models/hunyuan3d-2/")
            raise RuntimeError("Pipeline loading failed: model folder not found")

        config_yaml = os.path.join(self.model_folder, "config.yaml")
        ckpt_path = os.path.join(self.model_folder, "model.fp16.ckpt")

        if not os.path.isfile(config_yaml) or not os.path.isfile(ckpt_path):
            self.logger.error(f"Required files missing in {self.model_folder}")
            raise RuntimeError("Pipeline loading failed: config.yaml or model checkpoint missing")

        self.logger.info(f"✅ Loading Hunyuan3D pipeline from folder: {self.model_folder}")
        # Here you would normally initialize your Hunyuan3D pipeline
        # For example:
        # self.pipeline = Hunyuan3DPipeline(config_yaml=config_yaml, checkpoint=ckpt_path, scheduler=FlowMatchEulerDiscreteScheduler)
        # For now, we just log for debugging
        self.pipeline = {"config": config_yaml, "checkpoint": ckpt_path, "scheduler": FlowMatchEulerDiscreteScheduler}

    def convert_images(self, image_paths):
        if not self.pipeline:
            raise RuntimeError("Pipeline is not loaded")
        self.logger.info(f"Converting {len(image_paths)} image(s) using model {self.model_folder}")
        # Dummy output
        results = []
        for img in image_paths:
            # Implement real conversion here
            output_path = os.path.join(self.output_dir, os.path.basename(img).replace(".png", ".obj"))
            self.logger.info(f"Generated dummy OBJ for {img} -> {output_path}")
            results.append(output_path)
        return results
