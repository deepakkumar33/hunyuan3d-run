"""
Flask application wrapper class for the 2D to 3D Model Converter API backend.
"""
__all__ = ['Model2DTo3DApp']

from flask import Flask
from src.utils.configuration import ConfigLoader
from src.api.convert_api import ConvertAPI
from src.api.config_api import ConfigAPI
from src.logger.logger import Logger


class Model2DTo3DApp:
    """
    Flask application wrapper class for the 2D to 3D Model Converter API backend.
    """

    def __init__(self):
        """
        Initialize the FlaskApp with logger and API blueprints.
        """
        self.logger = Logger(__name__).get_logger()
        config_loader = ConfigLoader()

        # Initialize APIs
        self.convert_api = ConvertAPI(self.logger, config_loader)
        self.config_api = ConfigAPI(config_loader)

        # Create Flask app
        self.app = Flask(__name__)
        self.register_routes()

    def register_routes(self):
        """
        Register API blueprints and root homepage.
        """
        self.app.register_blueprint(self.convert_api.api, url_prefix='/api')
        self.app.register_blueprint(self.config_api.api, url_prefix='/api')

        # ✅ Add homepage route
        @self.app.route('/')
        def home():
            return '✅ Hunyuan3D API is running. Use /api/convert to access the converter.'

        # 🔍 Print registered routes for debugging
        print("🔍 Registered routes:")
        print(self.app.url_map)

    def run(self, **kwargs):
        """
        Run the Flask application.
        """
        self.logger.info('Starting 2D to 3D Model Converter Flask application...')
        self.app.run(**kwargs)


if __name__ == '__main__':
    app_instance = Model2DTo3DApp()
    app_instance.run(debug=True, host='0.0.0.0', port=5000)
