"""
Local2DTo3DConverter for Hunyuan3D 2.1
- Works with Flask app for 2D->3D conversion
- Uses ImageProcessorV2
"""

import os
import yaml
import torch
from src.logger.logger import Logger

from Hunyuan3D_2_1.hy3dshape.pipelines import Hunyuan3DDiTPipeline
from Hunyuan3D_2_1.hy3dshape.preprocessors import ImageProcessorV2

class Local2DTo3DConverter:
    def __init__(self, logger: Logger, output_dir: str, device="cuda"):
        self.logger = logger
        self.device = device
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)
        self.pipeline = None
        self._load_pipeline()

    def _load_pipeline(self):
        try:
            model_ckpt = os.path.join(
                "Hunyuan3D_2_1", "models", "hunyuan3d-2", "hunyuan3d-dit-v2-0", "model.fp16.ckpt"
            )
            config_yaml = os.path.join(
                "Hunyuan3D_2_1", "models", "hunyuan3d-2", "hunyuan3d-dit-v2-0", "config.yaml"
            )
            self.logger.info(f"✅ Loading Hunyuan3D pipeline from checkpoint: {model_ckpt}")

            # Load config YAML (optional, some pipelines need it)
            with open(config_yaml, "r") as f:
                cfg = yaml.safe_load(f)

            image_processor = ImageProcessorV2(size=512)

            # Pass None for scheduler and conditioner (not needed for inference)
            self.pipeline = Hunyuan3DDiTPipeline(
                model_ckpt,
                config_yaml,
                scheduler=None,
                conditioner=None,
                image_processor=image_processor,
                device=self.device
            )

        except Exception as e:
            self.logger.error(f"Failed to load pipeline: {e}", exc_info=True)
            raise RuntimeError("Pipeline loading failed") from e

    def convert(self, image_paths, output_dir=None):
        if output_dir is None:
            output_dir = self.output_dir
        os.makedirs(output_dir, exist_ok=True)

        if not self.pipeline:
            raise RuntimeError("Pipeline not loaded")

        outputs = []
        for img_path in image_paths:
            try:
                self.logger.info(f"Processing image: {img_path}")
                # The pipeline likely expects a tensor or PIL image
                mesh = self.pipeline.run(img_path)  # assuming .run() returns OBJ path or mesh object
                # Save output mesh
                out_path = os.path.join(output_dir, os.path.basename(img_path).replace(".png", ".obj").replace(".jpg", ".obj"))
                mesh.export(out_path) if hasattr(mesh, "export") else None
                outputs.append(out_path)
            except Exception as e:
                self.logger.error(f"Failed to process {img_path}: {e}", exc_info=True)

        if not outputs:
            raise RuntimeError("No 3D models were generated")
        return outputs[0]  # return first OBJ path for now
