"""
Flask application wrapper class for the 2D to 3D Model Converter API backend.
"""
__all__ = ['Model2DTo3DApp']

from flask import Flask
from src.utils.configuration import ConfigLoader
from src.api.convert_api import ConvertAPI
from src.api.config_api import ConfigAPI
from src.logger.logger import Logger
from flask import Flask, send_from_directory
import os

# Global app instance (Flask needs this when reloading)
app = Flask(__name__)
logger = Logger(__name__).get_logger()

# Initialize config and APIs
config_loader = ConfigLoader()
convert_api = ConvertAPI(logger, config_loader)
config_api = ConfigAPI(config_loader)

# Register routes
app.register_blueprint(convert_api.api, url_prefix='/api')
app.register_blueprint(config_api.api, url_prefix='/api')

@app.route('/')
def home():
    return send_from_directory('static', 'index.html')

# Debug route list
print("🔍 Registered routes:")
print(app.url_map)


class Model2DTo3DApp:
    """
    Flask application wrapper class for the 2D to 3D Model Converter API backend.
    """

    def __init__(self):
        self.logger = logger
        self.app = app

    def run(self, **kwargs):
        self.logger.info('Starting 2D to 3D Model Converter Flask application...')
        self.app.run(**kwargs)


# 👇 Will only run in main container (not when Flask auto reloads as a module)
if __name__ == '__main__':
    app_instance = Model2DTo3DApp()
    app_instance.run(debug=True, host='0.0.0.0', port=5000)
