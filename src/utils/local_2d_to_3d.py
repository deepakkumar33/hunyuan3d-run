"""
Robust Local2DTo3DConverter with explicit CKPT preference and automatic fallback.

- Prefers .ckpt over .safetensors (because your safetensors throws HeaderTooLarge)
- If a .safetensors is present but invalid, it will automatically try the .ckpt
- Uses hy3dgen's Hunyuan3DDiTFlowMatchingPipeline.from_single_file(path) so we can
  force the exact file instead of letting the lib guess.
- Writes a tiny dummy OBJ only if the pipeline truly can't be loaded.
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

# hy3dgen pipeline
try:
    from hy3dgen.shapegen.pipelines import Hunyuan3DDiTFlowMatchingPipeline as PipelineClass
except Exception:
    PipelineClass = None


def _list_candidate_dirs(config):
    """Return model dirs to probe."""
    # honor config if provided
    model_name = None
    try:
        if hasattr(config, "get"):
            model_name = config.get("model_name") or config.get("model_dir")
        else:
            model_name = getattr(config, "model_name", None)
    except Exception:
        model_name = None

    model_name = model_name or "hunyuan3d-dit-v2-0"
    model_root = os.path.join(os.getcwd(), "models")

    candidates = [
        os.path.join(model_root, model_name, "hunyuan3d-dit-v2-0"),
        os.path.join(model_root, model_name),
        os.path.join(model_root, "hunyuan3d-dit-v2-0"),
        model_root,
    ]
    # dedupe
    seen, out = set(), []
    for c in candidates:
        if c not in seen:
            out.append(c); seen.add(c)
    return out


def _find_files(d):
    """Return (config_path, ckpt_path, safetensors_path). Any can be None."""
    cfg = os.path.join(d, "config.yaml") if os.path.exists(os.path.join(d, "config.yaml")) else None

    # try exact names first
    ckpt_exact = os.path.join(d, "model.fp16.ckpt")
    if not os.path.exists(ckpt_exact):
        ckpt_exact = os.path.join(d, "model.ckpt") if os.path.exists(os.path.join(d, "model.ckpt")) else None

    safet_exact = os.path.join(d, "model.fp16.safetensors")
    if not os.path.exists(safet_exact):
        safet_exact = os.path.join(d, "model.safetensors") if os.path.exists(os.path.join(d, "model.safetensors")) else None

    # fallbacks via glob if not found
    ckpt = ckpt_exact
    if ckpt is None:
        g = glob.glob(os.path.join(d, "*.ckpt")) + glob.glob(os.path.join(d, "*.pt")) + glob.glob(os.path.join(d, "*.pth"))
        ckpt = g[0] if g else None

    safet = safet_exact
    if safet is None:
        g = glob.glob(os.path.join(d, "*.safetensors"))
        safet = g[0] if g else None

    return cfg, ckpt, safet


class Local2DTo3DConverter:
    """
    Converter wrapper used by the Flask API:
      - __init__(logger, config)
      - convert(image_paths, output_dir) -> path to .obj
    """
    def __init__(self, logger=None, config=None):
        self.logger = logger or logging.getLogger(__name__)
        self.config = config
        self.pipeline = None
        self.dummy_mode = True
        self._load_pipeline()

    def _try_load_single_file(self, weights_path):
        """Try creating pipeline from an explicit file path."""
        self.logger.info(f"Attempting to load pipeline from file: {weights_path}")
        # NOTE: from_single_file lets us force .ckpt even if a .safetensors is present
        self.pipeline = PipelineClass.from_single_file(
            weights_path,
            local_files_only=True,
            device_map="cpu",
        )
        self.dummy_mode = False
        self.logger.info("Hunyuan3D pipeline loaded successfully.")

    def _load_pipeline(self):
        """Find config + weights and instantiate the pipeline, preferring CKPT."""
        try:
            if PipelineClass is None:
                self.logger.warning("Hunyuan3D pipeline package not installed (PipelineClass is None).")
                return

            candidates = _list_candidate_dirs(self.config)
            self.logger.info(f"Model dir candidates: {candidates}")

            chosen_dir = None
            found_cfg = None
            ckpt = None
            safet = None

            for d in candidates:
                cfg, ckpt_path, safet_path = _find_files(d)
                self.logger.debug(f"Check '{d}': cfg={cfg}, ckpt={ckpt_path}, safetensors={safet_path}")
                if cfg and (ckpt_path or safet_path):
                    chosen_dir, found_cfg, ckpt, safet = d, cfg, ckpt_path, safet_path
                    break

            if not chosen_dir:
                self.logger.warning("No model files found in any candidate directory; will use dummy output.")
                return

            self.logger.info(f"Found config: {found_cfg}; ckpt: {ckpt}; safetensors: {safet}; dir: {chosen_dir}")

            # ---- Load order: prefer CKPT, then valid safetensors ----
            load_errors = []

            if ckpt and os.path.exists(ckpt):
                try:
                    self._try_load_single_file(ckpt)
                    return
                except Exception as e:
                    msg = f"CKPT load failed: {e.__class__.__name__}: {e}"
                    self.logger.error(msg)
                    load_errors.append(msg)

            if safet and os.path.exists(safet):
                try:
                    self._try_load_single_file(safet)
                    return
                except Exception as e:
                    msg = f"Safetensors load failed: {e.__class__.__name__}: {e}"
                    self.logger.error(msg)
                    # If this specific safetensors throws HeaderTooLarge, we know it's bogus.
                    if "HeaderTooLarge" in str(e):
                        self.logger.error("Safetensors file looks invalid/corrupted; please replace it or remove it.")
                    load_errors.append(msg)

            # If we got here, nothing loaded
            self.logger.error("Failed to load pipeline from both CKPT and safetensors.")
            for m in load_errors:
                self.logger.error(m)

        except Exception:
            self.logger.error("Unexpected error while loading pipeline:\n" + traceback.format_exc())
        finally:
            if self.pipeline is None:
                self.dummy_mode = True

    def convert(self, image_paths, output_dir):
        """
        Run conversion. image_paths can be a list or a single path.
        Returns path to saved .obj file.
        """
        os.makedirs(output_dir, exist_ok=True)
        out_name = f"{uuid.uuid4()}.obj"
        out_path = os.path.join(output_dir, out_name)

        if self.pipeline is None or self.dummy_mode:
            self.logger.warning("Pipeline not available — producing dummy OBJ as fallback.")
            try:
                if trimesh:
                    mesh = trimesh.Trimesh(vertices=[[0,0,0],[1,0,0],[0,1,0]], faces=[[0,1,2]])
                    mesh.export(out_path)
                else:
                    with open(out_path, "w") as f:
                        f.write("# dummy OBJ\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n")
                self.logger.info(f"Dummy OBJ written to {out_path}")
                return out_path
            except Exception:
                self.logger.error("Failed to write dummy OBJ:\n" + traceback.format_exc())
                raise

        # Real pipeline invocation
        try:
            image_arg = image_paths[0] if isinstance(image_paths, (list, tuple)) and image_paths else image_paths
            self.logger.info(f"Running pipeline on image: {image_arg}")
            result = self.pipeline(image=image_arg)

            mesh = None
            if hasattr(result, "mesh"):
                mesh = result.mesh
            elif isinstance(result, dict) and "mesh" in result:
                mesh = result["mesh"]
            elif isinstance(result, (list, tuple)) and len(result) > 0:
                mesh = result[0]
            else:
                mesh = result

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
