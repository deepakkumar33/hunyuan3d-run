""" Handles loading and inference for a local Hunyuan3D model. """

import os
import torch
import trimesh
import logging

class Local2DTo3DConverter:
    def __init__(self, model_dir, logger=None):
        self.logger = logger or logging.getLogger(__name__)
        self.model_dir = model_dir
        self.model = None
        self.dummy_mode = False
        self._load_hunyuan_model()

    def _load_hunyuan_model(self):
        try:
            from hunyuan3d.shapegen.models.denoisers.hunyuan3ddit import HunYuanDiT
            self.logger.info(f"Loading Hunyuan3D model from {self.model_dir}")

            use_gpu = torch.cuda.is_available()
            self.model = HunYuanDiT.load_from_checkpoint(
                os.path.join(self.model_dir, "hunyuan3d-dit-v2-0.ckpt"),
                map_location="cuda" if use_gpu else "cpu"
            )

            self.logger.info(f"Hunyuan3D model loaded successfully "
                             f"on {'GPU' if use_gpu else 'CPU'}")

        except Exception as e:
            self.logger.error(f"❌ Failed to load Hunyuan3D model: {e}")
            self.dummy_mode = True

    def convert(self, image_path):
        if self.dummy_mode or self.model is None:
            self.logger.warning("⚠️ Using dummy cube mesh (model not loaded).")
            vertices = [[0,0,0],[1,0,0],[0,1,0]]
            faces = [[0,1,2]]
            return trimesh.Trimesh(vertices=vertices, faces=faces)

        try:
            self.logger.info(f"Converting {image_path} → 3D mesh...")
            mesh = self.model.infer(image_path)
            self.logger.info("✅ 3D mesh generated successfully")
            return mesh
        except Exception as e:
            self.logger.error(f"❌ Error converting image: {e}")
            vertices = [[0,0,0],[1,0,0],[0,1,0]]
            faces = [[0,1,2]]
            return trimesh.Trimesh(vertices=vertices, faces=faces)
