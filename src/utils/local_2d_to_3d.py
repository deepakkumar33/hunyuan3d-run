"""
Real Hunyuan3D 2D-to-3D converter with actual model inference
"""
import os
import glob
import logging
import traceback
import torch
import yaml
from PIL import Image
import numpy as np
from typing import List, Optional

# Set CUDA memory allocation configuration before any CUDA operations
os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "expandable_segments:True"

try:
    # Import Hunyuan3D modules from the correct folder structure
    import sys
    import os
    
    # Add Hunyuan3D_2_1 to Python path if not already there
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    hunyuan_path = os.path.join(project_root, 'Hunyuan3D_2_1')
    
    # Also try current working directory as fallback
    fallback_path = os.path.join(os.getcwd(), 'Hunyuan3D_2_1')
    
    if os.path.exists(hunyuan_path):
        if hunyuan_path not in sys.path:
            sys.path.insert(0, hunyuan_path)
        import_path = hunyuan_path
    elif os.path.exists(fallback_path):
        if fallback_path not in sys.path:
            sys.path.insert(0, fallback_path)
        import_path = fallback_path
    else:
        raise ImportError(f"Hunyuan3D_2_1 folder not found. Searched:\n- {hunyuan_path}\n- {fallback_path}")
    
    # Import all required modules from the correct Hunyuan3D_2_1 structure
    from hy3dshape.schedulers import FlowMatchEulerDiscreteScheduler
    from hy3dshape.pipelines import Hunyuan3DDiTFlowMatchingPipeline  
    from hy3dshape.models.autoencoders import ShapeVAE
    from hy3dshape.models.denoisers.hunyuandit import HunYuanDiTPlain
    from hy3dshape.models.conditioner import SingleImageEncoder
    from hy3dshape.preprocessors import ImageProcessorV2
    from hy3dshape.utils.mesh_utils import point_cloud_to_mesh, save_obj, save_ply
    
    print(f"✅ Successfully imported Hunyuan3D modules from: {import_path}")
    
except ImportError as e:
    # Provide detailed error diagnosis
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    hunyuan_folder = os.path.join(project_root, 'Hunyuan3D_2_1')
    fallback_folder = os.path.join(os.getcwd(), 'Hunyuan3D_2_1')
    
    error_msg = f"❌ Failed to import Hunyuan3D modules: {e}\n\n"
    error_msg += "📁 Folder Structure Check:\n"
    
    # Check main folders
    if os.path.exists(hunyuan_folder):
        error_msg += f"✅ Found: {hunyuan_folder}\n"
        hy3dshape_path = os.path.join(hunyuan_folder, 'hy3dshape')
        if os.path.exists(hy3dshape_path):
            error_msg += f"✅ Found: {hy3dshape_path}\n"
            
            # Check specific module files
            modules_to_check = [
                'schedulers.py',
                'pipelines.py', 
                'models/autoencoders.py',
                'models/denoisers/hunyuandit.py',
                'models/conditioner.py',
                'preprocessors.py',
                'utils/mesh_utils.py'
            ]
            
            for module in modules_to_check:
                module_path = os.path.join(hy3dshape_path, module)
                if os.path.exists(module_path):
                    error_msg += f"✅ Found: hy3dshape/{module}\n"
                else:
                    error_msg += f"❌ Missing: hy3dshape/{module}\n"
        else:
            error_msg += f"❌ Missing: {hy3dshape_path}\n"
    else:
        error_msg += f"❌ Missing: {hunyuan_folder}\n"
        
    if os.path.exists(fallback_folder):
        error_msg += f"✅ Fallback found: {fallback_folder}\n"
    else:
        error_msg += f"❌ Fallback missing: {fallback_folder}\n"
    
    error_msg += "\n💡 Solutions:\n"
    error_msg += "1. Ensure Hunyuan3D_2_1 folder is in your project root\n"
    error_msg += "2. Check that all required module files exist\n" 
    error_msg += "3. Verify Python dependencies are installed\n"
    error_msg += f"4. Current working directory: {os.getcwd()}\n"
    
    raise ImportError(error_msg)

class Local2DTo3DConverter:
    def __init__(self, logger: logging.Logger, output_dir: str):
        self.logger = logger
        self.output_dir = output_dir
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.use_half_precision = torch.cuda.is_available()  # Use half precision on GPU
        self.logger.info(f"Using device: {self.device}")
        self.logger.info(f"Half precision enabled: {self.use_half_precision}")
        
        # Find and validate model folder
        self.model_folder = self._find_model_folder()
        if not self.model_folder:
            raise RuntimeError("Pipeline loading failed: model folder not found")
        
        self.logger.info(f"✅ Found model folder: {self.model_folder}")
        
        # Load configuration and pipeline
        self.config = self._load_config()
        self.pipeline = None
        self._load_pipeline()
        
    def _find_model_folder(self) -> Optional[str]:
        """Find the Hunyuan3D model folder"""
        base_path = "./models/hunyuan3d-2/"
        candidates = glob.glob(os.path.join(base_path, "*"))
        
        self.logger.info(f"🔍 Searching for Hunyuan3D model folder under {base_path}")
        
        for folder in candidates:
            if os.path.isdir(folder):
                # Check for required files
                has_config = os.path.isfile(os.path.join(folder, "config.yaml"))
                has_model = (os.path.isfile(os.path.join(folder, "model.fp16.ckpt")) or 
                           os.path.isfile(os.path.join(folder, "model.safetensors")) or
                           os.path.isfile(os.path.join(folder, "pytorch_model.bin")))
                
                if has_config and has_model:
                    self.logger.info(f"✅ Valid model folder found: {folder}")
                    return folder
                else:
                    self.logger.debug(f"❌ Invalid folder {folder}: config={has_config}, model={has_model}")
        
        # Fallback: try the base path itself
        if os.path.isfile(os.path.join(base_path, "config.yaml")):
            return base_path
            
        return None
    
    def _load_config(self) -> dict:
        """Load the model configuration"""
        config_path = os.path.join(self.model_folder, "config.yaml")
        
        if not os.path.exists(config_path):
            raise FileNotFoundError(f"Config file not found: {config_path}")
        
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
            
            self.logger.info(f"✅ Configuration loaded from {config_path}")
            return config
            
        except Exception as e:
            raise RuntimeError(f"Failed to load config: {e}")
    
    def _find_model_weights(self) -> str:
        """Find the model weights file"""
        possible_names = [
            "model.fp16.ckpt",
            "model.safetensors", 
            "pytorch_model.bin",
            "model.ckpt",
            "checkpoint.ckpt"
        ]
        
        for name in possible_names:
            path = os.path.join(self.model_folder, name)
            if os.path.isfile(path):
                self.logger.info(f"✅ Found model weights: {path}")
                return path
        
        raise FileNotFoundError(f"No model weights found in {self.model_folder}")
    
    def _load_pipeline(self):
        """Load the complete Hunyuan3D pipeline"""
        try:
            self.logger.info("🔄 Loading Hunyuan3D pipeline components...")
            
            # Check available GPU memory
            if torch.cuda.is_available():
                gpu_memory = torch.cuda.get_device_properties(0).total_memory / (1024**3)
                self.logger.info(f"GPU memory available: {gpu_memory:.1f}GB")
                
                # Clear cache before loading
                torch.cuda.empty_cache()
            
            # Load model weights
            weights_path = self._find_model_weights()
            
            if weights_path.endswith('.safetensors'):
                from safetensors.torch import load_file
                checkpoint = load_file(weights_path, device=self.device)
            else:
                checkpoint = torch.load(weights_path, map_location=self.device, weights_only=True)
            
            self.logger.info(f"✅ Model weights loaded from {weights_path}")
            
            # Initialize scheduler
            scheduler_config = self.config.get('scheduler', {}).get('params', {})
            self.scheduler = FlowMatchEulerDiscreteScheduler(**scheduler_config)
            self.logger.info("✅ FlowMatchEulerDiscreteScheduler initialized")
            
            # Initialize VAE with half precision if enabled
            vae_config = self.config.get('vae', {}).get('params', {})
            self.vae = ShapeVAE(**vae_config).to(self.device)
            if self.use_half_precision:
                self.vae = self.vae.half()
                self.logger.info("✅ VAE converted to half precision")
            
            # Load VAE weights if available
            if 'vae' in checkpoint:
                vae_state_dict = checkpoint['vae']
                if self.use_half_precision:
                    # Convert checkpoint weights to half precision if needed
                    vae_state_dict = {k: v.half() if v.dtype == torch.float32 else v 
                                     for k, v in vae_state_dict.items()}
                self.vae.load_state_dict(vae_state_dict)
                self.logger.info("✅ VAE weights loaded")
            
            # Initialize image conditioner with half precision if enabled
            conditioner_config = self.config.get('conditioner', {}).get('params', {})
            self.conditioner = SingleImageEncoder(**conditioner_config).to(self.device)
            if self.use_half_precision:
                self.conditioner = self.conditioner.half()
                self.logger.info("✅ Conditioner converted to half precision")
            
            # Load conditioner weights if available
            if 'conditioner' in checkpoint:
                conditioner_state_dict = checkpoint['conditioner']
                if self.use_half_precision:
                    # Convert checkpoint weights to half precision if needed
                    conditioner_state_dict = {k: v.half() if v.dtype == torch.float32 else v 
                                            for k, v in conditioner_state_dict.items()}
                self.conditioner.load_state_dict(conditioner_state_dict)
                self.logger.info("✅ Conditioner weights loaded")
            
            # Initialize the main denoising model with half precision
            model_config = self.config.get('model', {}).get('params', {})
            self.model = HunYuanDiTPlain(**model_config)
            if self.use_half_precision:
                self.model = self.model.half()
                self.logger.info("✅ Main model converted to half precision")
            self.model = self.model.to(self.device)
            
            # Load main model weights
            if 'model' in checkpoint:
                model_state_dict = checkpoint['model']
                if self.use_half_precision:
                    # Convert checkpoint weights to half precision if needed
                    model_state_dict = {k: v.half() if v.dtype == torch.float32 else v 
                                      for k, v in model_state_dict.items()}
                self.model.load_state_dict(model_state_dict)
                self.logger.info("✅ Main model weights loaded")
            
            # Initialize image processor
            processor_config = self.config.get('image_processor', {}).get('params', {})
            self.image_processor = ImageProcessorV2(**processor_config)
            self.logger.info("✅ Image processor initialized")
            
            # Create the complete pipeline
            pipeline_config = self.config.get('pipeline', {}).get('params', {})
            self.pipeline = Hunyuan3DDiTFlowMatchingPipeline(
                model=self.model,
                vae=self.vae,
                scheduler=self.scheduler,
                conditioner=self.conditioner,
                image_processor=self.image_processor,
                **pipeline_config
            )
            
            self.logger.info("✅ Complete Hunyuan3D pipeline loaded successfully")
            
            # Set to evaluation mode
            self.model.eval()
            self.vae.eval()
            self.conditioner.eval()
            
            # Clear cache after loading
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                memory_allocated = torch.cuda.memory_allocated(0) / (1024**3)
                self.logger.info(f"GPU memory allocated after loading: {memory_allocated:.2f}GB")
            
        except Exception as e:
            self.logger.error(f"Pipeline loading failed: {traceback.format_exc()}")
            raise RuntimeError(f"Pipeline loading failed: {e}")
    
    def _preprocess_images(self, image_paths: List[str]) -> torch.Tensor:
        """Preprocess input images for the model"""
        processed_images = []
        
        for img_path in image_paths:
            try:
                # Load and process image
                image = Image.open(img_path).convert('RGB')
                processed = self.image_processor(image)
                
                # Extract tensor from processed result (handle both dict and tensor returns)
                if isinstance(processed, dict):
                    # If preprocessor returns a dict, extract the image tensor
                    if "image" in processed:
                        image_tensor = processed["image"]
                        self.logger.debug(f"✅ Extracted image tensor from dict for: {img_path}")
                    elif "pixel_values" in processed:
                        image_tensor = processed["pixel_values"]
                        self.logger.debug(f"✅ Extracted pixel_values tensor from dict for: {img_path}")
                    elif "input" in processed:
                        image_tensor = processed["input"]
                        self.logger.debug(f"✅ Extracted input tensor from dict for: {img_path}")
                    else:
                        # Try to find the first tensor value in the dict
                        tensor_values = [v for v in processed.values() if isinstance(v, torch.Tensor)]
                        if tensor_values:
                            image_tensor = tensor_values[0]
                            self.logger.debug(f"✅ Using first tensor from dict for: {img_path}")
                        else:
                            raise ValueError(f"No tensor found in preprocessor output dict: {list(processed.keys())}")
                elif isinstance(processed, torch.Tensor):
                    # If preprocessor returns a tensor directly
                    image_tensor = processed
                    self.logger.debug(f"✅ Using tensor directly for: {img_path}")
                else:
                    # Handle other types (list, tuple, etc.)
                    if hasattr(processed, '__iter__') and not isinstance(processed, str):
                        # Try to find a tensor in an iterable
                        tensor_items = [item for item in processed if isinstance(item, torch.Tensor)]
                        if tensor_items:
                            image_tensor = tensor_items[0]
                            self.logger.debug(f"✅ Extracted tensor from iterable for: {img_path}")
                        else:
                            raise ValueError(f"No tensor found in preprocessor output: {type(processed)}")
                    else:
                        raise ValueError(f"Unexpected preprocessor output type: {type(processed)}")
                
                # Ensure we have a valid tensor
                if not isinstance(image_tensor, torch.Tensor):
                    raise ValueError(f"Extracted item is not a tensor: {type(image_tensor)}")
                
                # Ensure tensor has the right dimensions (add batch dim if needed)
                if image_tensor.dim() == 3:  # [C, H, W]
                    image_tensor = image_tensor.unsqueeze(0)  # [1, C, H, W]
                elif image_tensor.dim() == 2:  # [H, W] - grayscale
                    image_tensor = image_tensor.unsqueeze(0).unsqueeze(0)  # [1, 1, H, W]
                elif image_tensor.dim() == 4:  # [B, C, H, W] - already batched
                    if image_tensor.shape[0] == 1:
                        pass  # Single image batch, keep as is
                    else:
                        # Multiple images in batch, take first one
                        image_tensor = image_tensor[0:1]
                        self.logger.debug(f"✅ Extracted first image from batch for: {img_path}")
                
                processed_images.append(image_tensor)
                self.logger.debug(f"✅ Preprocessed image {img_path}: shape={image_tensor.shape}, dtype={image_tensor.dtype}")
                
            except Exception as e:
                self.logger.error(f"Failed to preprocess {img_path}: {e}")
                self.logger.error(f"Preprocessor output type: {type(processed) if 'processed' in locals() else 'unknown'}")
                if 'processed' in locals() and isinstance(processed, dict):
                    self.logger.error(f"Dict keys: {list(processed.keys())}")
                raise
        
        # Ensure all tensors have the same shape for stacking
        if len(processed_images) > 1:
            # Get target shape from first tensor
            target_shape = processed_images[0].shape
            
            # Verify all tensors have compatible shapes
            for i, tensor in enumerate(processed_images):
                if tensor.shape != target_shape:
                    self.logger.warning(f"Tensor {i} shape mismatch: {tensor.shape} vs {target_shape}")
                    # Try to reshape or crop to match
                    if tensor.dim() == target_shape.__len__():
                        # Same number of dimensions, try to interpolate
                        if tensor.dim() == 4:  # [B, C, H, W]
                            tensor = torch.nn.functional.interpolate(
                                tensor, size=target_shape[2:], mode='bilinear', align_corners=False
                            )
                            processed_images[i] = tensor
                            self.logger.debug(f"✅ Resized tensor {i} to match target shape")
        
        # Stack images into batch
        try:
            if len(processed_images) == 1:
                image_batch = processed_images[0].to(self.device)
            else:
                image_batch = torch.cat(processed_images, dim=0).to(self.device)
            
            self.logger.debug(f"✅ Created image batch: shape={image_batch.shape}, dtype={image_batch.dtype}")
            
        except Exception as e:
            self.logger.error(f"Failed to stack/concatenate tensors: {e}")
            self.logger.error(f"Tensor shapes: {[t.shape for t in processed_images]}")
            raise RuntimeError(f"Could not create image batch: {e}")
        
        # Convert to half precision if model uses half precision
        if self.use_half_precision and image_batch.dtype == torch.float32:
            image_batch = image_batch.half()
            self.logger.debug("✅ Converted input images to half precision")
        
        return image_batch
    
    def _generate_3d_mesh(self, image_batch: torch.Tensor) -> np.ndarray:
        """Generate 3D mesh from preprocessed images"""
        try:
            with torch.no_grad():
                self.logger.info("🔄 Running Hunyuan3D inference...")
                
                # Clear cache before inference
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                    memory_before = torch.cuda.memory_allocated(0) / (1024**3)
                    self.logger.info(f"GPU memory before inference: {memory_before:.2f}GB")
                
                # Convert torch tensor back to PIL images if needed
                pipeline_input = image_batch
                if isinstance(image_batch, torch.Tensor):
                    try:
                        from torchvision.transforms import ToPILImage
                        to_pil = ToPILImage()
                        
                        # Convert tensor to PIL images
                        pil_images = []
                        
                        # Handle batch dimension
                        if image_batch.dim() == 4:  # [B, C, H, W]
                            batch_size = image_batch.shape[0]
                            for i in range(batch_size):
                                # Extract single image tensor [C, H, W]
                                single_image = image_batch[i]
                                
                                # Ensure values are in [0, 1] range for ToPILImage
                                if single_image.max() > 1.0:
                                    single_image = single_image / 255.0
                                
                                # Convert to CPU and correct dtype
                                single_image = single_image.cpu().float()
                                
                                # Convert to PIL Image
                                pil_image = to_pil(single_image)
                                pil_images.append(pil_image)
                                
                        elif image_batch.dim() == 3:  # [C, H, W] - single image
                            single_image = image_batch
                            
                            # Ensure values are in [0, 1] range
                            if single_image.max() > 1.0:
                                single_image = single_image / 255.0
                            
                            # Convert to CPU and correct dtype
                            single_image = single_image.cpu().float()
                            
                            # Convert to PIL Image
                            pil_image = to_pil(single_image)
                            pil_images.append(pil_image)
                        else:
                            raise ValueError(f"Unexpected tensor dimensions: {image_batch.shape}")
                        
                        # Use PIL images as pipeline input
                        if len(pil_images) == 1:
                            pipeline_input = pil_images[0]
                        else:
                            pipeline_input = pil_images
                            
                        self.logger.info(f"✅ Converted {len(pil_images)} tensor(s) to PIL image(s)")
                        
                    except ImportError:
                        self.logger.warning("torchvision not available, trying direct tensor input")
                        pipeline_input = image_batch
                    except Exception as e:
                        self.logger.warning(f"Failed to convert tensor to PIL: {e}, trying direct tensor input")
                        pipeline_input = image_batch
                
                # Run the pipeline to generate 3D representation
                result = self.pipeline(
                    pipeline_input,
                    num_inference_steps=50,  # Adjust based on quality/speed requirements
                    guidance_scale=7.5,      # Adjust for better results
                    return_dict=True
                )
                
                # Clear cache after inference
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                    memory_after = torch.cuda.memory_allocated(0) / (1024**3)
                    self.logger.info(f"GPU memory after inference: {memory_after:.2f}GB")
                
                # Extract point cloud or mesh data
                if hasattr(result, 'point_clouds') and result.point_clouds is not None:
                    self.logger.info("✅ Using point_clouds from pipeline result")
                    point_clouds = result.point_clouds
                    
                    # Handle different point cloud formats
                    if isinstance(point_clouds, list):
                        if len(point_clouds) > 0:
                            point_cloud = point_clouds[0]
                        else:
                            raise RuntimeError("Empty point_clouds list returned from pipeline")
                    else:
                        point_cloud = point_clouds
                    
                    # Convert to numpy if it's a tensor
                    if hasattr(point_cloud, 'cpu'):
                        point_cloud = point_cloud.cpu().numpy()
                    elif not isinstance(point_cloud, np.ndarray):
                        raise RuntimeError(f"Unexpected point_cloud type: {type(point_cloud)}")
                        
                elif hasattr(result, 'meshes') and result.meshes is not None:
                    self.logger.info("✅ Using meshes from pipeline result")
                    meshes = result.meshes
                    
                    # Handle different mesh formats
                    if isinstance(meshes, list):
                        if len(meshes) > 0:
                            mesh = meshes[0]
                        else:
                            raise RuntimeError("Empty meshes list returned from pipeline")
                    else:
                        mesh = meshes
                    
                    # If it's already a mesh object, return it directly
                    return mesh
                    
                else:
                    # Fallback: extract from latents using VAE
                    self.logger.info("✅ Fallback: decoding latents using VAE")
                    latents = result.latents if hasattr(result, 'latents') else result
                    
                    # Decode latents to point cloud using VAE
                    with torch.no_grad():
                        decoded = self.vae.decode(latents)
                        self.logger.info(f"VAE decode result type: {type(decoded)}")
                        
                        # Handle different decoded formats
                        if isinstance(decoded, list):
                            self.logger.info(f"Decoded is a list with {len(decoded)} items")
                            
                            # Try to find the best item in the list
                            point_cloud = None
                            for i, item in enumerate(decoded):
                                self.logger.info(f"List item {i}: type={type(item)}")
                                
                                if hasattr(item, 'cpu'):
                                    # It's a tensor
                                    point_cloud = item.cpu().numpy()
                                    self.logger.info(f"✅ Using tensor from list item {i}")
                                    break
                                elif isinstance(item, np.ndarray):
                                    # It's already a numpy array
                                    point_cloud = item
                                    self.logger.info(f"✅ Using numpy array from list item {i}")
                                    break
                                elif hasattr(item, 'vertices'):
                                    # It's a mesh object (like trimesh.Trimesh)
                                    try:
                                        point_cloud = np.array(item.vertices)
                                        self.logger.info(f"✅ Using vertices from mesh object in list item {i}")
                                        break
                                    except Exception as e:
                                        self.logger.warning(f"Failed to extract vertices from mesh: {e}")
                                        continue
                                elif hasattr(item, 'points'):
                                    # It's a point cloud object
                                    try:
                                        point_cloud = np.array(item.points)
                                        self.logger.info(f"✅ Using points from point cloud object in list item {i}")
                                        break
                                    except Exception as e:
                                        self.logger.warning(f"Failed to extract points: {e}")
                                        continue
                                else:
                                    self.logger.warning(f"Unknown item type in decoded list: {type(item)}")
                            
                            if point_cloud is None:
                                raise RuntimeError(f"Could not extract point cloud from decoded list of {len(decoded)} items")
                                
                        elif hasattr(decoded, 'cpu'):
                            # It's a single tensor
                            point_cloud = decoded.cpu().numpy()
                            self.logger.info("✅ Using single tensor from VAE decode")
                            
                        elif isinstance(decoded, np.ndarray):
                            # It's already a numpy array
                            point_cloud = decoded
                            self.logger.info("✅ Using numpy array from VAE decode")
                            
                        elif hasattr(decoded, 'vertices'):
                            # It's a mesh object
                            point_cloud = np.array(decoded.vertices)
                            self.logger.info("✅ Using vertices from mesh object")
                            
                        elif hasattr(decoded, 'points'):
                            # It's a point cloud object
                            point_cloud = np.array(decoded.points)
                            self.logger.info("✅ Using points from point cloud object")
                            
                        else:
                            raise RuntimeError(f"Unexpected decoded type: {type(decoded)}")
                
                self.logger.info(f"✅ 3D inference completed, point cloud shape: {point_cloud.shape}")
                return point_cloud
                
        except Exception as e:
            self.logger.error(f"3D generation failed: {traceback.format_exc()}")
            raise RuntimeError(f"3D generation failed: {e}")
    
    def _save_mesh_outputs(self, mesh_data: np.ndarray, job_output_dir: str) -> dict:
        """Save mesh in multiple formats and return paths"""
        os.makedirs(job_output_dir, exist_ok=True)
        
        output_files = {}
        base_name = "generated_model"
        
        try:
            # Convert point cloud to mesh if needed
            if mesh_data.shape[-1] == 3:  # Point cloud format
                vertices, faces = point_cloud_to_mesh(mesh_data)
            else:
                vertices = mesh_data[:, :3]  # Assume first 3 columns are XYZ
                faces = None
            
            # Save OBJ format (primary format)
            obj_path = os.path.join(job_output_dir, f"{base_name}.obj")
            save_obj(obj_path, vertices, faces)
            output_files['obj'] = obj_path
            self.logger.info(f"✅ OBJ saved: {obj_path}")
            
            # Save PLY format
            ply_path = os.path.join(job_output_dir, f"{base_name}.ply")
            save_ply(ply_path, vertices, faces)
            output_files['ply'] = ply_path
            self.logger.info(f"✅ PLY saved: {ply_path}")
            
            # Try to save STL if possible
            try:
                if faces is not None:
                    stl_path = os.path.join(job_output_dir, f"{base_name}.stl")
                    self._save_stl(stl_path, vertices, faces)
                    output_files['stl'] = stl_path
                    self.logger.info(f"✅ STL saved: {stl_path}")
            except Exception as e:
                self.logger.warning(f"STL export failed: {e}")
            
            return output_files
            
        except Exception as e:
            self.logger.error(f"Mesh saving failed: {traceback.format_exc()}")
            raise RuntimeError(f"Failed to save mesh: {e}")
    
    def _save_stl(self, path: str, vertices: np.ndarray, faces: np.ndarray):
        """Save mesh as STL format"""
        try:
            import struct
            
            with open(path, 'wb') as f:
                # STL header
                f.write(b'\x00' * 80)
                f.write(struct.pack('<I', len(faces)))
                
                for face in faces:
                    # Get triangle vertices
                    v1, v2, v3 = vertices[face]
                    
                    # Calculate normal
                    normal = np.cross(v2 - v1, v3 - v1)
                    normal = normal / np.linalg.norm(normal)
                    
                    # Write normal and vertices
                    f.write(struct.pack('<3f', *normal))
                    f.write(struct.pack('<3f', *v1))
                    f.write(struct.pack('<3f', *v2))
                    f.write(struct.pack('<3f', *v3))
                    f.write(b'\x00\x00')  # Attribute byte count
                    
        except Exception as e:
            raise RuntimeError(f"STL export failed: {e}")
    
    def convert(self, images: List[str], job_output_dir: str) -> str:
        """
        Convert images to 3D model using real Hunyuan3D inference
        
        Args:
            images: List of image file paths
            job_output_dir: Directory to save output files
            
        Returns:
            Path to the primary OBJ file
        """
        if not self.pipeline:
            raise RuntimeError("Pipeline not loaded. Call _load_pipeline() first.")
        
        if not images:
            raise ValueError("No images provided for conversion")
        
        self.logger.info(f"🚀 Starting 3D conversion with {len(images)} image(s)")
        
        try:
            # Check GPU memory
            if torch.cuda.is_available():
                gpu_memory = torch.cuda.get_device_properties(0).total_memory / (1024**3)
                gpu_allocated = torch.cuda.memory_allocated(0) / (1024**3)
                gpu_cached = torch.cuda.memory_reserved(0) / (1024**3)
                self.logger.info(f"GPU Memory: {gpu_memory:.1f}GB total, {gpu_allocated:.1f}GB allocated, {gpu_cached:.1f}GB cached")
                
                # Clear cache before conversion
                torch.cuda.empty_cache()
            
            # Preprocess images
            self.logger.info("🔄 Preprocessing images...")
            image_batch = self._preprocess_images(images)
            
            # Generate 3D mesh
            self.logger.info("🔄 Generating 3D mesh with Hunyuan3D...")
            mesh_data = self._generate_3d_mesh(image_batch)
            
            # Save outputs
            self.logger.info("🔄 Saving 3D model files...")
            output_files = self._save_mesh_outputs(mesh_data, job_output_dir)
            
            # Return primary OBJ file path
            primary_output = output_files.get('obj')
            if not primary_output or not os.path.exists(primary_output):
                raise RuntimeError("Primary OBJ file was not created successfully")
            
            self.logger.info(f"✅ 3D conversion completed successfully: {primary_output}")
            self.logger.info(f"📁 Available formats: {list(output_files.keys())}")
            
            # Final cleanup
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                final_memory = torch.cuda.memory_allocated(0) / (1024**3)
                self.logger.info(f"GPU memory after conversion: {final_memory:.2f}GB")
            
            return primary_output
            
        except Exception as e:
            self.logger.error(f"Conversion failed: {traceback.format_exc()}")
            # Clean up on error
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            raise RuntimeError(f"3D conversion failed: {e}")
    
    def get_available_formats(self, job_output_dir: str) -> dict:
        """Get available output formats for a completed job"""
        formats = {}
        base_name = "generated_model"
        
        for ext in ['obj', 'ply', 'stl']:
            file_path = os.path.join(job_output_dir, f"{base_name}.{ext}")
            if os.path.exists(file_path):
                # Return relative path for API serving
                relative_path = os.path.relpath(file_path, self.output_dir)
                formats[ext] = f"/output/{relative_path.replace(os.sep, '/')}"
        
        return formats
    
    def cleanup_gpu_memory(self):
        """Clean up GPU memory"""
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.synchronize()
            memory_allocated = torch.cuda.memory_allocated(0) / (1024**3)
            self.logger.info(f"🧹 GPU memory cleaned up, current allocation: {memory_allocated:.2f}GB")
