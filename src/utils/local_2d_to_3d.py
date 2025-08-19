"""
Local 2D -> 3D converter wrapper for Hunyuan3D pipeline.

- Accepts a list of image paths
- Saves 3D model to specified output directory
"""

import os
import logging
import uuid
from Hunyuan3D_2_1.hy3dshape.pipelines import Hunyuan3DDiTPipeline
from Hunyuan3D_2_1.hy3dshape.preprocessors import Preprocessor

class Local2DTo3DConverter:
    def __init__(self, logger: logging.Logger, output_root: str):
        """
        :param logger: Python logger
        :param output_root: str path where all output models will be saved
        """
        self.logger = logger
        self.output_root = output_root
        os.makedirs(self.output_root, exist_ok=True)

        # load Hunyuan3D pipeline
        model_ckpt = os.path.join("models", "hunyuan3d-2", "hunyuan3d-dit-v2-0", "model.fp16.ckpt")
        config_path = os.path.join("models", "hunyuan3d-2", "hunyuan3d-dit-v2-0", "config.yaml")

        self.logger.info(f"✅ Using model checkpoint: {model_ckpt}")
        self.logger.info(f"✅ Using model config: {config_path}")

        try:
            self.pipeline = Hunyuan3DDiTPipeline.from_pretrained(
                model_ckpt,
                config=config_path,
                device="cuda"
            )
            self.logger.info("✅ Hunyuan3D pipeline loaded successfully")
        except Exception as e:
            self.logger.error(f"Failed to load pipeline: {e}", exc_info=True)
            raise RuntimeError("Pipeline loading failed") from e

        self.preprocessor = Preprocessor(size=512)  # make sure input images are resized correctly

    def convert(self, image_paths, output_dir=None):
        """
        Convert list of image paths to a single 3D model.
        :param image_paths: list[str]
        :param output_dir: str, optional. Default uses self.output_root/job_id
        :return: str path to generated OBJ
        """
        if output_dir is None:
            job_id = str(uuid.uuid4())
            output_dir = os.path.join(self.output_root, job_id)
        os.makedirs(output_dir, exist_ok=True)

        self.logger.info(f"Starting 2D->3D conversion for {len(image_paths)} images")
        self.logger.info(f"Output directory: {output_dir}")

        processed_images = []
        for img_path in image_paths:
            if not os.path.exists(img_path):
                self.logger.warning(f"Image not found, skipping: {img_path}")
                continue
            img = self.preprocessor.load_image(img_path)
            if img is None:
                self.logger.warning(f"Image could not be loaded, skipping: {img_path}")
                continue
            processed_images.append(img)

        if not processed_images:
            raise RuntimeError("No valid images to convert")

        try:
            result = self.pipeline(processed_images)
            output_obj_path = os.path.join(output_dir, "model.obj")
            result.save(output_obj_path)
            self.logger.info(f"✅ 3D model saved at: {output_obj_path}")
            return output_obj_path
        except Exception as e:
            self.logger.error(f"3D conversion failed: {e}", exc_info=True)
            raise RuntimeError("Conversion failed") from e
