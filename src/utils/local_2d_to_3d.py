"""
Local 2D -> 3D converter utility (robust multi-image version)
"""

import os
import glob
import logging
from pathlib import Path
from hy3dgen.shapegen import Hunyuan3DDiTPipeline  # ensure installed


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

        model_base = Path("/root/hunyuan3d-run/models") / model_name

        # look for checkpoint files in priority order
        ckpt_candidates = [
            "model.fp16.safetensors",
            "model.fp16.ckpt",
            "model.safetensors",
            "model.ckpt",
            "*.ckpt",
            "*.pt",
            "*.pth",
        ]
        ckpt_file = None
        for pattern in ckpt_candidates:
            matches = list(model_base.glob(pattern))
            if matches:
                ckpt_file = matches[0]
                break

        if not ckpt_file:
            raise FileNotFoundError(
                f"❌ No checkpoint found in {model_base}. Expected one of: {ckpt_candidates}"
            )

        cfg_file = model_base / "config.yaml"
        if not cfg_file.is_file():
            raise FileNotFoundError(f"❌ Config YAML not found: {cfg_file}")

        self.logger.info(f"✅ Using model checkpoint: {ckpt_file}")
        self.logger.info(f"✅ Using model config: {cfg_file}")

        try:
            self.pipeline = Hunyuan3DDiTPipeline.from_single_file(
                ckpt_path=str(ckpt_file),
                config_path=str(cfg_file),
            )
            self.logger.info("✅ Hunyuan3D pipeline loaded successfully")
        except Exception as e:
            self.logger.error(f"Failed to load pipeline: {e}", exc_info=True)
            raise RuntimeError("Pipeline could not be loaded.") from e

    def convert(self, image_paths, output_dir):
        """
        Convert multiple images (front, side, back, etc.) to a 3D model file.
        Returns the path to the generated model.
        """
        if not self.pipeline:
            raise RuntimeError("Pipeline not loaded. Cannot convert images.")

        # ensure all image paths exist
        valid_images = [str(Path(p).resolve()) for p in image_paths if Path(p).is_file()]
        if not valid_images:
            raise ValueError("❌ No valid input images provided.")
        self.logger.info(f"Found {len(valid_images)} valid input images.")

        os.makedirs(output_dir, exist_ok=True)
        output_filename = self.config.get("output_filename", "model.obj")
        output_format = self.config.get("output_format", "obj")
        output_path = os.path.join(output_dir, output_filename)

        self.logger.info(f"🚀 Starting 2D->3D conversion with {len(valid_images)} images")
        self.logger.info(f"Output will be saved as: {output_path}")

        try:
            result = self.pipeline(
                input_images=valid_images,   # multi-image support
                output_path=output_path,
                output_format=output_format,
            )
            if result is not None:
                output_path = result
        except Exception as e:
            self.logger.error(f"3D conversion failed: {e}", exc_info=True)
            raise RuntimeError("Conversion failed.") from e

        self.logger.info(f"✅ 3D model generated successfully at {output_path}")
        return output_path
