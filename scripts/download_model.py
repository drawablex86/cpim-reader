#!/usr/bin/env python3
"""
scripts/download_model.py

Downloads AI4Bharat IndicTrans2 model weights into .cache/models/indictrans2/
Supports:
    - 200M distilled (fast, low memory ~800MB): ai4bharat/indictrans2-en-indic-dist-200M
    - 1B full precision (~4.1GB): ai4bharat/indictrans2-en-indic-1B
    - ct2 quantized (~1.1GB): VarunGumma/indictrans2-en-indic-1B-ct2

Usage:
    python scripts/download_model.py --model 200m
    python scripts/download_model.py --model 1b
    python scripts/download_model.py --model ct2
"""

import os
import sys
import argparse
from pathlib import Path

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent
CACHE_MODELS_DIR = WORKSPACE_ROOT / ".cache" / "models" / "indictrans2"

MODEL_MAP = {
    "ct2": "adalat-ai/ct2-rotary-indictrans2-en-indic-dist-200M",
    "200m": "ai4bharat/indictrans2-en-indic-dist-200M",
}

def download_model(model_key: str, dest_dir: Path):
    repo_id = MODEL_MAP.get(model_key, MODEL_MAP["200m"])
    dest_path = dest_dir / model_key
    dest_path.mkdir(parents=True, exist_ok=True)

    print(f"==================================================")
    print(f"Downloading IndicTrans2 Model: {repo_id}")
    print(f"Target Directory: {dest_path}")
    print(f"==================================================")

    try:
        from huggingface_hub import snapshot_download
    except ImportError:
        print("[error] 'huggingface_hub' is not installed. Please install it first:")
        print("        pip install huggingface_hub")
        sys.exit(1)

    token = os.environ.get("HF_TOKEN")
    if not token:
        env_file = WORKSPACE_ROOT / ".env"
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                if line.startswith("HF_TOKEN="):
                    token = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break

    try:
        local_dir = snapshot_download(
            repo_id=repo_id,
            local_dir=str(dest_path),
            token=token,
            resume_download=True
        )
        print(f"\n[success] Model successfully downloaded to: {local_dir}")
        return local_dir
    except Exception as e:
        print(f"\n[error] Failed to download model: {e}")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Download IndicTrans2 model weights")
    parser.add_argument(
        "--model",
        choices=["ct2", "200m"],
        default="ct2",
        help="Model variant to download: ct2 (quantized INT8 ~807MB), 200m (distilled ~800MB)"
    )
    parser.add_argument(
        "--dest",
        default=str(CACHE_MODELS_DIR),
        help="Destination directory"
    )
    args = parser.parse_args()

    dest = Path(args.dest)
    download_model(args.model, dest)

if __name__ == "__main__":
    main()
