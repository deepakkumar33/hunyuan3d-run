import os
import logging
import traceback
from typing import List

class Local2DTo3DConverter:
    """
    Wrapper around Hunyuan3D that converts multiple 2D images (.jpg) into a 3D model.
    """

    def __init__(self, logger: logging.Logger, cfg):
        self.logger = logger
        self.cfg = cfg

    def convert(self, image_paths: List[str], output_dir: str) -> str:
        """
        Convert uploaded .jpg images into a 3D model.

        Args:
            image_paths: list of file paths to images
            output_dir: directory to save results

        Returns:
            Path to generated .obj (or fallback dummy .obj)
        """
        try:
            self.logger.info("🖼️ Starting 2D → 3D conversion...")
            self.logger.info(f"Images: {image_paths}")
            self.logger.info(f"Output dir: {output_dir}")

            # Import heavy dependencies here
            from Hunyuan3D-2.1.hy3dshape.pipelines import Hunyuan3DPipeline

            # Create pipeline
            pipe = Hunyuan3DPipeline.from_pretrained(
                "Hunyuan3D-2.1",
                torch_dtype="auto"
            )
            pipe = pipe.to("cuda")

            # Run inference with all images
            model = pipe(
                image_paths=image_paths,
                num_views=len(image_paths),
                output_dir=output_dir
            )

            model_path = os.path.join(output_dir, "model.obj")

            if os.path.exists(model_path):
                self.logger.info(f"✅ 3D model saved at {model_path}")
                return model_path
            else:
                raise RuntimeError("Pipeline did not produce model.obj")

        except Exception as e:
            self.logger.error(f"❌ Conversion failed: {e}")
            traceback.print_exc()

            # Fallback dummy OBJ
            dummy_path = os.path.join(output_dir, "dummy.obj")
            with open(dummy_path, "w") as f:
                f.write("# Dummy OBJ\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n")
            self.logger.warning(f"⚠️ Returning dummy OBJ at {dummy_path}")
            return dummy_path
