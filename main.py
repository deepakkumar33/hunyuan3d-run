"""
Flask app that:
 • Serves your SPA (templates/index.html) + static assets
 • Mounts /api blueprints for conversion + config
 • Falls back to index.html for client‐side routes
"""

import os
from flask import Flask, send_from_directory, render_template
from src.utils.configuration import ConfigLoader
from src.api.convert_api   import ConvertAPI
from src.api.config_api    import ConfigAPI
from src.logger.logger     import Logger

# point Flask at your folders
app = Flask(
    __name__,
    static_folder='static',     # where css/, js/, etc live
    template_folder='templates' # where index.html lives
)
logger = Logger(__name__).get_logger()

# mount APIs
cfg = ConfigLoader()
app.register_blueprint(ConvertAPI(logger, cfg).api, url_prefix='/api')
app.register_blueprint(ConfigAPI(cfg).api,   url_prefix='/api')

# SPA + static route
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_spa(path):
    # if the requested file exists under static/, serve it
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    # otherwise, serve the SPA entry‐point
    return render_template('index.html')

if __name__ == '__main__':
    logger.info("🔍 Registered routes:\n%s", app.url_map)
    logger.info("Starting Flask on 0.0.0.0:5000…")
    app.run(debug=True, host='0.0.0.0', port=5000)
