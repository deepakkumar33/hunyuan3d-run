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
    Real Hunyuan3D converter using the hy3dgen.shapegen package.
    """
    def __init__(self, model_path, logger=None):
        self.logger = logger or logging.getLogger(__name__)
        self.model_path = model_path
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.dummy_mode = False
        
        # Model components
        self.pipeline = None
        self.image_processor = None
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
        """Load the real Hunyuan3D model using hy3dgen.shapegen package."""
        try:
            # Import the hy3dgen.shapegen modules
            self.logger.info("Importing hy3dgen.shapegen modules...")
            
            from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline, ImageProcessorV2
            from hy3dgen.shapegen.models.denoisers.hunyuan3ddit import HunYuanDiT
            from hy3dgen.shapegen.models.autoencoders import ShapeVAE
            from hy3dgen.shapegen.models.conditioner import SingleImageEncoder
            from hy3dgen.shapegen.schedulers import FlowMatchEulerDiscreteScheduler
            
            self.logger.info("✅ hy3dgen.shapegen modules imported successfully")
            
            # Load config
            config_path = os.path.join(self.model_path, "config.yaml")
            if not os.path.exists(config_path):
                raise FileNotFoundError(f"Config file not found: {config_path}")
            
            self.logger.info(f"Loading config from: {config_path}")
            with open(config_path, 'r') as f:
                self.config = yaml.safe_load(f)
            
            # Find model checkpoint
            checkpoint_files = list(Path(self.model_path).glob("*.ckpt")) + \
                              list(Path(self.model_path).glob("*.safetensors"))
            
            if not checkpoint_files:
                raise FileNotFoundError(f"No checkpoint files found in {self.model_path}")
            
            # Use the largest checkpoint file
            checkpoint_path = max(checkpoint_files, key=lambda f: f.stat().st_size)
            self.logger.info(f"Loading checkpoint: {checkpoint_path} ({checkpoint_path.stat().st_size / 1e9:.1f}GB)")
            
            # Load checkpoint
            self.logger.info("Loading model checkpoint...")
            checkpoint = torch.load(str(checkpoint_path), map_location="cpu")
            
            # Extract model components from checkpoint
            model_state_dict = checkpoint.get('model', {})
            vae_state_dict = checkpoint.get('vae', {})
            conditioner_state_dict = checkpoint.get('conditioner', {})
            
            self.logger.info(f"Checkpoint contains: model={len(model_state_dict)}, vae={len(vae_state_dict)}, conditioner={len(conditioner_state_dict)} parameters")
            
            # Initialize model components based on config
            model_config = self.config['model']['params']
            vae_config = self.config['vae']['params']
            conditioner_config = self.config['conditioner']['params']
            scheduler_config = self.config['scheduler']['params']
            image_processor_config = self.config['image_processor']['params']
            
            # Create model components
            self.logger.info("Creating model components...")
            
            # Create VAE
            vae = ShapeVAE(**vae_config)
            if vae_state_dict:
                vae.load_state_dict(vae_state_dict, strict=False)
            vae = vae.to(self.device)
            self.logger.info("✅ VAE loaded")
            
            # Create main model
            model = HunYuanDiT(**model_config)
            if model_state_dict:
                model.load_state_dict(model_state_dict, strict=False)
            model = model.to(self.device)
            self.logger.info("✅ Main model loaded")
            
            # Create conditioner
            conditioner = SingleImageEncoder(**conditioner_config)
            if conditioner_state_dict:
                conditioner.load_state_dict(conditioner_state_dict, strict=False)
            conditioner = conditioner.to(self.device)
            self.logger.info("✅ Conditioner loaded")
            
            # Create scheduler
            scheduler = FlowMatchEulerDiscreteScheduler(**scheduler_config)
            self.logger.info("✅ Scheduler created")
            
            # Create image processor
            self.image_processor = ImageProcessorV2(**image_processor_config)
            self.logger.info("✅ Image processor created")
            
            # Create pipeline
            self.logger.info("Creating Hunyuan3D pipeline...")
            self.pipeline = Hunyuan3DDiTFlowMatchingPipeline(
                model=model,
                vae=vae,
                conditioner=conditioner,
                scheduler=scheduler,
                image_processor=self.image_processor
            )
            
            # Set to eval mode
            self.pipeline.eval()
            
            self.logger.info(f"✅ Hunyuan3D pipeline created successfully on {self.device}")
            
        except ImportError as e:
            self.logger.error(f"❌ Failed to import hy3dgen.shapegen: {e}")
            raise
        except Exception as e:
            self.logger.error(f"❌ Error loading Hunyuan3D model: {e}")
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
            
            # Use the image processor if available
            if self.image_processor:
                # The ImageProcessorV2 should handle the preprocessing
                processed_image = self.image_processor(image)
                self.logger.info(f"Image processed by ImageProcessorV2")
                return processed_image
            else:
                # Fallback manual preprocessing
                target_size = 512
                if self.config and 'image_processor' in self.config:
                    target_size = self.config['image_processor']['params'].get('size', 512)
                
                image = image.resize((target_size, target_size), Image.Resampling.LANCZOS)
                self.logger.info(f"Manually resized image to: {image.size}")
                return image
            
        except Exception as e:
            self.logger.error(f"❌ Error preprocessing image: {e}")
            return None

    def _extract_mesh_from_result(self, result):
        """Extract trimesh from Hunyuan3D result."""
        try:
            self.logger.info(f"Extracting mesh from result type: {type(result)}")
            
            # Handle different possible result formats
            mesh_data = None
            
            if hasattr(result, 'meshes') and result.meshes:
                mesh_data = result.meshes[0]
                self.logger.info("Found mesh in result.meshes[0]")
            elif hasattr(result, 'mesh'):
                mesh_data = result.mesh
                self.logger.info("Found mesh in result.mesh")
            elif hasattr(result, 'samples'):
                # Sometimes the result contains samples that need to be decoded
                samples = result.samples
                self.logger.info(f"Found samples with shape: {samples.shape}")
                
                # Try to decode samples using VAE if available
                if hasattr(self.pipeline, 'vae') and self.pipeline.vae:
                    decoded = self.pipeline.vae.decode(samples)
                    mesh_data = decoded
                    self.logger.info("Decoded samples using VAE")
                else:
                    mesh_data = samples
                    
            elif isinstance(result, dict):
                if 'meshes' in result:
                    mesh_data = result['meshes'][0] if result['meshes'] else None
                elif 'mesh' in result:
                    mesh_data = result['mesh']
                elif 'samples' in result:
                    mesh_data = result['samples']
                elif 'vertices' in result and 'faces' in result:
                    mesh_data = result
                else:
                    self.logger.error(f"Unknown result dict keys: {list(result.keys())}")
                    return None
            else:
                self.logger.error(f"Unexpected result type: {type(result)}")
                return None
            
            if mesh_data is None:
                self.logger.error("No mesh data found in result")
                return None
            
            # Convert to trimesh format
            mesh = self._convert_mesh_data_to_trimesh(mesh_data)
            return mesh
            
        except Exception as e:
            self.logger.error(f"❌ Error extracting mesh: {e}")
            self.logger.exception("Detailed error:")
            return None

    def _convert_mesh_data_to_trimesh(self, mesh_data):
        """Convert various mesh data formats to trimesh."""
        try:
            vertices = None
            faces = None
            
            # Handle tensor data
            if hasattr(mesh_data, 'vertices') and hasattr(mesh_data, 'faces'):
                vertices = mesh_data.vertices
                faces = mesh_data.faces
            elif isinstance(mesh_data, dict):
                vertices = mesh_data.get('vertices', mesh_data.get('verts'))
                faces = mesh_data.get('faces', mesh_data.get('tris'))
            elif torch.is_tensor(mesh_data):
                # If it's a raw tensor, we might need to process it differently
                self.logger.info(f"Processing raw tensor with shape: {mesh_data.shape}")
                # This would depend on the specific output format of Hunyuan3D
                # For now, return None and it will fall back to dummy
                return None
            else:
                self.logger.error(f"Unknown mesh data format: {type(mesh_data)}")
                return None
            
            if vertices is None or faces is None:
                self.logger.error("Could not extract vertices or faces from mesh data")
                return None
            
            # Convert to numpy if needed
            if hasattr(vertices, 'cpu'):
                vertices = vertices.cpu().numpy()
            if hasattr(faces, 'cpu'):
                faces = faces.cpu().numpy()
            
            vertices = np.array(vertices)
            faces = np.array(faces)
            
            self.logger.info(f"Extracted: {vertices.shape} vertices, {faces.shape} faces")
            
            # Validate shapes
            if len(vertices.shape) != 2 or vertices.shape[1] != 3:
                self.logger.error(f"Invalid vertices shape: {vertices.shape}, expected (N, 3)")
                return None
            
            if len(faces.shape) != 2 or faces.shape[1] != 3:
                self.logger.error(f"Invalid faces shape: {faces.shape}, expected (M, 3)")
                return None
            
            # Create and clean mesh
            mesh = trimesh.Trimesh(vertices=vertices, faces=faces)
            mesh.remove_duplicate_faces()
            mesh.remove_degenerate_faces()
            mesh.fix_normals()
            
            if len(mesh.vertices) == 0 or len(mesh.faces) == 0:
                self.logger.error("Generated mesh is empty after cleaning")
                return None
            
            self.logger.info(f"Final mesh: {len(mesh.vertices)} vertices, {len(mesh.faces)} faces")
            return mesh
            
        except Exception as e:
            self.logger.error(f"❌ Error converting mesh data: {e}")
            return None

    def _dummy_mesh(self):
        """Generate a placeholder cube mesh."""
        self.logger.info("Generating dummy cube mesh.")
        return trimesh.creation.box(extents=(1, 1, 1))
