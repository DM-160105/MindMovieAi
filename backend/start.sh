#!/bin/bash
# start.sh - Deployment startup script for the backend

# Exit immediately if a command exits with a non-zero status
set -e

# Change to the directory where this script is located
cd "$(dirname "$0")"

echo "=== Movie Recommender Backend Startup ==="

# Check for .env file
if [ ! -f .env ]; then
    echo "Warning: .env file not found. Copying .env.example..."
    cp .env.example .env
fi

# Ensure data and artifact directories exist
mkdir -p data/youtube_dataset
mkdir -p data/youtube_comment_dataset
mkdir -p artifacts

# Optional: Generate artifacts if they don't exist
if [ ! -f artifacts/movies.index ] || [ ! -f artifacts/movie_dict.pkl ]; then
    echo "Generating ML artifacts (this might take a while)..."
    python generate_artifacts.py
fi

# Start the FastAPI server using Uvicorn
echo "Starting FastAPI server..."
uvicorn api:app --host 0.0.0.0 --port "${PORT:-8000}"
