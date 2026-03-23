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

# Download artifacts from Hugging Face if they don't exist locally
if [ ! -f artifacts/movies.index ] || [ ! -f artifacts/movie_dict.pkl ]; then
    echo "Artifacts not found locally. Downloading from Hugging Face..."
    python -c "
from hf_utils import get_artifact_file
print('Downloading movie_dict.pkl...')
get_artifact_file('movie_dict.pkl')
print('Downloading movies.index...')
get_artifact_file('movies.index')
print('Artifacts ready.')
"
fi

# Start the FastAPI server using Uvicorn
echo "Starting FastAPI server..."
uvicorn api:app --host 0.0.0.0 --port "${PORT:-8000}"
