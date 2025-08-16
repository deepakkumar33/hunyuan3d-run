import os
import logging
import trimesh
import torch
import numpy as np
from PIL import Image
import yaml
from pathlib import Path
from typing import Optional, Dict, Any

class Local2DTo3DConverter:
    """
    Real Hunyuan3D converter using the hy3dgen package.
    """
    def __init__(self, model_path, logger=None):
        self.logger = logger or logging.getLogger(__name__)
        self.model_path = model_path
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.dummy_mode = False
        
        # Model components
        self.pipeline = None
        self.config = None
        
        if not os.path.exists(self.model_path):
            self.logger.warning(f"Model path does not exist: {self.model_path}. Running in dummy mode.")
            self.dummy_mode = True
        else:
            try:
                self._load_hunyuan_model()
                self.logger.info(f"✅ Hunyuan3D model loaded successfully from {self.model_path}")
            except Exception as e:
                self.logger.error(f"❌ Failed to load Hunyuan3D model: {e}")
                self.logger.exception("Detailed error:")
                self.dummy_mode = True

    def _load_hunyuan_model(self):
        """Load the real Hunyuan3D model using hy3dgen package."""
        try:
            # Import the hy3dgen modules
            self.logger.info("Importing hy3dgen modules...")
            
            try:
                import hy3dgen
                from hy3dgen.models import Hunyuan3DModel
                from hy3dgen.utils import load_config, create_pipeline
                self.logger.info("✅ hy3dgen modules imported successfully")
            except ImportError as e:
                self.logger.error(f"❌ Failed to import hy3dgen: {e}")
                # Try alternative import paths
                try:
                    import sys
                    sys.path.append('/root/hunyuan3d-run/venv/lib/python3.10/site-packages')
                    import hy3dgen
                    from hy3dgen.models import Hunyuan3DModel
                    from hy3dgen.utils import load_config, create_pipeline
                    self.logger.info("✅ hy3dgen modules imported with manual path")
                except ImportError as e2:
                    self.logger.error(f"❌ Still failed to import hy3dgen: {e2}")
                    raise ImportError(f"Cannot import hy3dgen: {e}")
            
            # Load config
            config_path = os.path.join(self.model_path, "config.yaml")
            if not os.path.exists(config_path):
                raise FileNotFoundError(f"Config file not found: {config_path}")
            
            self.logger.info(f"Loading config from: {config_path}")
            self.config = load_config(config_path)
            
            # Find model checkpoint
            checkpoint_files = list(Path(self.model_path).glob("*.ckpt")) + \
                              list(Path(self.model_path).glob("*.safetensors"))
            
            if not checkpoint_files:
                raise FileNotFoundError(f"No checkpoint files found in {self.model_path}")
            
            # Use the largest checkpoint file
            checkpoint_path = max(checkpoint_files, key=lambda f: f.stat().st_size)
            self.logger.info(f"Loading checkpoint: {checkpoint_path}")
            
            # Create and load model
            self.logger.info("Creating Hunyuan3D pipeline...")
            self.pipeline = create_pipeline(
                config=self.config,
                checkpoint_path=str(checkpoint_path),
                device=self.device
            )
            
            self.logger.info(f"✅ Hunyuan3D pipeline created successfully on {self.device}")
            
        except Exception as e:
            self.logger.error(f"Error loading Hunyuan3D model: {e}")
            raise

    def convert(self, image_path):
        """
        Convert image to 3D mesh using real Hunyuan3D model.
        
        Parameters
        ----------
        image_path : str
            Path to the input 2D image.
            
        Returns
        -------
        trimesh.Trimesh or None
            The generated mesh, or None if conversion failed.
        """
        try:
            if self.dummy_mode or self.pipeline is None:
                self.logger.warning("Using dummy conversion — Hunyuan3D model not loaded.")
                return self._dummy_mesh()
            
            self.logger.info(f"🚀 Running REAL Hunyuan3D inference for {image_path}")
            
            # Load and preprocess image
            image = self._preprocess_image(image_path)
            if image is None:
                return self._dummy_mesh()
            
            # Run Hunyuan3D inference
            with torch.no_grad():
                self.logger.info("Starting Hunyuan3D model inference...")
                
                # Generate 3D model using the pipeline
                result = self.pipeline(
                    image=image,
                    num_inference_steps=50,
                    guidance_scale=7.5,
                    return_dict=True
                )
                
                self.logger.info("✅ Hunyuan3D inference completed")
                
                # Extract mesh from result
                mesh = self._extract_mesh_from_result(result)
                
                if mesh is not None:
                    self.logger.info(f"✅ Generated mesh with {len(mesh.vertices)} vertices and {len(mesh.faces)} faces")
                    return mesh
                else:
                    self.logger.error("❌ Failed to extract mesh from result")
                    return self._dummy_mesh()
                
        except Exception as e:
            self.logger.error(f"❌ Error during Hunyuan3D conversion: {e}")
            self.logger.exception("Detailed error:")
            return self._dummy_mesh()

    def _preprocess_image(self, image_path):
        """Preprocess image for Hunyuan3D model."""
        try:
            self.logger.info(f"Preprocessing image: {image_path}")
            
            # Load image
            image = Image.open(image_path)
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            self.logger.info(f"Loaded image: {image.size}, mode: {image.mode}")
            
            # Get target size from config
            target_size = 512
            if self.config and 'image_size' in self.config:
                target_size = self.config['image_size']
            elif self.config and 'preprocessing' in self.config:
                target_size = self.config['preprocessing'].get('image_size', 512)
            
            # Resize image
            image = image.resize((target_size, target_size), Image.Resampling.LANCZOS)
            self.logger.info(f"Resized image to: {image.size}")
            
            return image
            
        except Exception as e:
            self.logger.error(f"❌ Error preprocessing image: {e}")
            return None

    def _extract_mesh_from_result(self, result):
        """Extract trimesh from Hunyuan3D result."""
        try:
            # Handle different possible result formats
            if hasattr(result, 'meshes') and result.meshes:
                mesh_data = result.meshes[0]
            elif hasattr(result, 'mesh'):
                mesh_data = result.mesh
            elif isinstance(result, dict):
                if 'meshes' in result:
                    mesh_data = result['meshes'][0] if result['meshes'] else None
                elif 'mesh' in result:
                    mesh_data = result['mesh']
                elif 'vertices' in result and 'faces' in result:
                    mesh_data = result
                else:
                    self.logger.error(f"Unknown result format: {list(result.keys())}")
                    return None
            else:
                self.logger.error(f"Unexpected result type: {type(result)}")
                return None
            
            if mesh_data is None:
                self.logger.error("No mesh data found in result")
                return None
            
            # Convert to trimesh format
            if hasattr(mesh_data, 'vertices') and hasattr(mesh_data, 'faces'):
                vertices = mesh_data.vertices
                faces = mesh_data.faces
            elif isinstance(mesh_data, dict):
                vertices = mesh_data.get('vertices', mesh_data.get('verts'))
                faces = mesh_data.get('faces', mesh_data.get('tris'))
            else:
                self.logger.error(f"Unknown mesh data format: {type(mesh_data)}")
                return None
            
            # Convert to numpy if needed
            if hasattr(vertices, 'cpu'):
                vertices = vertices.cpu().numpy()
            if hasattr(faces, 'cpu'):
                faces = faces.cpu().numpy()
            
            vertices = np.array(vertices)
            faces = np.array(faces)
            
            self.logger.info(f"Extracted: {vertices.shape} vertices, {faces.shape} faces")
            
            # Create and clean mesh
            mesh = trimesh.Trimesh(vertices=vertices, faces=faces)
            mesh.remove_duplicate_faces()
            mesh.remove_degenerate_faces()
            mesh.fix_normals()
            
            if len(mesh.vertices) == 0 or len(mesh.faces) == 0:
                self.logger.error("Generated mesh is empty")
                return None
            
            return mesh
            
        except Exception as e:
            self.logger.error(f"❌ Error extracting mesh: {e}")
            return None

    def _dummy_mesh(self):
        """Generate a placeholder cube mesh."""
        self.logger.info("Generating dummy cube mesh.")
        return trimesh.creation.box(extents=(1, 1, 1))
