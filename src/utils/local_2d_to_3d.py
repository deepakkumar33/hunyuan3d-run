import os
import logging
import uuid
from hy3dgen.shapegen import Hunyuan3DDiTPipeline

class Local2DTo3DConverter:
    def __init__(self, logger=None, config=None):
        self.logger = logger or logging.getLogger(__name__)
        self.config = config
        self.pipeline = None
        self._load_pipeline()

    def _load_pipeline(self):
        model_dir = self.config.get("model_dir") if self.config else "./models/hunyuan3d-dit-v2-0"
        ckpt_file = os.path.join(model_dir, "model.fp16.ckpt")
        config_file = os.path.join(model_dir, "config.yaml")

        if not os.path.exists(ckpt_file) or not os.path.exists(config_file):
            raise RuntimeError(f"Missing checkpoint or config in {model_dir}")

        self.logger.info(f"Loading pipeline from ckpt: {ckpt_file}, config: {config_file}")

        try:
            self.pipeline = Hunyuan3DDiTPipeline.from_single_file(
                ckpt_path=ckpt_file,
                config_path=config_file
            )
            self.logger.info("Pipeline loaded successfully")
        except Exception as e:
            self.logger.error(f"Failed to load pipeline: {e}", exc_info=True)
            raise RuntimeError("Pipeline could not be loaded. Conversion impossible.") from e

    def convert(self, image_paths, output_dir):
        if self.pipeline is None:
            raise RuntimeError("Pipeline not loaded")

        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, f"{uuid.uuid4()}.obj")

        try:
            self.pipeline.generate_from_images(image_paths, save_path=output_path)
            self.logger.info(f"3D model saved to {output_path}")
            return output_path
        except Exception as e:
            self.logger.error(f"Conversion failed: {e}", exc_info=True)
            raise RuntimeError("Conversion failed")
