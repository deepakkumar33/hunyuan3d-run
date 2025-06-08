"""
API class for 2D to 3D model conversion endpoints.
"""
__all__ = ['ConvertAPI']

import os
import tempfile
import uuid

from flask import Blueprint, request, send_file, jsonify

from src.utils.local_2d_to_3d import Local2DTo3DConverter

class ConvertAPI:
    """
    API class for 2D to 3D model conversion endpoints.

    Parameters
    ----------
    logger : logging.Logger
        Logger instance for logging API events.
    config : ConfigLoader
        Configuration loader instance for model and output settings.
    """
    def __init__(self, logger, config):
        self.logger = logger
        self.config = config
        self.api = Blueprint('api', __name__)
        self.converter = self.load_converter()
        self.add_routes()

    def load_converter(self):
        """
        Load and return the 2D to 3D conversion utility using the correct model path.
        If the model is not loaded, log a warning.
        """
        try:
            model_dir_name = self.config.get('model_name')
            model_dir = os.path.join(os.getcwd(), 'models', model_dir_name)
            if not os.path.isdir(model_dir):
                self.logger.error(f"Model directory not found: {model_dir}")
                return None
            self.logger.info(f"Loading model from: {model_dir}")
            converter = Local2DTo3DConverter(model_dir, logger=self.logger)
            if converter.pipeline is None and not converter.dummy_mode:
                self.logger.warning("2D-to-3D conversion requested but model is not loaded.")
                return None
            return converter
        except Exception as e:
            self.logger.error(f"Failed to initialize converter: {e}")
            return None

    def add_routes(self):
        @self.api.route('/convert', methods=['POST'])
        def convert_2d_to_3d():
            """
            Convert 2D image(s) to a 3D model (.obj) and return a model URL.

            Returns
            -------
            flask.Response
                JSON with the model URL or error JSON.
            """
            if not request.files or 'images' not in request.files:
                self.logger.warning('Missing images in request')
                return jsonify({'error': 'Missing images in request'}), 400

            images = request.files.getlist('images')
            if not images:
                self.logger.warning('No images provided')
                return jsonify({'error': 'No images provided'}), 400

            # Create output directory
            output_dir = os.path.join(os.getcwd(), 'output')
            os.makedirs(output_dir, exist_ok=True)

            # Generate unique model ID
            model_id = str(uuid.uuid4())
            output_filename = f'{model_id}.obj'
            output_path = os.path.join(output_dir, output_filename)

            # Save first image temporarily
            image_file = images[0]
            with tempfile.NamedTemporaryFile(delete=False, suffix='.png') as temp_img:
                image_file.save(temp_img.name)
                temp_path = temp_img.name

            try:
                # Use the conversion class
                converter = self.converter
                if converter is None:
                    self.logger.warning("Converter is None, model not loaded.")
                    os.remove(temp_path)
                    return jsonify({'error': '3D model conversion is not available: model is not loaded.'}), 503

                mesh = converter.convert(temp_path)
                if mesh is None:
                    self.logger.warning("Conversion failed, no mesh generated.")
                    os.remove(temp_path)
                    return jsonify({'error': 'Conversion failed.'}), 503

                # Save the mesh to output file
                output_format = self.config.get('output_format', 'obj')
                mesh.export(output_path)

                # Return model URL
                model_url = f'/output/{output_filename}'
                self.logger.info(f'2D to 3D conversion completed: {model_url}')
                os.remove(temp_path)
                return jsonify({'model_url': model_url})

            except Exception as e:
                self.logger.error(f'Error during 2D to 3D conversion process: {e}')
                os.remove(temp_path)
                if os.path.exists(output_path):
                    os.remove(output_path)
                return jsonify({'error': 'Failed to generate 3D model', 'details': str(e)}), 500

        @self.api.route('/output/<path:filename>')
        def serve_model(filename):
            """
            Serve the generated model file.

            Parameters
            ----------
            filename : str
                Name of the model file to serve.

            Returns
            -------
            flask.Response
                The model file as a downloadable response.
            """
            try:
                output_dir = os.path.join(os.getcwd(), 'output')
                filepath = os.path.join(output_dir, filename)
                if not os.path.exists(filepath):
                    self.logger.warning(f'Model file not found: {filepath}')
                    return jsonify({'error': 'File not found'}), 404

                self.logger.info(f'Serving model file: {filepath}')
                return send_file(filepath, as_attachment=True, download_name=filename)
            except Exception as e:
                self.logger.error(f'Error serving model file: {e}')
                return jsonify({'error': 'Failed to serve model', 'details': str(e)}), 500