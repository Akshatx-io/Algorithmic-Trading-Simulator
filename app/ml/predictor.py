import threading
from typing import Optional
from pathlib import Path
import os

import numpy as np

# Keep TensorFlow startup noise out of production logs.
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "0")

try:
    from tensorflow.keras.models import load_model
except ImportError:
    load_model = None

from app.core.config import settings
from app.core.logger import logger

try:
    import h5py
except ImportError:
    h5py = None


class ModelManager:
    """
    Thread-safe, lazy-loaded ML model manager.
    """

    def __init__(self):
        self._model = None
        self._lock = threading.Lock()
        self._loaded = False

    def load(self):
        if self._loaded:
            return self._model

        with self._lock:
            if self._loaded:
                return self._model

            try:
                if load_model is None:
                    logger.warning("TensorFlow is unavailable, ML predictions disabled")
                    self._model = None
                    self._loaded = True
                    return self._model

                model_path = Path(settings.model_path)
                if not model_path.is_file():
                    logger.warning(
                        f"ML model not found at {settings.model_path}; using safe fallback predictions"
                    )
                    self._model = None
                    self._loaded = True
                    return self._model
                if h5py is not None and not h5py.is_hdf5(str(model_path)):
                    logger.warning(
                        f"ML model file is not a valid HDF5 model at {settings.model_path}; using fallback predictions"
                    )
                    self._model = None
                    self._loaded = True
                    return self._model

                logger.info(f"Loading ML model from {settings.model_path}")

                self._model = load_model(settings.model_path)

                self._loaded = True

                logger.info("✅ ML model loaded successfully")

            except Exception as e:
                logger.error(f"[MODEL LOAD ERROR]: {str(e)}")
                self._model = None
                # Mark as loaded to prevent repeated expensive retries/log spam.
                self._loaded = True

        return self._model

    def predict(self, data: np.ndarray) -> float:
        model = self.load()

        if model is None:
            return 0.0  # SAFE fallback

        try:
            prediction = model.predict(
                data,
                batch_size=settings.model_max_batch_size,
                verbose=0,
            )

            value = float(prediction[0][0])

            # Safety clamp
            if not np.isfinite(value):
                return 0.0

            # clamp extreme ML outputs
            return max(min(value, 1.0), -1.0)

        except Exception as e:
            logger.error(f"[PREDICTION ERROR]: {str(e)}")
            return 0.0


# ===============================
# GLOBAL INSTANCE
# ===============================
model_manager = ModelManager()


# ===============================
# PUBLIC FUNCTION
# ===============================
def predict_return(data: np.ndarray) -> float:
    """
    Safe prediction wrapper.
    """
    return model_manager.predict(data)