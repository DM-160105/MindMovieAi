"""
Hugging Face Dataset Utilities.

Downloads CSV data files and pre-built ML artifacts from the
`dev1601/MindMovieAi` Hugging Face dataset repository, with local caching.
"""

import os

from dotenv import load_dotenv
from huggingface_hub import hf_hub_download

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ID = os.getenv("HUGGINGFACE_DATASET_REPO", "dev1601/MindMovieAi")
HF_TOKEN = os.getenv("HF_TOKEN")


def get_dataset_file(filename: str, subfolder: str = "data") -> str:
    """Return the local path to *filename*, downloading from HF if missing."""
    local_file = os.path.join(BASE_DIR, subfolder, filename)
    if os.path.exists(local_file):
        return local_file

    print(f"[HF] Downloading {subfolder}/{filename} from {REPO_ID}…")
    try:
        downloaded = hf_hub_download(
            repo_id=REPO_ID,
            filename=filename,
            subfolder=subfolder,
            repo_type="dataset",
            token=HF_TOKEN,
        )
        print(f"[HF] Downloaded {filename}")
        return downloaded
    except Exception as exc:
        print(f"[HF] Error downloading {filename}: {exc}")
        return local_file


def get_artifact_file(filename: str) -> str:
    """Return the local path to a pre-built ML artifact, downloading from HF if missing."""
    local_file = os.path.join(BASE_DIR, "artifacts", filename)
    if os.path.exists(local_file):
        return local_file

    os.makedirs(os.path.join(BASE_DIR, "artifacts"), exist_ok=True)

    print(f"[HF] Downloading artifact {filename} from {REPO_ID}…")
    try:
        hf_hub_download(
            repo_id=REPO_ID,
            filename=f"artifacts/{filename}",
            repo_type="dataset",
            local_dir=BASE_DIR,
            token=HF_TOKEN,
        )
        print(f"[HF] Downloaded artifact {filename}")
        return local_file
    except Exception as exc:
        print(f"[HF] Error downloading artifact {filename}: {exc}")
        return local_file
