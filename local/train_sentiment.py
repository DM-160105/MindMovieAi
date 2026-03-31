"""
Unified Training Script for Sentiment Analysis Models
Trains both TensorFlow LSTM and PyTorch BiLSTM models on the IMDb dataset.
Saves training metrics to artifacts/training_metrics.json
"""

import os
import sys
import json
import time

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARTIFACTS_DIR = os.path.join(BASE_DIR, 'artifacts')
METRICS_PATH = os.path.join(ARTIFACTS_DIR, 'training_metrics.json')

sys.path.insert(0, os.path.join(BASE_DIR, 'backend', 'ml'))
sys.path.insert(0, os.path.join(BASE_DIR, 'backend'))


def train_all():
    """Train both TensorFlow and PyTorch sentiment models and save metrics."""
    
    os.makedirs(ARTIFACTS_DIR, exist_ok=True)
    
    all_metrics = {}
    
    # ─── Train TensorFlow Model ───
    print("\n" + "🔶" * 30)
    print("  PHASE 1: TensorFlow LSTM Training")
    print("🔶" * 30)
    
    start = time.time()
    try:
        from sentiment_tf import train_model as train_tf
        tf_model, tf_history = train_tf(epochs=5, batch_size=64)
        tf_history['training_time_seconds'] = round(time.time() - start, 2)
        all_metrics['tensorflow'] = tf_history
        print(f"\n  ⏱  TF Training time: {tf_history['training_time_seconds']}s")
    except Exception as e:
        print(f"\n  ❌ TensorFlow training failed: {e}")
        all_metrics['tensorflow'] = {'error': str(e)}
    
    # ─── Train PyTorch Model ───
    print("\n" + "🔷" * 30)
    print("  PHASE 2: PyTorch BiLSTM Training")
    print("🔷" * 30)
    
    start = time.time()
    try:
        from sentiment_torch import train_model as train_torch
        torch_model, torch_history = train_torch(epochs=5, batch_size=64)
        torch_history['training_time_seconds'] = round(time.time() - start, 2)
        all_metrics['pytorch'] = torch_history
        print(f"\n  ⏱  PyTorch Training time: {torch_history['training_time_seconds']}s")
    except Exception as e:
        print(f"\n  ❌ PyTorch training failed: {e}")
        all_metrics['pytorch'] = {'error': str(e)}
    
    # ─── Save Combined Metrics ───
    with open(METRICS_PATH, 'w') as f:
        json.dump(all_metrics, f, indent=2)
    print(f"\n📊 Training metrics saved to: {METRICS_PATH}")
    
    # ─── Summary ───
    print("\n" + "=" * 60)
    print("  TRAINING SUMMARY")
    print("=" * 60)
    
    for framework, metrics in all_metrics.items():
        if 'error' in metrics:
            print(f"  {framework.upper():12s}: ❌ FAILED — {metrics['error']}")
        else:
            print(f"  {framework.upper():12s}: ✅ Test Acc = {metrics['test_accuracy']:.4f} | "
                  f"Test Loss = {metrics['test_loss']:.4f} | "
                  f"Time = {metrics['training_time_seconds']}s")
    
    print("=" * 60)
    return all_metrics


if __name__ == "__main__":
    train_all()
