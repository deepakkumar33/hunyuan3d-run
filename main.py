"""
Flask application for 2D→3D Model Converter:
  • Serves your SPA from static/
  • Exposes two blueprints under /api
  • Falls back to index.html for any non-API route (so client-side routing works)
"""

import os
from flask import Flask, send_from_directory, abort
from src.utils.configuration import ConfigLoader
from src.api.convert_api   import ConvertAPI
from src.api.config_api    import ConfigAPI
from src.logger.logger     import Logger

# disable Flask’s built-in static serving (we’ll do it manually):
app = Flask(__name__, static_folder=None)
logger = Logger(__name__).get_logger()

# load config & mount blueprints
cfg = ConfigLoader()
app.register_blueprint(ConvertAPI(logger, cfg).api, url_prefix='/api')
app.register_blueprint(ConfigAPI(cfg).api,   url_prefix='/api')

# root and SPA fallback:
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_spa(path):
    # if the path matches a real file in static/, serve it
    static_dir = os.path.join(os.path.dirname(__file__), 'static')
    file_path = os.path.join(static_dir, path)
    if path and os.path.isfile(file_path):
        return send_from_directory(static_dir, path)
    # otherwise serve index.html
    index = os.path.join(static_dir, 'index.html')
    if os.path.isfile(index):
        return send_from_directory(static_dir, 'index.html')
    abort(404)

if __name__ == '__main__':
    # print all routes for sanity
    logger.info("🔍 Registered routes:\n%s", app.url_map)
    logger.info("Starting Flask on 0.0.0.0:5000…")
    app.run(debug=True, host='0.0.0.0', port=5000)
