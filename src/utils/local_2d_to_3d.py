"""
Robust Local2DTo3DConverter wrapper.

- Constructor signature: Local2DTo3DConverter(logger, config)
- Method: convert(image_paths, output_dir) -> returns path to generated model file (OBJ)
- If the hy3dgen / Hunyuan pipeline is missing or model files not present, this creates a small dummy OBJ so the app still functions.
"""
import os
import uuid
import logging

try:
    import trimesh
except Exception:
    trimesh = None

# Try to import the real pipeline class; if not available we proceed in dummy mode
try:
    from hy3dgen.shapegen.pipelines import Hunyuan3DDiTFlowMatchingPipeline as PipelineClass
except Exception:
    PipelineClass = None


class Local2DTo3DConverter:
    def __init__(self, logger=None, config=None):
        self.logger = logger or logging.getLogger(__name__)
        self.config = config
        self.pipeline = None
        self.dummy_mode = True
        self._load_pipeline()

    def _load_pipeline(self):
        """
        Attempt to load a local Hunyuan3D pipeline. If anything fails, fall back to dummy mode.
        """
        try:
            if PipelineClass is None:
                self.logger.warning("Hunyuan3D pipeline package not installed — starting in dummy mode.")
                return

            # Determine model directory from config if possible
            model_name = None
            try:
                if hasattr(self.config, "get"):
                    model_name = self.config.get("model_name") or self.config.get("model_dir")
                else:
                    model_name = getattr(self.config, "model_name", None)
            except Exception:
                model_name = None

            model_name = model_name or "hunyuan3d-dit-v2-0"
            model_root = os.path.join(os.getcwd(), "models")
            model_dir = os.path.join(model_root, model_name)

            # Accept either model_dir or model_dir/subfolder layout
            subfolder = model_name
            candidate = os.path.join(model_dir, subfolder)
            if os.path.isdir(candidate):
                model_path = candidate
            else:
                model_path = model_dir

            config_yaml = os.path.join(model_path, "config.yaml")
            safetensors = os.path.join(model_path, "model.fp16.safetensors")

            if not os.path.exists(config_yaml) or not os.path.exists(safetensors):
                self.logger.warning(
                    "Model files not found at expected paths. "
                    f"Checked: {config_yaml} and {safetensors}. Falling back to dummy mode."
                )
                return

            self.logger.info(f"Loading Hunyuan3D pipeline from {model_path} (local_files_only=True)")
            try:
                # Load from the resolved model_path
                self.pipeline = PipelineClass.from_pretrained(
                    model_path,
                    local_files_only=True,
                    device_map="cpu"
                )
                self.dummy_mode = False
                self.logger.info("Hunyuan3D pipeline loaded successfully.")
            except Exception as e:
                self.logger.error(f"Failed to instantiate pipeline: {e}", exc_info=True)
                self.pipeline = None
                self.dummy_mode = True
        except Exception as e:
            self.logger.error(f"Unexpected error while loading pipeline: {e}", exc_info=True)
            self.pipeline = None
            self.dummy_mode = True

    def convert(self, image_paths, output_dir):
        """
        image_paths: list of local file paths (strings) for uploaded images
        output_dir: directory to write outputs into (will be created)
        Returns: path to saved .obj file
        """
        os.makedirs(output_dir, exist_ok=True)
        out_name = f"{uuid.uuid4()}.obj"
        out_path = os.path.join(output_dir, out_name)

        # If pipeline absent -> return a tiny dummy OBJ
        if self.pipeline is None or self.dummy_mode:
            self.logger.warning("Pipeline not available — producing dummy OBJ as fallback.")
            try:
                if trimesh:
                    mesh = trimesh.Trimesh(vertices=[[0, 0, 0], [1, 0, 0], [0, 1, 0]],
                                           faces=[[0, 1, 2]])
                    mesh.export(out_path)
                else:
                    with open(out_path, "w") as f:
                        f.write("# dummy OBJ\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n")
                self.logger.info(f"Dummy OBJ written to {out_path}")
                return out_path
            except Exception as e:
                self.logger.error(f"Failed to write dummy OBJ: {e}", exc_info=True)
                raise

        # Real pipeline: try to run it (best-effort; pipeline return types vary)
        try:
            # pipeline may expect a single image; pass first uploaded image
            if isinstance(image_paths, (list, tuple)) and len(image_paths) > 0:
                image_arg = image_paths[0]
            else:
                image_arg = image_paths

            self.logger.info(f"Running pipeline on image: {image_arg}")
            result = self.pipeline(image=image_arg)

            # Many pipelines return (mesh,) or dict; handle common shapes.
            mesh = None
            if hasattr(result, "mesh"):
                mesh = result.mesh
            elif isinstance(result, dict) and "mesh" in result:
                mesh = result["mesh"]
            elif isinstance(result, (list, tuple)) and len(result) > 0:
                mesh = result[0]
            else:
                mesh = result

            # Export mesh
            if hasattr(mesh, "export"):
                mesh.export(out_path)
            else:
                # Try to construct a trimesh.Trimesh if possible
                if trimesh and isinstance(mesh, dict):
                    tri = trimesh.Trimesh(**mesh)
                    tri.export(out_path)
                else:
                    # Fallback minimal OBJ
                    with open(out_path, "w") as f:
                        f.write("# fallback OBJ\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n")

            self.logger.info(f"Model written to {out_path}")
            return out_path

        except Exception as e:
            # Conversion failed — write fallback OBJ to avoid crashing the whole app
            self.logger.error(f"Error during conversion pipeline: {e}", exc_info=True)
            with open(out_path, "w") as f:
                f.write("# fallback OBJ due to error\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n")
            return out_path
