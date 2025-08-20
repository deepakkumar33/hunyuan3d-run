"""
Robust Local2DTo3DConverter that automatically finds the Hunyuan3D model folder,
handles pipeline loading, and converts 2D images to 3D models.
"""

import os
import glob
import uuid
import logging

# Import Hunyuan3D classes
try:
    from Hunyuan3D_2_1.hy3dshape.pipelines import Hunyuan3DDiTPipeline
    from Hunyuan3D_2_1.hy3dshape.preprocessors import ImageProcessorV2
    from Hunyuan3D_2_1.hy3dshape.conditioners import ConditionerV2
    from Hunyuan3D_2_1.hy3dshape.schedulers import DITSchedulerV2
except ImportError as e:
    raise ImportError(f"Failed to import Hunyuan3D modules: {e}")

class Local2DTo3DConverter:
    def __init__(self, logger: logging.Logger, output_dir: str):
        self.logger = logger
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)
        self.pipeline = None
        self._load_pipeline()

    def _load_pipeline(self):
        self.logger.info("🔍 Searching for Hunyuan3D model folder...")

        base_model_dir = "Hunyuan3D_2_1/models/hunyuan3d-2/"
        # Find the first folder containing both model.ckpt and config.yaml
        candidates = [
            d for d in glob.glob(os.path.join(base_model_dir, "*"))
            if os.path.isdir(d) and
               os.path.isfile(os.path.join(d, "model.fp16.ckpt")) and
               os.path.isfile(os.path.join(d, "config.yaml"))
        ]

        if not candidates:
            self.logger.error(f"No valid model folder found under {base_model_dir}")
            raise RuntimeError("Pipeline loading failed: model folder not found")

        model_folder = candidates[0]
        self.logger.info(f"✅ Found model folder: {model_folder}")

        model_ckpt = os.path.join(model_folder, "model.fp16.ckpt")
        config_yaml = os.path.join(model_folder, "config.yaml")

        try:
            # Instantiate the pipeline with proper arguments
            scheduler = DITSchedulerV2()
            conditioner = ConditionerV2()
            image_processor = ImageProcessorV2()

            self.pipeline = Hunyuan3DDiTPipeline(
                model_ckpt=model_ckpt,
                config_yaml=config_yaml,
                device="cuda",
                scheduler=scheduler,
                conditioner=conditioner,
                image_processor=image_processor
            )
            self.logger.info("✅ Hunyuan3D pipeline loaded successfully")

        except Exception as e:
            self.logger.error(f"Failed to load pipeline: {e}", exc_info=True)
            raise RuntimeError("Pipeline loading failed") from e

    def convert(self, image_paths, output_dir):
        """
        Convert a list of image paths into a single 3D model file.
        Returns the full path to the generated model.
        """
        if self.pipeline is None:
            raise RuntimeError("Pipeline is not loaded")

        # Generate a unique filename
        model_filename = f"{uuid.uuid4()}.obj"
        model_path = os.path.join(output_dir, model_filename)

        self.logger.info(f"Starting 2D->3D conversion for {len(image_paths)} images")
        try:
            self.pipeline.run(images=image_paths, output_path=model_path)
            self.logger.info(f"3D model saved to {model_path}")
        except Exception as e:
            self.logger.error(f"Conversion failed: {e}", exc_info=True)
            raise RuntimeError("Conversion failed") from e

        return model_path
