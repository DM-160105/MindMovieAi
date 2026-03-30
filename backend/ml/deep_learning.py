"""
Deep Learning Genre Classifier (CNN).

A lightweight PyTorch CNN architecture for classifying movie poster images
into genre categories based on visual features.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


class SimpleGenreCNN(nn.Module):
    """Convolutional Neural Network for genre classification from 128×128 poster images."""

    def __init__(self, num_classes: int = 10):
        super().__init__()
        self.conv1 = nn.Conv2d(3, 16, 3, padding=1)
        self.conv2 = nn.Conv2d(16, 32, 3, padding=1)
        self.pool = nn.MaxPool2d(2, 2)
        self.fc1 = nn.Linear(32 * 32 * 32, 128)
        self.fc2 = nn.Linear(128, num_classes)
        self.dropout = nn.Dropout(0.2)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.pool(F.relu(self.conv1(x)))
        x = self.pool(F.relu(self.conv2(x)))
        x = x.view(-1, 32 * 32 * 32)
        x = F.relu(self.fc1(x))
        x = self.dropout(x)
        return self.fc2(x)


def initialize_model(num_classes: int = 10) -> SimpleGenreCNN:
    """Instantiate a fresh genre classifier model."""
    model = SimpleGenreCNN(num_classes=num_classes)
    print("[DL] Genre classifier initialized.")
    return model


def extract_features(image_tensor: torch.Tensor) -> torch.Tensor:
    """Run a forward pass on *image_tensor* and return genre logits."""
    model = initialize_model()
    model.eval()
    with torch.no_grad():
        return model(image_tensor)


if __name__ == "__main__":
    dummy = torch.randn(1, 3, 128, 128)
    logits = extract_features(dummy)
    print("Forward pass OK. Logits:", logits)
