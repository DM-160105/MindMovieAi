from __future__ import annotations
"""
Hugging Face User Data Synchronization.

Queues user profile updates in-memory and periodically flushes them to
`users_data.csv` on the Hugging Face Hub (dev1601/MindMovieAi).
Used by the collaborative filtering recommendation engine.
"""

import os
import threading

import pandas as pd
from huggingface_hub import HfApi, hf_hub_download

from hf_utils import REPO_ID, HF_TOKEN, BASE_DIR

_upload_queue: list[dict] = []
_queue_lock = threading.Lock()

DATA_DIR = os.path.join(BASE_DIR, "data")
LOCAL_CSV_PATH = os.path.join(DATA_DIR, "users_data.csv")

_CSV_COLUMNS = [
    "user_id", "age", "gender",
    "favorite_genres", "disliked_genres",
    "location_lat", "location_lon",
]


def _ensure_local_csv() -> pd.DataFrame:
    """Return the local CSV as a DataFrame, downloading from HF if needed."""
    os.makedirs(DATA_DIR, exist_ok=True)

    if not os.path.exists(LOCAL_CSV_PATH):
        try:
            downloaded = hf_hub_download(
                repo_id=REPO_ID,
                filename="data/users_data.csv",
                repo_type="dataset",
                token=HF_TOKEN,
            )
            df = pd.read_csv(downloaded)
            df.to_csv(LOCAL_CSV_PATH, index=False)
            return df
        except Exception as exc:
            print(f"[hf_sync] Creating fresh users_data.csv ({exc})")
            df = pd.DataFrame(columns=_CSV_COLUMNS)
            df.to_csv(LOCAL_CSV_PATH, index=False)
            return df

    return pd.read_csv(LOCAL_CSV_PATH)


def queue_user_sync(user_doc: dict) -> None:
    """Queue a user profile for background synchronization to Hugging Face."""
    if HF_TOKEN is None:
        print("[hf_sync] HF_TOKEN not set — skipping sync.")
        return

    with _queue_lock:
        _upload_queue.append({
            "user_id": str(user_doc.get("_id", "")),
            "age": user_doc.get("age"),
            "gender": user_doc.get("gender"),
            "favorite_genres": user_doc.get("favorite_genres", ""),
            "disliked_genres": user_doc.get("disliked_genres", ""),
            "location_lat": user_doc.get("location_lat"),
            "location_lon": user_doc.get("location_lon"),
        })

        if _upload_queue:
            threading.Thread(target=_flush_queue_to_hf, daemon=True).start()


def _flush_queue_to_hf() -> None:
    """Background worker: merge queued rows into the CSV and upload to HF."""
    api = HfApi()

    with _queue_lock:
        if not _upload_queue:
            return
        new_rows = pd.DataFrame(_upload_queue)
        _upload_queue.clear()

    try:
        df = _ensure_local_csv()
        df = df.set_index("user_id")
        new_rows = new_rows.set_index("user_id")

        # Upsert: update existing rows, append new ones
        df.update(new_rows)
        new_records = new_rows[~new_rows.index.isin(df.index)]
        if not new_records.empty:
            df = pd.concat([df, new_records])

        df = df.reset_index()
        df.to_csv(LOCAL_CSV_PATH, index=False)

        api.upload_file(
            path_or_fileobj=LOCAL_CSV_PATH,
            path_in_repo="data/users_data.csv",
            repo_id=REPO_ID,
            repo_type="dataset",
            token=HF_TOKEN,
            commit_message="Auto-sync user profile data",
        )
        print("[hf_sync] Successfully synced users_data.csv to Hugging Face.")
    except Exception as exc:
        print(f"[hf_sync] Flush failed: {exc}")
