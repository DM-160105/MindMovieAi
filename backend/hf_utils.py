import os
from huggingface_hub import hf_hub_download
from dotenv import load_dotenv

load_dotenv()

# Compute BASE_DIR independently (no circular import from api)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

REPO_ID = os.getenv("HUGGINGFACE_DATASET_REPO", "dev1601/MindMovieAi")
HF_TOKEN = os.getenv("HF_TOKEN")


def get_dataset_file(filename: str, subfolder: str = None) -> str:
    """
    Tries to find the file locally first. If not found, downloads it from Hugging Face.
    Returns the absolute path to the file.
    """
    # Check local first
    local_path = os.path.join(BASE_DIR, 'data')
    if subfolder:
        local_path = os.path.join(local_path, subfolder)
    local_file = os.path.join(local_path, filename)

    if os.path.exists(local_file):
        return local_file

    print(f"File {filename} not found locally. Downloading from Hugging Face repo: {REPO_ID}...")
    try:
        downloaded_path = hf_hub_download(
            repo_id=REPO_ID,
            filename=filename,
            subfolder=subfolder,
            repo_type="dataset",
            token=HF_TOKEN
        )

        print(f"Successfully downloaded {filename}")
        return downloaded_path
    except Exception as e:
        print(f"Error downloading {filename} from Hugging Face: {e}")
        return local_file


def get_artifact_file(filename: str) -> str:
    """
    Tries to find a pre-built artifact locally. If not found, downloads it
    from the 'artifacts/' subfolder on Hugging Face.
    Returns the absolute path to the file.
    """
    local_file = os.path.join(BASE_DIR, 'artifacts', filename)

    if os.path.exists(local_file):
        return local_file

    os.makedirs(os.path.join(BASE_DIR, 'artifacts'), exist_ok=True)

    print(f"Artifact {filename} not found locally. Downloading from Hugging Face repo: {REPO_ID}...")
    try:
        downloaded_path = hf_hub_download(
            repo_id=REPO_ID,
            filename=f"artifacts/{filename}",
            repo_type="dataset",
            local_dir=BASE_DIR,
            token=HF_TOKEN
        )

        print(f"Successfully downloaded artifact {filename}")
        # hf_hub_download with local_dir places it at BASE_DIR/artifacts/<filename>
        return local_file
    except Exception as e:
        print(f"Error downloading artifact {filename} from Hugging Face: {e}")
        return local_file
