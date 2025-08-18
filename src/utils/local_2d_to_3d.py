"""
Robust Local2DTo3DConverter with improved model-file detection and verbose logging.

- Accepts common weight filenames: model.fp16.safetensors, model.fp16.ckpt,
  model.safetensors, model.ckpt, *.ckpt, *.pt, *.pth
- Logs candidate folders and discovered files to help debugging.
- Falls back to a small dummy OBJ if pipeline cannot be loaded.
"""

import os
import uuid
import logging
import traceback
import glob

try:
    import trimesh
except Exception:
    trimesh = None

# Pipeline import (may fail if hy3dgen not installed)
try:
    from hy3dgen.shapegen.pipelines import Hunyuan3DDiTFlowMatchingPipeline as PipelineClass
except Exception:
    PipelineClass = None


def _find_weight_file(model_path):
    """
    Return the first matching weight file path (safetensors / ckpt / pt / pth) or None.
    Checks several explicit filenames first, then glob patterns.
    """
    explicit_candidates = [
        "model.fp16.safetensors",
        "model.fp16.ckpt",
        "model.safetensors",
        "model.ckpt",
    ]
    for name in explicit_candidates:
        p = os.path.join(model_path, name)
        if os.path.exists(p):
            return p

    for pattern in ["*.safetensors", "*.ckpt", "*.pt", "*.pth"]:
        g = glob.glob(os.path.join(model_path, pattern))
        if g:
            return g[0]

    return None


class Local2DTo3DConverter:
    """
    Converter wrapper.

    constructor: Local2DTo3DConverter(logger=None, config=None)
    method: convert(image_paths, output_dir) -> path to .obj
    """

    def __init__(self, logger=None, config=None):
        self.logger = logger or logging.getLogger(__name__)
        self.config = config
        self.pipeline = None
        self.dummy_mode = True
        self._load_pipeline()

    def _resolve_model_dir_candidates(self):
        """
        Return a list of candidate model directories to check (in order).
        Uses config.get('model_name') if available; otherwise sensible defaults.
        """
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

        candidates = [
            os.path.join(model_root, model_name, "hunyuan3d-dit-v2-0"),
            os.path.join(model_root, model_name),
            os.path.join(model_root, "hunyuan3d-dit-v2-0"),
            model_root,  # last resort, check the models root itself
        ]

        # remove duplicates while preserving order
        seen = set()
        filtered = []
        for c in candidates:
            if c not in seen:
                filtered.append(c)
                seen.add(c)
        return filtered

    def _load_pipeline(self):
        """Attempt to find model files and instantiate the pipeline (best-effort)."""
        try:
            if PipelineClass is None:
                self.logger.warning("Hunyuan3D pipeline package not installed (PipelineClass is None).")
                return

            candidates = self._resolve_model_dir_candidates()
            self.logger.info(f"Model dir candidates: {candidates}")

            chosen_dir = None
            found_config = None
            found_weights = None

            for d in candidates:
                if not d:
                    continue
                cfg_path = os.path.join(d, "config.yaml")
                w = _find_weight_file(d)
                self.logger.debug(
                    f"Checking '{d}': config_exists={os.path.exists(cfg_path)}, weight_file={w}"
                )
                if os.path.exists(cfg_path) and w:
                    chosen_dir = d
                    found_config = cfg_path
                    found_weights = w
                    break

            if not chosen_dir:
                self.logger.warning("Model files not found in any candidate directories. Listing models root for debug.")
                model_root = os.path.join(os.getcwd(), "models")
                try:
                    listing = os.listdir(model_root)
                except Exception:
                    listing = f"cannot list {model_root}"
                self.logger.warning(f"models root ({model_root}) listing: {listing}")
                return

            self.logger.info(f"Found config: {found_config}; found weights: {found_weights}; loading from: {chosen_dir}")

            try:
                # KEY FIX: pass subfolder="" so hy3dgen does not append another subfolder and call HF hub
                self.pipeline = PipelineClass.from_pretrained(
                    chosen_dir,
                    local_files_only=True,
                    device_map="cpu",
                    subfolder=""  # <-- prevent hy3dgen from appending default subfolder
                )
                self.dummy_mode = False
                self.logger.info("Hunyuan3D pipeline loaded successfully.")
            except Exception:
                self.logger.error("Failed to instantiate pipeline. Full traceback:\n" + traceback.format_exc())
                self.pipeline = None
                self.dummy_mode = True

        except Exception:
            self.logger.error("Unexpected error while loading pipeline:\n" + traceback.format_exc())
            self.pipeline = None
            self.dummy_mode = True

    def convert(self, image_paths, output_dir):
        """
        Run conversion. image_paths can be a list of paths or a single path.
        Returns path to saved .obj file.
        """
        os.makedirs(output_dir, exist_ok=True)
        out_name = f"{uuid.uuid4()}.obj"
        out_path = os.path.join(output_dir, out_name)

        # If pipeline missing, write a tiny dummy OBJ so frontend keeps working
        if self.pipeline is None or self.dummy_mode:
            self.logger.warning("Pipeline not available — producing dummy OBJ as fallback.")
            try:
                if trimesh:
                    mesh = trimesh.Trimesh(vertices=[[0, 0, 0], [1, 0, 0], [0, 1, 0]], faces=[[0, 1, 2]])
                    mesh.export(out_path)
                else:
                    with open(out_path, "w") as f:
                        f.write("# dummy OBJ\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n")
                self.logger.info(f"Dummy OBJ written to {out_path}")
                return out_path
            except Exception:
                self.logger.error("Failed to write dummy OBJ:\n" + traceback.format_exc())
                raise

        # Real pipeline invocation (best-effort)
        try:
            image_arg = image_paths[0] if isinstance(image_paths, (list, tuple)) and image_paths else image_paths
            self.logger.info(f"Running pipeline on image: {image_arg}")
            result = self.pipeline(image=image_arg)

            # Normalize different result shapes
            mesh = None
            if hasattr(result, "mesh"):
                mesh = result.mesh
            elif isinstance(result, dict) and "mesh" in result:
                mesh = result["mesh"]
            elif isinstance(result, (list, tuple)) and len(result) > 0:
                mesh = result[0]
            else:
                mesh = result

            # Export if possible
            if hasattr(mesh, "export"):
                mesh.export(out_path)
            else:
                if trimesh and isinstance(mesh, dict):
                    tri = trimesh.Trimesh(**mesh)
                    tri.export(out_path)
                else:
                    with open(out_path, "w") as f:
                        f.write("# fallback OBJ\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n")

            self.logger.info(f"Model written to {out_path}")
            return out_path

        except Exception:
            self.logger.error("Error during conversion pipeline:\n" + traceback.format_exc())
            with open(out_path, "w") as f:
                f.write("# fallback OBJ due to error\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n")
            return out_path
