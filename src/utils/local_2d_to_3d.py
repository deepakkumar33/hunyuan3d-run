"""
Local 2D-to-3D conversion utility.
"""

import os
import tempfile
import uuid

from src.logger.logger import Logger

# Import the real Hunyuan3D pipeline
from hy3dgen.shapegen.pipelines import Hunyuan3DDiTPipeline


class Local2DTo3DConverter:
    """
    Local converter class for handling 2D-to-3D model conversion.
    Uses the pretrained Hunyuan3D checkpoint and config.
    """

    def __init__(self):
        self.logger = Logger(__name__).get_logger()
        self.pipeline = None
        self._load_pipeline()

    def _load_pipeline(self):
        """
        Load the Hunyuan3D pipeline from checkpoint or safetensors with config.
        """
        base_dir = "/root/hunyuan3d-run/hunyuan3d/hy3dgen/shapegen/pipeline/pipeline_data/dit"

        ckpt_path = os.path.join(base_dir, "model.fp16.ckpt")
        safetensors_path = os.path.join(base_dir, "model.fp16.safetensors")
        config_path = os.path.join(base_dir, "config.yaml")

        self.logger.info("Loading Hunyuan3D pipeline...")

        pipeline = None
        try:
            if os.path.exists(ckpt_path):
                self.logger.info(f"Attempting to load pipeline from CKPT: {ckpt_path} with config {config_path}")
                pipeline = Hunyuan3DDiTPipeline.from_single_file(
                    ckpt_path,
                    config_path=config_path
                )
                self.logger.info("Successfully loaded pipeline from CKPT")
        except Exception as e:
            self.logger.error(f"CKPT load failed: {e}")

        if pipeline is None:
            try:
                if os.path.exists(safetensors_path):
                    self.logger.info(f"Attempting to load pipeline from safetensors: {safetensors_path} with config {config_path}")
                    pipeline = Hunyuan3DDiTPipeline.from_single_file(
                        safetensors_path,
                        config_path=config_path
                    )
                    self.logger.info("Successfully loaded pipeline from safetensors")
            except Exception as e:
                self.logger.error(f"Safetensors load failed: {e}")

        if pipeline is None:
            self.logger.error("Failed to load Hunyuan3D pipeline from both CKPT and safetensors.")
        else:
            self.pipeline = pipeline

    def convert(self, image_path: str) -> str:
        """
        Convert a 2D image into a 3D model.

        Parameters
        ----------
        image_path : str
            Path to the input image.

        Returns
        -------
        str
            Path to the generated 3D model (.obj).
        """
        if self.pipeline is None:
            raise RuntimeError("Pipeline not loaded. Cannot perform conversion.")

        self.logger.info(f"Starting 2D-to-3D conversion for {image_path}")

        # Create a temporary directory to save results
        output_dir = tempfile.mkdtemp()
        output_path = os.path.join(output_dir, f"{uuid.uuid4()}.obj")

        try:
            # Run the pipeline with your input image
            result = self.pipeline(
                image_path=image_path,
                output_path=output_path
            )

            self.logger.info(f"3D model successfully generated at {output_path}")
            return output_path

        except Exception as e:
            self.logger.error(f"Conversion failed: {e}")
            raise
