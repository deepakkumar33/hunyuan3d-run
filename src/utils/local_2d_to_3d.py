""" Local 2D to 3D converter module """

import os
import tempfile
import torch
from src.utils.configuration import ConfigLoader
from src.logger.logger import get_logger

logger = get_logger(__name__)


class Local2DTo3DConverter:
    """
    Class to handle 2D to 3D model conversion locally using pretrained pipelines.
    """

    def __init__(self, config: ConfigLoader):
        self.config = config

    def convert(self, input_path: str, output_dir: str) -> str:
        """
        Convert a 2D image into a 3D model.

        Parameters
        ----------
        input_path : str
            Path to the input 2D image.
        output_dir : str
            Directory where the 3D model will be saved.

        Returns
        -------
        str
            Path to the generated 3D model file.
        """
        from diffusers import DiffusionPipeline

        model_root = os.path.join("models", "hunyuan3d-2", "hunyuan3d-dit-v2-0")

        # ---- find weight file ----
        def _find_weight_file():
            explicit_candidates = [
                "model.fp16.ckpt",      # prefer ckpt first
                "model.ckpt",
                "model.fp16.safetensors",
                "model.safetensors",
            ]
            for fname in explicit_candidates:
                candidate = os.path.join(model_root, fname)
                if os.path.exists(candidate):
                    return candidate

            # fallback search
            for pattern in ["*.ckpt", "*.pt", "*.pth", "*.safetensors"]:
                import glob
                matches = glob.glob(os.path.join(model_root, pattern))
                if matches:
                    return matches[0]

            return None

        weight_file = _find_weight_file()
        config_file = os.path.join(model_root, "config.yaml")

        logger.info(f"Looking for model weights in {model_root}")
        logger.info(f"Selected weight file: {weight_file}")
        logger.info(f"Config file: {config_file}")

        if not weight_file or not os.path.exists(weight_file):
            raise FileNotFoundError("No weight file found in model directory")
        if not os.path.exists(config_file):
            raise FileNotFoundError("Missing config.yaml in model directory")

        # ---- load pipeline ----
        logger.info("Loading 2D-to-3D pipeline...")
        pipe = DiffusionPipeline.from_single_file(
            weight_file,
            config_file=config_file,
            torch_dtype=torch.float16,
            variant="fp16",
        )
        pipe.to("cuda" if torch.cuda.is_available() else "cpu")

        # ---- run pipeline ----
        with tempfile.TemporaryDirectory() as tmpdir:
            logger.info(f"Generating 3D model for input: {input_path}")
            result = pipe(input_path)  # assuming pipeline takes path
            output_path = os.path.join(output_dir, "output_model.obj")

            # Save result (placeholder, depends on pipeline's actual API)
            if hasattr(result, "save_model"):
                result.save_model(output_path)
            elif hasattr(result, "to_obj"):
                with open(output_path, "w") as f:
                    f.write(result.to_obj())
            else:
                raise RuntimeError("Pipeline result has no save method")

        logger.info(f"3D model saved to {output_path}")
        return output_path
