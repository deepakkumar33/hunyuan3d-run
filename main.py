"""
Flask app that:
 • Serves your SPA from ./static
 • Mounts /api blueprints for conversion + config
 • Falls back to index.html for client-side routes
"""

import os
from flask import Flask, send_from_directory, abort
from src.utils.configuration import ConfigLoader
from src.api.convert_api   import ConvertAPI
from src.api.config_api    import ConfigAPI
from src.logger.logger     import Logger

# Create app without default static folder
app = Flask(__name__, static_folder=None)
logger = Logger(__name__).get_logger()

# Load config & register API blueprints
cfg = ConfigLoader()
app.register_blueprint(ConvertAPI(logger, cfg).api, url_prefix='/api')
app.register_blueprint(ConfigAPI(cfg).api,   url_prefix='/api')

# Serve SPA & static assets
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_spa(path):
    # compute where your code actually lives
    static_dir = os.path.join(app.root_path, 'static')
    # if a real file exists under static/, serve it
    candidate = os.path.join(static_dir, path)
    if path and os.path.isfile(candidate):
        return send_from_directory(static_dir, path)
    # otherwise fall back to index.html
    index = os.path.join(static_dir, 'index.html')
    if os.path.isfile(index):
        return send_from_directory(static_dir, 'index.html')
    # nothing at all? 404
    abort(404)

if __name__ == '__main__':
    # debug print of all routes
    logger.info("🔍 Registered routes:\n%s", app.url_map)
    logger.info("Starting Flask on 0.0.0.0:5000…")
    app.run(debug=True, host='0.0.0.0', port=5000)
