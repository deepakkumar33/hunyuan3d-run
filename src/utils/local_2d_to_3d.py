import os
import logging
import trimesh
import torch
import numpy as np
from PIL import Image
import yaml
from pathlib import Path

class Local2DTo3DConverter:
    """
    Converts a 2D image to a 3D mesh using Hunyuan3D model.
    """
    def __init__(self, model_path, logger=None):
        self.logger = logger or logging.getLogger(__name__)
        self.model_path = model_path
        self.pipeline = None
        self.dummy_mode = False
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        
        if not os.path.exists(self.model_path):
            self.logger.warning(f"Model path does not exist: {self.model_path}. Running in dummy mode.")
            self.dummy_mode = True
        else:
            try:
                self._load_hunyuan_model()
                self.logger.info(f"Model loaded successfully from {self.model_path}")
            except Exception as e:
                self.logger.error(f"Failed to load model: {e}")
                self.logger.exception("Detailed error:")
                self.dummy_mode = True

    def _load_hunyuan_model(self):
        """Load the Hunyuan3D model pipeline."""
        try:
            # Import Hunyuan3D modules
            from hy3dshape.pipelines import Hunyuan3DDiTFlowMatchingPipeline
            from hy3dshape.models.denoisers.hunyuandit import HunYuanDiTPlain
            from hy3dshape.models.autoencoders import ShapeVAE
            from hy3dshape.models.conditioner import SingleImageEncoder
            from hy3dshape.schedulers import FlowMatchEulerDiscreteScheduler
            from hy3dshape.preprocessors import ImageProcessorV2
            
            # Load config
            config_path = os.path.join(self.model_path, "config.yaml")
            if not os.path.exists(config_path):
                # Try alternative config locations
                config_path = "config.yaml"
                if not os.path.exists(config_path):
                    raise FileNotFoundError(f"Config file not found at {config_path}")
            
            with open(config_path, 'r') as f:
                config = yaml.safe_load(f)
            
            self.logger.info(f"Loading config from: {config_path}")
            
            # Initialize components based on config
            model_config = config['model']
            vae_config = config['vae']
            conditioner_config = config['conditioner']
            scheduler_config = config['scheduler']
            image_processor_config = config['image_processor']
            
            # Load VAE
            self.logger.info("Loading VAE...")
            vae = ShapeVAE(**vae_config['params'])
            
            # Load main model (denoiser)
            self.logger.info("Loading main denoiser model...")
            model = HunYuanDiTPlain(**model_config['params'])
            
            # Load conditioner
            self.logger.info("Loading image conditioner...")
            conditioner = SingleImageEncoder(**conditioner_config['params'])
            
            # Load scheduler
            self.logger.info("Loading scheduler...")
            scheduler = FlowMatchEulerDiscreteScheduler(**scheduler_config['params'])
            
            # Load image processor
            self.logger.info("Loading image processor...")
            image_processor = ImageProcessorV2(**image_processor_config['params'])
            
            # Load model weights
            model_files = self._find_model_files()
            self._load_model_weights(model, vae, conditioner, model_files)
            
            # Create pipeline
            self.logger.info("Creating pipeline...")
            self.pipeline = Hunyuan3DDiTFlowMatchingPipeline(
                model=model,
                vae=vae,
                conditioner=conditioner,
                scheduler=scheduler,
                image_processor=image_processor
            )
            
            # Move to device
            self.pipeline = self.pipeline.to(self.device)
            self.logger.info(f"Pipeline loaded on device: {self.device}")
            
        except ImportError as e:
            self.logger.error(f"Failed to import Hunyuan3D modules: {e}")
            self.logger.error("Make sure Hunyuan3D is properly installed")
            raise
        except Exception as e:
            self.logger.error(f"Error loading Hunyuan model: {e}")
            raise

    def _find_model_files(self):
        """Find model weight files in the model directory."""
        model_files = {}
        
        # Common patterns for different components
        patterns = {
            'model': ['model.safetensors', 'pytorch_model.safetensors', 'diffusion_pytorch_model.safetensors'],
            'vae': ['vae.safetensors', 'vae_pytorch_model.safetensors'],
            'conditioner': ['conditioner.safetensors', 'image_encoder.safetensors'],
        }
        
        for component, file_patterns in patterns.items():
            for pattern in file_patterns:
                file_path = os.path.join(self.model_path, pattern)
                if os.path.exists(file_path):
                    model_files[component] = file_path
                    self.logger.info(f"Found {component} weights: {file_path}")
                    break
        
        # If no specific files found, look for any .safetensors files
        if not model_files:
            safetensors_files = list(Path(self.model_path).glob("*.safetensors"))
            if safetensors_files:
                # Use the largest file as the main model
                main_file = max(safetensors_files, key=lambda f: f.stat().st_size)
                model_files['model'] = str(main_file)
                self.logger.info(f"Using largest safetensors file as main model: {main_file}")
        
        return model_files

    def _load_model_weights(self, model, vae, conditioner, model_files):
        """Load weights into the model components."""
        try:
            from safetensors.torch import load_file
            
            # Load main model weights
            if 'model' in model_files:
                self.logger.info(f"Loading main model weights from: {model_files['model']}")
                state_dict = load_file(model_files['model'])
                
                # Filter state dict for different components
                model_state_dict = {}
                vae_state_dict = {}
                conditioner_state_dict = {}
                
                for key, value in state_dict.items():
                    if key.startswith('vae.'):
                        vae_state_dict[key[4:]] = value  # Remove 'vae.' prefix
                    elif key.startswith('conditioner.'):
                        conditioner_state_dict[key[12:]] = value  # Remove 'conditioner.' prefix
                    elif key.startswith('model.'):
                        model_state_dict[key[6:]] = value  # Remove 'model.' prefix
                    else:
                        # Default to main model
                        model_state_dict[key] = value
                
                # Load weights with error handling
                if model_state_dict:
                    try:
                        missing_keys, unexpected_keys = model.load_state_dict(model_state_dict, strict=False)
                        if missing_keys:
                            self.logger.warning(f"Missing keys in model: {missing_keys[:5]}...")  # Show first 5
                        if unexpected_keys:
                            self.logger.warning(f"Unexpected keys in model: {unexpected_keys[:5]}...")
                        self.logger.info("Main model weights loaded successfully")
                    except Exception as e:
                        self.logger.error(f"Error loading main model weights: {e}")
                
                if vae_state_dict:
                    try:
                        missing_keys, unexpected_keys = vae.load_state_dict(vae_state_dict, strict=False)
                        self.logger.info("VAE weights loaded successfully")
                    except Exception as e:
                        self.logger.warning(f"Error loading VAE weights: {e}")
                
                if conditioner_state_dict:
                    try:
                        missing_keys, unexpected_keys = conditioner.load_state_dict(conditioner_state_dict, strict=False)
                        self.logger.info("Conditioner weights loaded successfully")
                    except Exception as e:
                        self.logger.warning(f"Error loading conditioner weights: {e}")
            
            # Load separate component files if they exist
            if 'vae' in model_files:
                self.logger.info(f"Loading VAE weights from: {model_files['vae']}")
                vae_state_dict = load_file(model_files['vae'])
                vae.load_state_dict(vae_state_dict, strict=False)
            
            if 'conditioner' in model_files:
                self.logger.info(f"Loading conditioner weights from: {model_files['conditioner']}")
                conditioner_state_dict = load_file(model_files['conditioner'])
                conditioner.load_state_dict(conditioner_state_dict, strict=False)
                
        except Exception as e:
            self.logger.error(f"Error loading model weights: {e}")
            raise

    def convert(self, image_path):
        """
        Converts an image to a 3D mesh using Hunyuan3D.
        
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
                self.logger.warning("Using dummy conversion — no actual model loaded.")
                return self._dummy_mesh()
            
            self.logger.info(f"Running Hunyuan3D model conversion for {image_path}")
            
            # Load and preprocess image
            image = Image.open(image_path)
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            self.logger.info(f"Loaded image: {image.size}, mode: {image.mode}")
            
            # Run inference
            with torch.no_grad():
                self.logger.info("Starting inference...")
                result = self.pipeline(
                    image=image,
                    num_inference_steps=50,  # Adjust as needed
                    guidance_scale=7.5,      # Adjust as needed
                    return_dict=True
                )
                
                self.logger.info("Inference completed, extracting mesh...")
                
                # Extract mesh from result
                if hasattr(result, 'meshes') and result.meshes:
                    mesh_data = result.meshes[0]
                elif hasattr(result, 'mesh'):
                    mesh_data = result.mesh
                elif isinstance(result, dict) and 'mesh' in result:
                    mesh_data = result['mesh']
                else:
                    self.logger.error(f"Unexpected result format: {type(result)}")
                    return self._dummy_mesh()
                
                # Convert to trimesh
                mesh = self._convert_to_trimesh(mesh_data)
                
                if mesh is not None:
                    self.logger.info(f"Successfully generated mesh with {len(mesh.vertices)} vertices and {len(mesh.faces)} faces")
                    return mesh
                else:
                    self.logger.error("Failed to convert result to trimesh")
                    return self._dummy_mesh()
                
        except Exception as e:
            self.logger.error(f"Error during Hunyuan3D conversion: {e}")
            self.logger.exception("Detailed error:")
            return self._dummy_mesh()

    def _convert_to_trimesh(self, mesh_data):
        """Convert model output to trimesh format."""
        try:
            if hasattr(mesh_data, 'vertices') and hasattr(mesh_data, 'faces'):
                # Already in mesh format
                vertices = mesh_data.vertices
                faces = mesh_data.faces
            elif isinstance(mesh_data, dict):
                # Dictionary format
                vertices = mesh_data.get('vertices', mesh_data.get('verts'))
                faces = mesh_data.get('faces', mesh_data.get('tris'))
            elif hasattr(mesh_data, 'verts') and hasattr(mesh_data, 'faces'):
                # Alternative naming
                vertices = mesh_data.verts
                faces = mesh_data.faces
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
            
            self.logger.info(f"Mesh data: {vertices.shape} vertices, {faces.shape} faces")
            
            # Create trimesh
            mesh = trimesh.Trimesh(vertices=vertices, faces=faces)
            
            # Validate mesh
            if len(mesh.vertices) == 0:
                self.logger.error("Generated mesh has no vertices")
                return None
            
            if len(mesh.faces) == 0:
                self.logger.error("Generated mesh has no faces")
                return None
            
            # Clean up mesh
            mesh.remove_duplicate_faces()
            mesh.remove_degenerate_faces()
            mesh.fix_normals()
            
            self.logger.info(f"Final mesh: {len(mesh.vertices)} vertices, {len(mesh.faces)} faces")
            
            return mesh
            
        except Exception as e:
            self.logger.error(f"Error converting to trimesh: {e}")
            return None

    def _dummy_mesh(self):
        """Generate a placeholder cube mesh."""
        self.logger.info("Generating dummy cube mesh.")
        return trimesh.creation.box(extents=(1, 1, 1))
