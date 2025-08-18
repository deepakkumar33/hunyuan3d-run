"""
Local 2D-to-3D conversion using Hunyuan3D checkpoint.
"""
import os
from pathlib import Path
import torch
import logging

# Import the Hunyuan3D pipeline
from hy3dgen.shapegen.pipelines import Hunyuan3DDiTPipeline

class Local2DTo3DConverter:
    """
    Converts 2D images to 3D models using pretrained Hunyuan3D pipeline.
    """

    def __init__(self, logger, config):
        self.logger = logger
        self.config = config

        # Detect device
        self.device = "cuda" if torch.cuda.is_available() else "cpu"

        # Determine model path
        model_dir_candidates = [
            config.get("ckpt_path", "/root/hunyuan3d-run/models/hunyuan3d-2/hunyuan3d-dit-v2-0/model.fp16.ckpt"),
            config.get("safetensors_path", "/root/hunyuan3d-run/models/hunyuan3d-2/hunyuan3d-dit-v2-0/model.fp16.safetensors")
        ]

        self.model_path = None
        for path in model_dir_candidates:
            if os.path.exists(path):
                self.model_path = path
                break

        if self.model_path is None:
            raise FileNotFoundError("No valid checkpoint or safetensors file found!")

        self.logger.info(f"Using model file: {self.model_path}")
        self.pipeline = None
        self._load_pipeline()

    def _load_pipeline(self):
        """
        Load the Hunyuan3D pipeline from the checkpoint or safetensors file.
        """
        try:
            # Hunyuan3DDiTPipeline requires model_path + config.yaml path
            # Assuming config.yaml is in same folder as checkpoint
            model_folder = os.path.dirname(self.model_path)
            config_path = os.path.join(model_folder, "config.yaml")
            if not os.path.exists(config_path):
                raise FileNotFoundError(f"Missing config.yaml in {model_folder}")

            self.logger.info(f"Loading Hunyuan3D pipeline from {self.model_path} with config {config_path}")
            self.pipeline = Hunyuan3DDiTPipeline.from_single_file(
                checkpoint_path=self.model_path,
                config_path=config_path,
                device=self.device
            )
            self.logger.info("Hunyuan3D pipeline loaded successfully.")
        except Exception as e:
            self.logger.error(f"Failed to load pipeline: {e}", exc_info=True)
            raise RuntimeError("Pipeline could not be loaded. Conversion impossible.") from e

    def convert(self, image_paths, output_dir):
        """
        Convert a list of 2D images into a 3D model.

        Parameters
        ----------
        image_paths : list[str]
            Paths to input images.
        output_dir : str
            Directory to save output OBJ file.

        Returns
        -------
        str
            Path to generated 3D OBJ file.
        """
        if not self.pipeline:
            raise RuntimeError("Pipeline not initialized!")

        os.makedirs(output_dir, exist_ok=True)
        output_obj = os.path.join(output_dir, "model.obj")

        self.logger.info(f"Converting {len(image_paths)} images to 3D model...")
        try:
            # Run actual Hunyuan3D inference
            self.pipeline.generate_3d(
                image_paths=image_paths,
                output_path=output_obj
            )
        except Exception as e:
            self.logger.error(f"3D conversion failed: {e}", exc_info=True)
            raise RuntimeError("3D conversion failed") from e

        self.logger.info(f"3D model successfully written to {output_obj}")
        return output_obj
