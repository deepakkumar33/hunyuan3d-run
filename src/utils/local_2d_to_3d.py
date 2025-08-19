"""
Robust Local2DTo3DConverter for Hunyuan3D v2.1 with ImageProcessorV2.

- Accepts common image formats (jpg, png).
- Saves 3D model to output folder.
- Returns full path to generated .obj file.
"""

import os
import uuid
import logging
import traceback

import torch
from Hunyuan3D_2_1.hy3dshape.pipelines import Hunyuan3DDiTPipeline
from Hunyuan3D_2_1.hy3dshape.preprocessors import ImageProcessorV2

class Local2DTo3DConverter:
    def __init__(self, logger, config):
        """
        logger: your logger instance
        config: dict or object with config parameters (not used in this minimal version)
        """
        self.logger = logger
        self.config = config
        self.image_processor = ImageProcessorV2(size=512)
        self.pipeline = None
        self._load_pipeline()

    def _load_pipeline(self):
        try:
            # Adjust model path according to your local setup
            model_ckpt = os.path.join(
                "Hunyuan3D_2_1", "models", "hunyuan3d-2", "hunyuan3d-dit-v2-0", "model.fp16.ckpt"
            )
            config_yaml = os.path.join(
                "Hunyuan3D_2_1", "models", "hunyuan3d-2", "hunyuan3d-dit-v2-0", "config.yaml"
            )
            self.logger.info(f"✅ Loading Hunyuan3D pipeline from checkpoint: {model_ckpt}")
            self.pipeline = Hunyuan3DDiTPipeline(model_ckpt, config_yaml, device="cuda")
            self.logger.info("✅ Pipeline loaded successfully")
        except Exception as e:
            self.logger.error(f"Failed to load pipeline: {e}")
            traceback.print_exc()
            raise RuntimeError("Pipeline loading failed")

    def convert(self, image_paths, output_dir):
        """
        image_paths: list of file paths
        output_dir: directory where .obj will be saved
        """
        if not self.pipeline:
            raise RuntimeError("Pipeline not loaded")

        os.makedirs(output_dir, exist_ok=True)

        processed_images = []
        for img_path in image_paths:
            if not os.path.exists(img_path):
                self.logger.warning(f"Image not found: {img_path}, skipping")
                continue
            try:
                # Use ImageProcessorV2 to load and preprocess
                img, _ = self.image_processor.load_image(img_path, to_tensor=True)
                processed_images.append(img)
            except Exception as e:
                self.logger.error(f"Failed to process {img_path}: {e}")

        if not processed_images:
            raise RuntimeError("No valid images to process")

        self.logger.info(f"Starting 2D->3D conversion for {len(processed_images)} images")
        try:
            # The pipeline expects list of images
            result = self.pipeline(processed_images)
            output_obj = os.path.join(output_dir, f"model_{uuid.uuid4().hex}.obj")
            result.save(output_obj)  # pipeline should have .save() method for obj
            self.logger.info(f"3D model saved at {output_obj}")
            return output_obj
        except Exception as e:
            self.logger.error(f"3D conversion failed: {e}")
            traceback.print_exc()
            raise RuntimeError("Conversion failed")
