#!/usr/bin/env python3
"""Publish cached facsimile PDFs into the static site.

The sync pipeline downloads every original PDF into ``.cache/pdfs/`` (gitignored,
~75 MB for the current 211 documents). Embedding the remote cpim.org URL in the
reader means PDF verification breaks whenever the publisher is offline, rate
limits, or sends ``X-Frame-Options``.

This script copies the cache into ``static/pdfs/`` so the reader can serve the
facsimile itself. The reader probes ``/pdfs/<slug>.pdf`` and only falls back to
the remote URL when no local copy exists, so running this is optional.

Usage:
    python3 scripts/publish_pdfs.py
    npm run pdfs
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = ROOT / ".cache" / "pdfs"
TARGET_DIR = ROOT / "static" / "pdfs"


def main() -> int:
    if not CACHE_DIR.is_dir():
        print(f"No PDF cache found at {CACHE_DIR.relative_to(ROOT)}.")
        print("Run `python scripts/sync.py` first to populate it.")
        return 1

    TARGET_DIR.mkdir(parents=True, exist_ok=True)

    copied = 0
    current = 0
    for pdf in sorted(CACHE_DIR.glob("*.pdf")):
        destination = TARGET_DIR / pdf.name
        if destination.exists() and destination.stat().st_size == pdf.stat().st_size:
            current += 1
            continue
        shutil.copy2(pdf, destination)
        copied += 1

    total_bytes = sum(path.stat().st_size for path in TARGET_DIR.glob("*.pdf"))
    print(
        f"Facsimiles: {copied} copied, {current} already current "
        f"-> {TARGET_DIR.relative_to(ROOT)} ({total_bytes / 1_000_000:.1f} MB)"
    )
    print("static/pdfs is gitignored — rebuild (`npm run build`) to ship them.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
