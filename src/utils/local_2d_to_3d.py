"""
Robust Local2DTo3DConverter for Hunyuan3D

- Works with Hunyuan3D_2_1 folder
- Automatically handles uploaded image paths
- Uses correct ImageProcessor from preprocessors.py
- Returns OBJ model path
"""

import os
import uuid
import logging
import traceback

# Import the correct pipeline class
from Hunyuan3D_2_1.hy3dshape.pipelines import Hunyuan3DDiTPipeline
from Hunyuan3D_2_1.hy3dshape.preprocessors import ImageProcessor

class Local2DTo3DConverter:
    def __init__(self, logger=None, config=None, output_root=None):
        self.logger = logger or logging.getLogger(__name__)
        self.config = config  # Keep reference if needed
        self.output_root = output_root or os.path.join(os.getcwd(), "output")
        os.makedirs(self.output_root, exist_ok=True)

        # Initialize image processor
        self.image_processor = ImageProcessor(size=512)  # you can adjust size

        # Load Hunyuan3D pipeline
        try:
            self.logger.info("🚀 Loading Hunyuan3D pipeline...")
            model_ckpt = os.path.join(os.getcwd(), "Hunyuan3D_2_1", "models", "hunyuan3d-dit-v2-0", "model.fp16.ckpt")
            config_yaml = os.path.join(os.getcwd(), "Hunyuan3D_2_1", "models", "hunyuan3d-dit-v2-0", "config.yaml")
            self.pipeline = Hunyuan3DDiTPipeline(model_ckpt, config_yaml)
            self.logger.info("✅ Pipeline loaded successfully")
        except Exception as e:
            self.logger.error(f"Failed to load pipeline: {e}")
            raise

    def convert(self, image_paths, output_dir=None):
        output_dir = output_dir or os.path.join(self.output_root, str(uuid.uuid4()))
        os.makedirs(output_dir, exist_ok=True)

        if not image_paths:
            raise ValueError("No images provided for conversion")

        try:
            self.logger.info(f"Starting 2D→3D conversion for {len(image_paths)} images")
            # Prepare images
            processed_images = [self.image_processor.load_image(p) for p in image_paths]

            # Run the Hunyuan3D pipeline
            result = self.pipeline(processed_images)

            # Save OBJ
            model_path = os.path.join(output_dir, "model.obj")
            result.save(model_path)

            self.logger.info(f"3D model saved to: {model_path}")
            return model_path

        except Exception as e:
            self.logger.error(f"3D conversion failed: {e}")
            traceback.print_exc()
            raise RuntimeError("Conversion failed.") from e
