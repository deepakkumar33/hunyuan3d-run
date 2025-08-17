import os
import trimesh
from hunyuan3d import Hunyuan3D
from logger.logger import get_logger


class Local2DTo3DConverter:
    def __init__(self, model_name, logger=None):
        self.logger = logger or get_logger("Local2DTo3DConverter")
        self.model_name = model_name
        self.model = None
        self._load_model()

    def _load_model(self):
        try:
            self.logger.info(f"Loading Hunyuan3D model from: {self.model_name}")
            self.model = Hunyuan3D.from_pretrained(
                self.model_name,
                config_name="config.yaml",
                checkpoint_name="model.fp16.ckpt"
            )
            self.logger.info("✅ Hunyuan3D model loaded successfully.")
        except Exception as e:
            self.logger.error(f"❌ Error loading model: {e}", exc_info=True)
            self.model = None

    def convert(self, input_path, output_path):
        if not self.model:
            raise RuntimeError("Model not loaded")

        try:
            self.logger.info(f"🔄 Running inference on image: {input_path}")

            # Run inference (using the correct API)
            result = self.model.infer(input_path)  # <-- use infer(), not __call__

            # result should contain vertices & faces
            vertices = result.get("vertices")
            faces = result.get("faces")

            if vertices is None or faces is None or len(faces) == 0:
                self.logger.warning("⚠️ Model returned no faces — generating convex hull as fallback.")

                # Try to build a mesh from vertices only
                mesh = trimesh.Trimesh(vertices=vertices)
                mesh = mesh.convex_hull  # generate faces automatically
            else:
                mesh = trimesh.Trimesh(vertices=vertices, faces=faces)

            # Export model
            mesh.export(output_path)
            self.logger.info(f"✅ 3D model saved at: {output_path}")

            return output_path

        except Exception as e:
            self.logger.error(f"❌ Error during conversion: {e}", exc_info=True)
            raise
