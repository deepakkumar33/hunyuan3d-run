"""
Handles loading and inference for a local Hunyuan3D model.
"""
__all__ = ["Local2DTo3DConverter"]

import os
import torch
import trimesh
import logging

from hy3dgen.shapegen.pipelines import Hunyuan3DDiTFlowMatchingPipeline

class Local2DTo3DConverter:
    """
    Handles loading and inference for a local Hunyuan3D model.
    """
    def __init__(self, model_dir, logger=None):
        self.logger = logger or logging.getLogger(__name__)
        self.pipeline = None
        self.model_dir = model_dir
        self.dummy_mode = False
        self._load_pipeline()

    def _load_pipeline(self):
        try:
            abs_model_dir = os.path.abspath(self.model_dir)
            subfolder = "hunyuan3d-dit-v2-0"
            model_path = os.path.join(abs_model_dir, subfolder)
            config_path = os.path.join(model_path, 'config.yaml')
            safetensors_path = os.path.join(model_path, 'model.fp16.safetensors')

            if not os.path.exists(config_path):
                self.logger.error(f"Config file not found: {config_path}")
                self.dummy_mode = True
                return
            if not os.path.exists(safetensors_path):
                self.logger.error(f"Safetensors file not found: {safetensors_path}")
                self.dummy_mode = True
                return

            self.logger.info(f"Loading Hunyuan3D model from {model_path}")

            use_gpu = torch.cuda.is_available()
            device_map = "auto" if use_gpu else "cpu"
            dtype = torch.float16 if use_gpu else torch.float32

            self.logger.info(f"🔧 Using device: {'GPU' if use_gpu else 'CPU'}")

            self.pipeline = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
                abs_model_dir,
                local_files_only=True,
                torch_dtype=dtype,
                subfolder=subfolder,
                device_map=device_map
            )
            self.logger.info(f"Hunyuan3D model loaded successfully on {'GPU' if use_gpu else 'CPU'}")

        except Exception as e:
            self.logger.error(f"Unexpected error loading model: {e}")
            self.dummy_mode = True

    def convert(self, image_path):
        if self.dummy_mode or self.pipeline is None:
            self.logger.warning("Using dummy mesh due to model loading failure or dummy mode.")
            vertices = [[0, 0, 0], [1, 0, 0], [0, 1, 0]]
            faces = [[0, 1, 2]]
            return trimesh.Trimesh(vertices=vertices, faces=faces)

        try:
            self.logger.info(f"Converting image to 3D mesh: {image_path}")
            mesh = self.pipeline(image=image_path)[0]
            self.logger.info("3D mesh generated successfully")
            return mesh
        except Exception as e:
            self.logger.error(f"Error converting image to 3D mesh: {e}")
            vertices = [[0, 0, 0], [1, 0, 0], [0, 1, 0]]
            faces = [[0, 1, 2]]
            return trimesh.Trimesh(vertices=vertices, faces=faces)
