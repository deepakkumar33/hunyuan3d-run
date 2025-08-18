import os
from hunyuan3d import Hunyuan3D


class Local2DTo3DConverter:
    """
    Handles 2D to 3D conversion using local Hunyuan3D modules.
    """

    def __init__(self, input_path: str, output_dir: str):
        self.input_path = input_path
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)

    def convert(self):
        """
        Runs the full 2D → 3D pipeline.
        1. Shape generation
        2. Texture generation
        """

        # Step 1: Generate 3D shape
        print("[Local2DTo3D] Generating shape...")
        shape_result = Hunyuan3D.generate_shape(
            input_path=self.input_path,
            output_dir=self.output_dir
        )

        # Step 2: Generate texture
        print("[Local2DTo3D] Generating texture...")
        tex_result = Hunyuan3D.generate_texture(
            input_path=self.input_path,
            output_dir=self.output_dir
        )

        print(f"[Local2DTo3D] Conversion completed. Results in {self.output_dir}")
        return {
            "shape": shape_result,
            "texture": tex_result
        }
