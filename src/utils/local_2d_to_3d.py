"""
Local 2D -> 3D converter utility (multi-view supported)
"""

import os
import logging
import cv2
import numpy as np
from pathlib import Path
from hy3dgen.shapegen import Hunyuan3DDiTPipeline  # ensure installed


class Local2DTo3DConverter:
    def __init__(self, logger: logging.Logger, config: dict):
        self.logger = logger
        self.config = config
        self.pipeline = None
        self._load_pipeline()

    def _load_pipeline(self):
        """Load the Hunyuan3D pipeline from the model path specified in config"""
        model_name = self.config.get("model_name")
        if not model_name:
            raise ValueError("❌ 'model_name' missing in config.json")

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
            self.pipeline = Hunyuan3DDiTPipeline.from_single_file(
                ckpt_path=str(ckpt_file),
                config_path=str(cfg_file),
            )
            self.logger.info("✅ Hunyuan3D pipeline loaded successfully")
        except Exception as e:
            self.logger.error(f"Failed to load pipeline: {e}", exc_info=True)
            raise RuntimeError("Pipeline could not be loaded. Conversion impossible.") from e

    def convert(self, image_paths, output_dir):
        """Convert list of images to a 3D model file. Returns path to generated model."""

        if not self.pipeline:
            raise RuntimeError("Pipeline not loaded. Cannot convert images.")

        os.makedirs(output_dir, exist_ok=True)
        output_filename = self.config.get("output_filename", "model.obj")
        output_format = self.config.get("output_format", "obj")
        output_path = os.path.join(output_dir, output_filename)

        valid_images = []
        for p in image_paths:
            p = Path(p).resolve()
            if not p.is_file():
                self.logger.warning(f"❌ Skipping non-existent file: {p}")
                continue
            img = cv2.imread(str(p))
            if img is None or img.size == 0:
                self.logger.warning(f"❌ Skipping unreadable image: {p}")
                continue
            # Convert BGR → RGB as pipeline usually expects RGB
            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            valid_images.append(img)

        if not valid_images:
            raise ValueError("❌ No valid images left after filtering.")

        self.logger.info(f"Starting 2D->3D conversion for {len(valid_images)} views")
        self.logger.info(f"Output will be saved as: {output_path}")

        try:
            result = self.pipeline(
                input_images=valid_images,  # pass arrays, not paths
                output_path=output_path,
                output_format=output_format
            )
            if result is not None:
                output_path = result
        except Exception as e:
            self.logger.error(f"3D conversion failed: {e}", exc_info=True)
            raise RuntimeError("Conversion failed.") from e

        self.logger.info(f"✅ 3D model generated successfully at {output_path}")
        return output_path
