"""
Loads and provides access to configuration settings from config.json.
"""
__all__ = ['ConfigLoader']

import json
import os

class ConfigLoader:
    """
    Loads and provides access to configuration settings from config.json.
    """
    def __init__(self, config_path=None):
        if config_path is None:
            # Get the parent of the base directory (project root)
            base_dir = os.path.dirname(os.path.abspath(__file__))
            parent_dir = os.path.dirname(base_dir)
            parent_parent_dir = os.path.dirname(parent_dir)

            config_path = os.path.join(parent_parent_dir, 'config.json')
        self.config_path = config_path
        self._config = self._load_config()

    def _load_config(self):
        with open(self.config_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def get(self, key, default=None):
        return self._config.get(key, default)

    def set(self, key, value):
        self._config[key] = value
        self._save_config()

    def _save_config(self):
        with open(self.config_path, 'w', encoding='utf-8') as f:
            json.dump(self._config, f, indent=4)

    def as_dict(self):
        return dict(self._config)
