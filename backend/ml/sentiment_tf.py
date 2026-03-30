"""
TensorFlow LSTM Sentiment Analysis Model
Trained on IMDb Movie Reviews dataset for binary sentiment classification.
Architecture: Embedding → LSTM → Dense → Dropout → Output
"""

import os

import numpy as np

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'  # Suppress TF info logs

from tensorflow import keras
from tensorflow.keras import layers

# ── Constants ──
VOCAB_SIZE = 10000
MAX_LEN = 256
EMBEDDING_DIM = 128
LSTM_UNITS = 64
DENSE_UNITS = 32
DROPOUT_RATE = 0.3
MODEL_NAME = "sentiment_tf_model.keras"

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARTIFACTS_DIR = os.path.join(BASE_DIR, 'artifacts')
MODEL_PATH = os.path.join(ARTIFACTS_DIR, MODEL_NAME)

_word_index = None

def _get_word_index():
    """Lazy-load the IMDb word index."""
    global _word_index
    if _word_index is None:
        _word_index = keras.datasets.imdb.get_word_index()
    return _word_index


def build_model():
    """Build the TensorFlow LSTM sentiment model."""
    model = keras.Sequential([
        layers.Embedding(VOCAB_SIZE, EMBEDDING_DIM, input_length=MAX_LEN),
        layers.LSTM(LSTM_UNITS, return_sequences=False),
        layers.Dense(DENSE_UNITS, activation='relu'),
        layers.Dropout(DROPOUT_RATE),
        layers.Dense(1, activation='sigmoid')
    ], name="SentimentLSTM_TF")
    
    model.compile(
        optimizer='adam',
        loss='binary_crossentropy',
        metrics=['accuracy']
    )
    return model


def load_data():
    """Load and preprocess the IMDb dataset."""
    (x_train, y_train), (x_test, y_test) = keras.datasets.imdb.load_data(num_words=VOCAB_SIZE)
    
    # Pad sequences to uniform length
    x_train = keras.preprocessing.sequence.pad_sequences(x_train, maxlen=MAX_LEN, padding='post', truncating='post')
    x_test = keras.preprocessing.sequence.pad_sequences(x_test, maxlen=MAX_LEN, padding='post', truncating='post')
    
    return (x_train, y_train), (x_test, y_test)


def train_model(epochs=5, batch_size=64, verbose=1):
    """
    Train the TensorFlow LSTM model on IMDb data.
    Returns: (model, history_dict) where history_dict contains accuracy/loss per epoch.
    """
    print("\n" + "=" * 60)
    print("  TensorFlow LSTM — Sentiment Analysis Training")
    print("=" * 60)
    
    (x_train, y_train), (x_test, y_test) = load_data()
    print(f"  Training samples: {len(x_train)}")
    print(f"  Test samples:     {len(x_test)}")
    print(f"  Vocab size:       {VOCAB_SIZE}")
    print(f"  Max seq length:   {MAX_LEN}")
    print("-" * 60)
    
    model = build_model()
    model.summary()
    
    # Early stopping to prevent overfitting
    early_stop = keras.callbacks.EarlyStopping(
        monitor='val_loss', patience=2, restore_best_weights=True
    )
    
    history = model.fit(
        x_train, y_train,
        epochs=epochs,
        batch_size=batch_size,
        validation_split=0.2,
        callbacks=[early_stop],
        verbose=verbose
    )
    
    # Evaluate on test set
    test_loss, test_acc = model.evaluate(x_test, y_test, verbose=0)
    print(f"\n  ✅ Test Accuracy: {test_acc:.4f}")
    print(f"  ✅ Test Loss:     {test_loss:.4f}")
    
    # Save model
    os.makedirs(ARTIFACTS_DIR, exist_ok=True)
    model.save(MODEL_PATH)
    print(f"  📦 Model saved to: {MODEL_PATH}")
    
    # Build history dict
    history_dict = {
        'train_accuracy': [float(v) for v in history.history['accuracy']],
        'val_accuracy': [float(v) for v in history.history['val_accuracy']],
        'train_loss': [float(v) for v in history.history['loss']],
        'val_loss': [float(v) for v in history.history['val_loss']],
        'test_accuracy': float(test_acc),
        'test_loss': float(test_loss),
    }
    
    return model, history_dict


def encode_text(text: str) -> np.ndarray:
    """Encode a raw text string into a padded integer sequence using the IMDb vocabulary."""
    word_index = _get_word_index()
    # Offset indices by 3 (IMDb convention: 0=pad, 1=start, 2=unknown, 3=unused)
    tokens = []
    for word in text.lower().split():
        clean = ''.join(c for c in word if c.isalnum())
        if clean:
            idx = word_index.get(clean, 2) + 3  # +3 for reserved indices
            if idx < VOCAB_SIZE:
                tokens.append(idx)
            else:
                tokens.append(2)  # OOV
    
    # Pad to MAX_LEN
    padded = np.zeros(MAX_LEN, dtype=np.int32)
    for i, t in enumerate(tokens[:MAX_LEN]):
        padded[i] = t
    
    return padded.reshape(1, -1)


def predict_sentiment_tf(text: str) -> dict:
    """
    Predict sentiment of a text using the trained TF model.
    Returns: {"label": "positive"|"negative", "confidence": float, "model": "TensorFlow LSTM"}
    """
    if not os.path.exists(MODEL_PATH):
        return {
            "label": "unknown",
            "confidence": 0.0,
            "model": "TensorFlow LSTM",
            "error": "Model not trained yet. Run train_sentiment.py first."
        }
    
    model = keras.models.load_model(MODEL_PATH)
    encoded = encode_text(text)
    prediction = float(model.predict(encoded, verbose=0)[0][0])
    
    label = "positive" if prediction >= 0.5 else "negative"
    confidence = prediction if prediction >= 0.5 else (1.0 - prediction)
    
    return {
        "label": label,
        "confidence": round(confidence, 4),
        "raw_score": round(prediction, 4),
        "model": "TensorFlow LSTM"
    }


if __name__ == "__main__":
    model, history = train_model(epochs=5)
    print("\nTraining complete!")
    print(f"Final test accuracy: {history['test_accuracy']:.4f}")
