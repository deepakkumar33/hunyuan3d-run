"""
Robust Local2DTo3DConverter for Hunyuan3D 2.1
- Properly initializes pipeline with scheduler, conditioner, and image_processor
- Handles uploaded images and outputs 3D model files
"""

import os
import glob
import logging
import torch

from Hunyuan3D_2_1.hy3dshape.pipelines import Hunyuan3DDiTPipeline
from Hunyuan3D_2_1.hy3dshape.schedulers import Scheduler
from Hunyuan3D_2_1.hy3dshape.conditioners import Conditioner
from Hunyuan3D_2_1.hy3dshape.preprocessors import ImageProcessorV2


class Local2DTo3DConverter:
    def __init__(self, logger: logging.Logger, output_dir: str):
        self.logger = logger
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.pipeline = None
        self._load_pipeline()

    def _load_pipeline(self):
        try:
            model_ckpt = os.path.join(
                "Hunyuan3D_2_1/models/hunyuan3d-2/hunyuan3d-dit-v2-0",
                "model.fp16.ckpt"
            )
            config_yaml = os.path.join(
                "Hunyuan3D_2_1/models/hunyuan3d-2/hunyuan3d-dit-v2-0",
                "config.yaml"
            )

            self.logger.info(f"✅ Loading Hunyuan3D pipeline from checkpoint: {model_ckpt}")

            # Initialize scheduler, conditioner, and image processor
            scheduler = Scheduler(config_yaml)
            conditioner = Conditioner(config_yaml)
            image_processor = ImageProcessorV2(size=512)

            self.pipeline = Hunyuan3DDiTPipeline(
                model_ckpt,
                config_yaml,
                scheduler=scheduler,
                conditioner=conditioner,
                image_processor=image_processor,
                device=self.device
            )

            self.logger.info("Pipeline loaded successfully!")

        except Exception as e:
            self.logger.error(f"Failed to load pipeline: {e}", exc_info=True)
            raise RuntimeError("Pipeline loading failed") from e

    def convert(self, image_paths, output_dir=None):
        """
        Convert list of 2D images to a 3D model
        """
        if output_dir is None:
            output_dir = self.output_dir

        try:
            self.logger.info(f"Converting {len(image_paths)} image(s) to 3D model...")

            # Run the pipeline on all images
            model_file = os.path.join(output_dir, "output_model.obj")
            self.pipeline.run(image_paths, save_path=model_file)

            if not os.path.exists(model_file):
                raise FileNotFoundError(f"Pipeline did not generate model: {model_file}")

            self.logger.info(f"3D model successfully generated: {model_file}")
            return model_file

        except Exception as e:
            self.logger.error(f"Conversion failed: {e}", exc_info=True)
            raise
