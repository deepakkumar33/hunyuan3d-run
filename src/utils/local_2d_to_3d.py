import os
import sys
import trimesh
from logger.logger import get_logger

# Make sure local hunyuan3d folder is on Python path
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
HUNYUAN_DIR = os.path.join(BASE_DIR, "hunyuan3d")
if HUNYUAN_DIR not in sys.path:
    sys.path.insert(0, HUNYUAN_DIR)

try:
    from hunyuan3d import Hunyuan3D
except ImportError:
    raise ImportError("❌ Could not import hunyuan3d. Make sure the folder exists in hunyuan3d-run/hunyuan3d/")


class Local2DTo3DConverter:
    def __init__(self, model_name, logger=None):
        self.logger = logger or get_logger("Local2DTo3DConverter")
        self.model_name = model_name
        self.model = None
        self._load_model()

    def _load_model(self):
        try:
            self.logger.info(f"🔄 Loading Hunyuan3D model from: {self.model_name}")
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
            raise RuntimeError("❌ Model not loaded")

        try:
            self.logger.info(f"🔄 Running inference on: {input_path}")

            # Try infer(), fallback to generate(), fallback to __call__()
            if hasattr(self.model, "infer"):
                result = self.model.infer(input_path)
            elif hasattr(self.model, "generate"):
                result = self.model.generate(input_path)
            else:
                result = self.model(input_path)

            # Extract vertices/faces
            vertices = getattr(result, "vertices", None) or result.get("vertices")
            faces = getattr(result, "faces", None) or result.get("faces")

            if vertices is None:
                raise RuntimeError("❌ Model did not return any vertices")

            if not faces or len(faces) == 0:
                self.logger.warning("⚠️ No faces returned. Building convex hull.")
                mesh = trimesh.Trimesh(vertices=vertices)
                mesh = mesh.convex_hull
            else:
                mesh = trimesh.Trimesh(vertices=vertices, faces=faces)

            # Export model
            mesh.export(output_path)
            self.logger.info(f"✅ 3D model saved: {output_path}")

            return output_path

        except Exception as e:
            self.logger.error(f"❌ Conversion failed: {e}", exc_info=True)
            raise
