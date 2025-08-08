import os
import torch
import logging
from hunyuan3d.pipeline import Hunyuan3DDiTFlowMatchingPipeline


class Local2DTo3DConverter:
    def __init__(self, model_dir, model_name="hunyuan3d", use_fp16=True):
        self.model_dir = model_dir
        self.model_name = model_name
        self.use_fp16 = use_fp16
        self.pipeline = None
        self.dummy_mode = False

        # Logger setup
        self.logger = logging.getLogger(self.__class__.__name__)
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                "[%(asctime)s] %(levelname)s - %(message)s", datefmt="%H:%M:%S"
            )
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.INFO)

        # Load the pipeline when the class is created
        self._load_pipeline()

    def _load_pipeline(self):
        """
        Loads the Hunyuan3D pipeline from the given model directory.
        Supports both .safetensors and .ckpt model formats.
        """
        model_path = os.path.join(self.model_dir, self.model_name)
        config_path = os.path.join(model_path, 'config.yaml')
        safetensors_path = os.path.join(model_path, 'model.fp16.safetensors')
        ckpt_path = os.path.join(model_path, 'model.fp16.ckpt')

        if not os.path.exists(config_path):
            self.logger.error(f"Config file not found: {config_path}")
            self.dummy_mode = True
            return

        # Check which model file is available
        if os.path.exists(safetensors_path):
            self.logger.info("Found .safetensors model file.")
            model_file = 'model.fp16.safetensors'
        elif os.path.exists(ckpt_path):
            self.logger.info("Found .ckpt model file.")
            model_file = 'model.fp16.ckpt'
        else:
            self.logger.error(f"No model file found in {model_path} "
                              f"(neither .safetensors nor .ckpt)")
            self.dummy_mode = True
            return

        # Load the pipeline
        try:
            self.logger.info(f"Loading model from {model_path} (using {model_file})...")
            dtype = torch.float16 if self.use_fp16 else torch.float32
            device_map = "cuda" if torch.cuda.is_available() else "cpu"

            self.pipeline = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
                model_path,
                local_files_only=True,
                torch_dtype=dtype,
                device_map=device_map
            )
            self.logger.info("Pipeline loaded successfully.")
        except Exception as e:
            self.logger.error(f"Failed to load pipeline: {e}")
            self.dummy_mode = True

    def convert(self, input_image, output_path):
        """
        Converts a 2D image to a 3D model using the loaded pipeline.
        """
        if self.dummy_mode or self.pipeline is None:
            self.logger.warning("Pipeline not available. Running in dummy mode.")
            with open(output_path, "w") as f:
                f.write("Dummy 3D model output.")
            return True

        try:
            self.logger.info(f"Processing image: {input_image}")
            result = self.pipeline(input_image)
            result.save(output_path)
            self.logger.info(f"3D model saved to: {output_path}")
            return True
        except Exception as e:
            self.logger.error(f"Conversion failed: {e}")
            return False
