import os
from huggingface_hub import hf_hub_download
from dotenv import load_dotenv

load_dotenv()

REPO_ID = os.getenv("HUGGINGFACE_DATASET_REPO", "DM-160105/movie-recommender-data")

def get_dataset_file(filename: str, subfolder: str = None) -> str:
    """
    Tries to find the file locally first. If not found, downloads it from Hugging Face.
    Returns the absolute path to the file.
    """
    from api import BASE_DIR
    
    # Check local first
    local_path = os.path.join(BASE_DIR, 'data')
    if subfolder:
        local_path = os.path.join(local_path, subfolder)
    local_file = os.path.join(local_path, filename)
    
    if os.path.exists(local_file):
        return local_file
        
    print(f"File {filename} not found locally. Downloading from Hugging Face repo: {REPO_ID}...")
    try:
        # Download and cache from Hugging Face Hub
        downloaded_path = hf_hub_download(
            repo_id=REPO_ID,
            filename=filename,
            subfolder=subfolder,
            repo_type="dataset"
        )
        print(f"Successfully downloaded {filename}")
        return downloaded_path
    except Exception as e:
        print(f"Error downloading {filename} from Hugging Face: {e}")
        # Return local path anyway so it fails with a standard FileNotFoundError later
        # or the user can manually place it there.
        return local_file
