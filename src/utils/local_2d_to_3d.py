import os
from hunyuan3d import Hunyuan3D  # this uses your downloaded model
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
            self.logger.info("Hunyuan3D model loaded successfully.")
        except Exception as e:
            self.logger.error(f"Error loading model: {e}", exc_info=True)
            self.model = None

    def convert(self, input_path, output_path):
        if not self.model:
            raise RuntimeError("Model not loaded")

        self.logger.info(f"Converting image: {input_path}")
        mesh = self.model(input_path)  # run inference
        mesh.export(output_path)       # export OBJ
        self.logger.info(f"3D model saved at: {output_path}")
        return output_path
