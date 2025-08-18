"""
Local 2D -> 3D converter utility
"""

import os
import logging
from hy3dgen.shapegen import Hunyuan3DDiTPipeline  # ensure installed
from pathlib import Path

class Local2DTo3DConverter:
    def __init__(self, logger: logging.Logger, config: dict):
        self.logger = logger
        self.config = config
        self.pipeline = None
        self._load_pipeline()

    def _load_pipeline(self):
        """
        Load the Hunyuan3D pipeline from the model path specified in config
        """
        model_name = self.config.get("model_name")
        if not model_name:
            raise ValueError("❌ 'model_name' missing in config.json")

        # construct full path to checkpoint and config
        model_base = Path("/root/hunyuan3d-run/models") / model_name
        ckpt_file = model_base / "model.fp16.ckpt"
        cfg_file = model_base / "config.yaml"

        if not ckpt_file.is_file():
            raise FileNotFoundError(f"❌ Checkpoint not found: {ckpt_file}")
        if not cfg_file.is_file():
            raise FileNotFoundError(f"❌ Config YAML not found: {cfg_file}")

        self.logger.info(f"✅ Using model checkpoint: {ckpt_file}")
        self.logger.info(f"✅ Using model config: {cfg_file}")

        try:
            # load the pipeline (new Hunyuan3D API requires ckpt_path positional arg)
            self.pipeline = Hunyuan3DDiTPipeline.from_single_file(
                ckpt_path=str(ckpt_file),
                config_path=str(cfg_file),
            )
            self.logger.info("✅ Hunyuan3D pipeline loaded successfully")
        except Exception as e:
            self.logger.error(f"Failed to load pipeline: {e}", exc_info=True)
            raise RuntimeError("Pipeline could not be loaded. Conversion impossible.") from e

    def convert(self, image_paths, output_dir):
        """
        Convert list of images to a 3D model file.
        Returns the path to the generated model.
        """
        if not self.pipeline:
            raise RuntimeError("Pipeline not loaded. Cannot convert images.")

        os.makedirs(output_dir, exist_ok=True)
        output_filename = self.config.get("output_filename", "model.obj")
        output_format = self.config.get("output_format", "obj")
        output_path = os.path.join(output_dir, output_filename)

        self.logger.info(f"Starting 2D->3D conversion for {len(image_paths)} images")
        self.logger.info(f"Output will be saved as: {output_path}")

        try:
            # call pipeline (depends on API, adapt if different)
            self.pipeline.generate(
                input_images=image_paths,
                output_path=output_path,
                output_format=output_format
            )
        except Exception as e:
            self.logger.error(f"3D conversion failed: {e}", exc_info=True)
            raise RuntimeError("Conversion failed.") from e

        self.logger.info(f"✅ 3D model generated successfully at {output_path}")
        return output_path
