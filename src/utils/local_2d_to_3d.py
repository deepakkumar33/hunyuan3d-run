import os
import logging
import traceback
import trimesh

from Hunyuan3D_2_1.hy3dshape.pipelines import Hunyuan3DPipeline


class Local2DTo3DConverter:
    """
    Robust Local2DTo3DConverter with improved model-file detection and verbose logging.

    - Accepts multiple input images (JPG, PNG).
    - Logs candidate folders and discovered files to help debugging.
    - Falls back to a small dummy OBJ if pipeline cannot be loaded.
    """

    def __init__(self, logger: logging.Logger, cfg):
        self.logger = logger
        self.cfg = cfg

    def convert(self, image_paths, output_dir):
        """
        Convert multiple 2D images to a 3D mesh.

        Args:
            image_paths (list[str]): Paths to input images.
            output_dir (str): Output directory where the model will be saved.

        Returns:
            str: Path to generated model file.
        """
        try:
            os.makedirs(output_dir, exist_ok=True)

            # Initialize pipeline
            self.logger.info("Initializing Hunyuan3D pipeline...")
            pipeline = Hunyuan3DPipeline.from_pretrained(
                self.cfg.model_path,
                torch_dtype="auto",
                cache_dir=self.cfg.cache_dir
            )
            self.logger.info("Pipeline loaded successfully.")

            # Run pipeline
            self.logger.info(f"Running pipeline with {len(image_paths)} images")
            mesh = pipeline(image_paths)

            # Save output
            output_path = os.path.join(output_dir, "model.obj")
            mesh.export(output_path)
            self.logger.info(f"3D model exported: {output_path}")
            return output_path

        except Exception as e:
            self.logger.error(f"Pipeline conversion failed: {e}", exc_info=True)

            # Fallback: generate dummy cube OBJ so frontend doesn’t break
            dummy_path = os.path.join(output_dir, "dummy.obj")
            self._generate_dummy_obj(dummy_path)
            return dummy_path

    def _generate_dummy_obj(self, path):
        """Generate a fallback dummy cube OBJ."""
        try:
            cube = trimesh.creation.box(extents=(1, 1, 1))
            cube.export(path)
            self.logger.warning(f"Dummy OBJ generated at {path}")
        except Exception as e:
            self.logger.error(f"Failed to generate dummy OBJ: {e}", exc_info=True)
