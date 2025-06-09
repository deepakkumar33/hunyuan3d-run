"""
Flask application wrapper for the 2D→3D Model Converter,
serving both API endpoints and your frontend from /static.
"""

import os
from flask import Flask, send_from_directory
from src.utils.configuration import ConfigLoader
from src.api.convert_api import ConvertAPI
from src.api.config_api import ConfigAPI
from src.logger.logger import Logger

# Create Flask app
app = Flask(__name__, static_folder='static', static_url_path='')

# Initialize logger
logger = Logger(__name__).get_logger()

# Load configuration & initialize APIs
config_loader = ConfigLoader()
convert_api = ConvertAPI(logger, config_loader)
config_api = ConfigAPI(config_loader)

# Register API blueprints under /api
app.register_blueprint(convert_api.api, url_prefix='/api')
app.register_blueprint(config_api.api,  url_prefix='/api')

# Serve your frontend's index.html at /
@app.route('/')
def serve_frontend():
    return send_from_directory(app.static_folder, 'index.html')

# Serve all other static assets under /<path>
@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory(app.static_folder, filename)

if __name__ == '__main__':
    logger.info("🔍 Registered routes:\n%s", app.url_map)
    logger.info("Starting Flask on 0.0.0.0:5000…")
    app.run(debug=True, host='0.0.0.0', port=5000)
