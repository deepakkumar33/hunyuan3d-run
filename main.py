import os
from flask import Flask, send_from_directory, render_template
from flask_cors import CORS
from src.utils.configuration import ConfigLoader
from src.api.convert_api   import ConvertAPI
from src.api.config_api    import ConfigAPI
from src.logger.logger     import Logger

# 1) Point Flask at your folders
app = Flask(
    __name__,
    static_folder='static',      # serves /static/js, /static/css, etc.
    template_folder='templates'  # serves templates/index.html
)

# 2) Enable CORS so your SPA can hit /api from anywhere
CORS(app)

logger = Logger(__name__).get_logger()

# 3) Mount your two blueprints under /api
cfg = ConfigLoader()
app.register_blueprint(ConvertAPI(logger, cfg).api, url_prefix='/api')
app.register_blueprint(ConfigAPI(cfg).api,     url_prefix='/api')

# 4) Serve the SPA (index.html) for any non-/api route
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_spa(path):
    # if requested file exists under static/, serve it
    static_path = os.path.join(app.static_folder, path)
    if path and os.path.exists(static_path):
        return send_from_directory(app.static_folder, path)
    # otherwise serve the SPA entry point
    return render_template('index.html')

if __name__ == '__main__':
    logger.info("🔍 Registered routes:\n%s", app.url_map)
    logger.info("🚀 Starting Flask on 0.0.0.0:5000…")
    app.run(debug=True, host='0.0.0.0', port=5000)
