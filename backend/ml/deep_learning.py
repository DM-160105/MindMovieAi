import torch
import torch.nn as nn
import torch.nn.functional as F
import os

class SimpleGenreCNN(nn.Module):
    """
    A simple Convolutional Neural Network concept to classify movie genres
    based on their thumbnail/poster images.
    """
    def __init__(self, num_classes=10):
        super(SimpleGenreCNN, self).__init__()
        # Input channels = 3 (RGB), Output channels = 16, Kernel = 3x3
        self.conv1 = nn.Conv2d(3, 16, 3, padding=1)
        self.conv2 = nn.Conv2d(16, 32, 3, padding=1)
        self.pool = nn.MaxPool2d(2, 2)
        # Assumes input images are resized to 128x128
        self.fc1 = nn.Linear(32 * 32 * 32, 128)
        self.fc2 = nn.Linear(128, num_classes)
        self.dropout = nn.Dropout(0.2)

    def forward(self, x):
        x = self.pool(F.relu(self.conv1(x)))
        x = self.pool(F.relu(self.conv2(x)))
        x = x.view(-1, 32 * 32 * 32)
        x = F.relu(self.fc1(x))
        x = self.dropout(x)
        x = self.fc2(x)
        return x

def initialize_model():
    """
    Simulates loading or initializing the Deep Learning model.
    """
    model = SimpleGenreCNN(num_classes=10)
    print("Deep Learning model architecture (Genre Classifier via Posters) initialized successfully.")
    return model

def extract_features(image_tensor):
    """
    Pass an image tensor (simulating a movie poster/thumbnail) to extract base features.
    """
    model = initialize_model()
    model.eval()
    with torch.no_grad():
        preds = model(image_tensor)
        # Returns classification logits
        return preds

if __name__ == "__main__":
    # Test execution with dummy thumbnail tensor 1x3x128x128 (Batch, Channels, Height, Width)
    dummy_poster = torch.randn(1, 3, 128, 128)
    logits = extract_features(dummy_poster)
    print("Forward pass successful. Logits:", logits)
