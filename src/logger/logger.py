"""
A refined application logger class that provides a simple interface for logging messages
"""
__all__ = ['Logger']

import logging

class Logger:
    """
    A refined application logger class that provides a simple interface for logging messages
    """
    def __init__(self, name=__name__):
        """
        Initialize the AppLogger instance.

        Args:
            name (str): The name of the logger, typically __name__ from the caller.
        """
        self.logger = logging.getLogger(name)
        self.logger.setLevel(logging.INFO)
        handler = logging.StreamHandler()
        formatter = logging.Formatter('[%(asctime)s] %(levelname)s in %(module)s: %(message)s')
        handler.setFormatter(formatter)
        if not self.logger.handlers:
            self.logger.addHandler(handler)

    def get_logger(self):
        """
        Get the underlying logger instance.

        Returns:
            logging.Logger: The configured logger instance.
        """
        return self.logger

    def info(self, message):
        """
        Log an informational message.

        Args:
            message (str): The message to log.
        """
        self.logger.info(message)

    def warning(self, message):
        """
        Log a warning message.

        Args:
            message (str): The warning message to log.
        """
        self.logger.warning(message)

    def error(self, message):
        """
        Log an error message.

        Args:
            message (str): The error message to log.
        """
        self.logger.error(message)
