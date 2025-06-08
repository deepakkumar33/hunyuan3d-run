"""
API for Configuration Management
"""
__all__ = ['ConfigAPI']

from flask import Blueprint, request, jsonify


class ConfigAPI:
    """
    API class for configuration management endpoints.

    Parameters
    ----------
    config : ConfigLoader
        Configuration loader instance for config settings.
    """
    def __init__(self, config):
        """
        Initialize the ConfigAPI with a configuration loader and set up the Flask Blueprint.

        Parameters
        ----------
        config : ConfigLoader
            Configuration loader instance for config settings.
        """
        self.config = config
        self.api = Blueprint('config_api', __name__)
        self.add_routes()

    def add_routes(self):
        """
        Register API routes to the blueprint.
        """
        @self.api.route('/config', methods=['GET'])
        def get_config():
            """
            Get the current configuration settings.
            """
            return jsonify(self.config.as_dict())

        @self.api.route('/config', methods=['POST'])
        def update_config():
            """
            Update configuration settings. Accepts a JSON object with key-value pairs.
            """
            data = request.get_json()
            if not data:
                return jsonify({'error': 'No data provided'}), 400
            for key, value in data.items():
                self.config.set(key, value)
            return jsonify({'message': 'Configuration updated', 'config': self.config.as_dict()})
