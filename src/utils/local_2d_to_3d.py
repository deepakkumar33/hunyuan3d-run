import os
import uuid
from hunyuan3d.shapegen import run as shapegen_run
from hunyuan3d.texgen import run as texgen_run


class Local2DTo3DConverter:
    """
    Local converter that takes a 2D image and produces a textured 3D model.
    Uses the shapegen + texgen pipeline inside hunyuan3d.
    """

    def __init__(self, output_dir: str = "outputs"):
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)

    def convert(self, image_path: str) -> str:
        """
        Converts an input image into a 3D model (OBJ/GLB).
        
        Parameters
        ----------
        image_path : str
            Path to the input image.
        
        Returns
        -------
        str
            Path to the generated 3D model file.
        """
        job_id = str(uuid.uuid4())
        work_dir = os.path.join(self.output_dir, job_id)
        os.makedirs(work_dir, exist_ok=True)

        # 1. Shape generation
        print(f"[INFO] Generating shape for {image_path}...")
        mesh_path = shapegen_run(image_path, work_dir)

        # 2. Texture generation
        print(f"[INFO] Generating texture for {mesh_path}...")
        model_path = texgen_run(mesh_path, work_dir)

        print(f"[SUCCESS] 3D model created at: {model_path}")
        return model_path
