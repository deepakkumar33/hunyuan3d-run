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

    Parameters
    ----------
    logger : logging.Logger
        Logger instance for logging application events.
    convert_api : ConvertAPI
        Instance of the ConvertAPI class for registering API routes.
    """
    def __init__(self):
        """
        Initialize the FlaskApp with logger and API blueprint.

        Parameters
        ----------
        logger : logging.Logger
            Logger instance for logging application events.
        convert_api : ConvertAPI
            Instance of the ConvertAPI class for registering API routes.
        """
        self.logger = Logger(__name__).get_logger()
        config_loader = ConfigLoader()
        self.convert_api = ConvertAPI(self.logger, config_loader)
        self.app = Flask(__name__)
        self.register_routes()

    def register_routes(self):
        """
        Register the API blueprint to the Flask app.
        """
        self.app.register_blueprint(self.convert_api.api, url_prefix='/api')

    def run(self, **kwargs):
        """
        Run the Flask application.

        Parameters
        ----------
        **kwargs
            Additional keyword arguments for Flask's run method.
        """
        self.logger.info('Starting 2D to 3D Model Converter Flask application...')
        self.app.run(**kwargs)

if __name__ == '__main__':
    app_instance = Model2DTo3DApp()
    config_loader = ConfigLoader()
    convert_api = ConvertAPI(app_instance.logger, config_loader)
    config_api = ConfigAPI(config_loader)
    app_instance.app.register_blueprint(config_api.api, url_prefix='/api')
    app_instance.run(debug=True)
