"""
Local2DTo3DConverter
- Loads Hunyuan3D pipeline from checkpoint
- Converts a set of images into a 3D model
"""

import os
import glob
import logging

# Attempt to import Hunyuan3D modules
try:
    from Hunyuan3D_2_1.hy3dshape.pipelines import Hunyuan3DDiTPipeline
    from Hunyuan3D_2_1.hy3dshape.schedulers import DITSchedulerV2
    from Hunyuan3D_2_1.hy3dshape.conditioners import ConditionerV2
    from Hunyuan3D_2_1.hy3dshape.preprocessors import ImageProcessorV2
except Exception as e:
    raise ImportError(f"Failed to import Hunyuan3D modules: {e}")

class Local2DTo3DConverter:
    def __init__(self, logger: logging.Logger, output_dir: str):
        self.logger = logger
        self.output_dir = output_dir
        self.pipeline = None
        self._load_pipeline()

    def _load_pipeline(self):
        """
        Load the Hunyuan3D pipeline from the correct model folder.
        Adjust the path below to the existing folder.
        """
        try:
            # <-- UPDATE THIS PATH TO EXISTING MODEL FOLDER -->
            model_ckpt = "./models/hunyuan3d-2/hunyuan3d-dit-v2-0/model.fp16.ckpt"
            config_yaml = "./models/hunyuan3d-2/hunyuan3d-dit-v2-0/config.yaml"

            if not os.path.exists(model_ckpt) or not os.path.exists(config_yaml):
                self.logger.error(f"Model checkpoint or config not found: {model_ckpt}, {config_yaml}")
                raise FileNotFoundError("Pipeline model files not found")

            # Load the pipeline
            self.logger.info(f"✅ Loading Hunyuan3D pipeline from checkpoint: {model_ckpt}")
            
            image_processor = ImageProcessorV2(size=512)
            scheduler = DITSchedulerV2()         # Initialize with default parameters
            conditioner = ConditionerV2()        # Initialize with default parameters

            self.pipeline = Hunyuan3DDiTPipeline(
                model_ckpt,
                config_yaml,
                scheduler=scheduler,
                conditioner=conditioner,
                image_processor=image_processor,
                device="cuda"
            )

        except Exception as e:
            self.logger.error(f"Failed to load pipeline: {e}", exc_info=True)
            raise RuntimeError("Pipeline loading failed") from e

    def convert(self, image_paths, output_dir):
        """
        Convert images to 3D model and save OBJ.
        """
        if self.pipeline is None:
            raise RuntimeError("Pipeline not loaded")

        # Call the pipeline convert function (adjust API if needed)
        try:
            self.logger.info(f"Starting conversion for {len(image_paths)} images...")
            model_path = os.path.join(output_dir, "output.obj")
            os.makedirs(output_dir, exist_ok=True)

            # Example pipeline call — adjust based on actual Hunyuan3DDiTPipeline API
            self.pipeline.run(image_paths, save_path=model_path)

            self.logger.info(f"3D model saved at: {model_path}")
            return model_path

        except Exception as e:
            self.logger.error(f"Conversion failed: {e}", exc_info=True)
            raise
