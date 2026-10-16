#!/usr/bin/env python3
"""
Semantic Embedding Pipeline for CPI(M) Archive.
Uses Ollama's embeddinggemma-2:270m locally — no API key required.
Generates 256-dim MRL vectors for all extracted .md documents.
Computes top-5 nearest-neighbour similarity graph.
Writes static/vectors.json for client-side semantic search.

Usage:
  python scripts/embed.py [--model embeddinggemma-2:270m] [--dim 256] [--force]
"""

import argparse
import json
import math
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
import httpx

ROOT_DIR = Path(__file__).resolve().parent.parent
MANIFEST_PATH = ROOT_DIR / "data" / "manifest.json"
CONTENT_DIR = ROOT_DIR / "src" / "content" / "documents"
STATIC_DIR = ROOT_DIR / "static"
OUTPUT_PATH = STATIC_DIR / "vectors.json"

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)


def load_env_file():
    """Loads key-value pairs from .env into os.environ if not already present."""
    env_file = ROOT_DIR / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip('"').strip("'")
                if k and k not in os.environ:
                    os.environ[k] = v


load_env_file()

raw_ollama = os.environ.get("OLLAMA_URL", "http://localhost:11434").rstrip("/")
if "/api/" in raw_ollama:
    OLLAMA_BASE = raw_ollama.split("/api/")[0]
else:
    OLLAMA_BASE = raw_ollama

OLLAMA_EMBED_URL = f"{OLLAMA_BASE}/api/embed"
OLLAMA_TAGS_URL = f"{OLLAMA_BASE}/api/tags"


def parse_frontmatter(md_text: str) -> tuple[dict, str]:
    """Extract YAML frontmatter dict and body text."""
    match = FRONTMATTER_RE.match(md_text)
    if not match:
        return {}, md_text
    fm_raw = match.group(1)
    body = md_text[match.end():]
    fm = {}
    for line in fm_raw.splitlines():
        if ": " in line:
            k, v = line.split(": ", 1)
            fm[k.strip()] = v.strip().strip('"')
    return fm, body


def build_corpus_input(fm: dict, body: str) -> str:
    """
    Format input for EmbeddingGemma 2 corpus indexing.
    Uses title: ... | text: ... instruction prefix pattern.
    """
    title = fm.get("title", "Untitled")
    body_excerpt = body[:8000].strip()
    return f"title: {title} | text: {body_excerpt}"


def cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    return dot / (norm_a * norm_b + 1e-9)


def embed_text(client: httpx.Client, text: str, model: str, dim: int) -> list[float]:
    """Single Ollama embed call. Returns float vector of length dim."""
    payload = {
        "model": model,
        "input": text,
        "dimensions": dim,
        "truncate": True,
        "keep_alive": "5m",
    }
    resp = client.post(OLLAMA_EMBED_URL, json=payload, timeout=60.0)
    resp.raise_for_status()
    data = resp.json()
    return data["embeddings"][0]


def compute_top_k_similar(vectors: list[dict], k: int = 5) -> dict[str, list[dict]]:
    """Brute-force N×N cosine similarity, return top-k per doc."""
    slugs = [v["slug"] for v in vectors]
    vecs = [v["vector"] for v in vectors]
    result = {}
    n = len(slugs)
    for i in range(n):
        sims = []
        for j in range(n):
            if i != j:
                score = cosine_similarity(vecs[i], vecs[j])
                sims.append({"slug": slugs[j], "title": vectors[j]["title"], "score": round(score, 4)})
        sims.sort(key=lambda x: x["score"], reverse=True)
        result[slugs[i]] = sims[:k]
    return result


def check_ollama(client: httpx.Client, model: str) -> bool:
    """Ping Ollama and verify model is available."""
    try:
        resp = client.get(OLLAMA_TAGS_URL, timeout=5.0)
        if resp.status_code != 200:
            return False
        tags = [m["name"] for m in resp.json().get("models", [])]
        base_model = model.split(":")[0]
        if not any(base_model in t for t in tags):
            print(f"  [warn] Model '{model}' not found in Ollama models list: {tags}")
            print(f"  Please run: ollama pull {model}")
            return False
        return True
    except Exception as exc:
        print(f"  [error] Could not contact Ollama at {OLLAMA_BASE}: {exc}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Generate semantic vector embeddings for CPI(M) archive documents.")
    parser.add_argument("--model", default="embeddinggemma-2:270m", help="Ollama embedding model tag")
    parser.add_argument("--dim", type=int, default=256, choices=[128, 256, 512, 768], help="MRL output dimensions")
    parser.add_argument("--force", action="store_true", help="Re-embed all docs, even if already embedded")
    parser.add_argument("--top-k", type=int, default=5, help="Number of similar docs to precompute per document")
    args = parser.parse_args()

    STATIC_DIR.mkdir(parents=True, exist_ok=True)

    md_files = sorted(CONTENT_DIR.glob("*.md"))
    if not md_files:
        print("[error] No .md files found in src/content/documents/. Run sync.py first.")
        return

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8")) if MANIFEST_PATH.exists() else {}

    # Load existing index if not forcing
    existing_index = {}
    if OUTPUT_PATH.exists() and not args.force:
        try:
            existing_data = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
            for doc in existing_data.get("documents", []):
                if len(doc.get("vector", [])) == args.dim and doc.get("model") == args.model:
                    existing_index[doc["slug"]] = doc
            if existing_index:
                print(f"  Loaded {len(existing_index)} existing embeddings (dim={args.dim})")
        except Exception:
            pass

    with httpx.Client(timeout=60.0) as client:
        if not check_ollama(client, args.model):
            print(f"[error] Ollama not reachable or model missing at {OLLAMA_EMBED_URL}")
            print(f"  Run: ollama serve  (and: ollama pull {args.model})")
            return

        print(f"[embed] Model: {args.model} | Dim: {args.dim} | Total Docs: {len(md_files)}")
        all_vectors = []
        skipped = 0

        for i, md_file in enumerate(md_files, 1):
            md_text = md_file.read_text(encoding="utf-8")
            fm, body = parse_frontmatter(md_text)
            slug = fm.get("slug", md_file.stem)

            if slug in existing_index and not args.force:
                all_vectors.append(existing_index[slug])
                skipped += 1
                continue

            corpus_input = build_corpus_input(fm, body)
            title_display = fm.get("title", slug)
            if len(title_display) > 60:
                title_display = title_display[:57] + "..."
            print(f"  [{i}/{len(md_files)}] Embedding: {title_display}")

            try:
                vector = embed_text(client, corpus_input, args.model, args.dim)
                all_vectors.append({
                    "slug": slug,
                    "title": fm.get("title", slug),
                    "date": fm.get("date", ""),
                    "category": fm.get("category", ""),
                    "model": args.model,
                    "vector": vector,
                    "similar": [],
                })
            except Exception as exc:
                print(f"  [warn] Failed to embed {slug}: {exc}")

            # Thermal-aware sleep on M1 Air
            time.sleep(0.3)

        print(f"  Embedded {len(all_vectors) - skipped} new docs, {skipped} cached.")

        # Compute similarity graph
        print(f"  Computing top-{args.top_k} similarity graph for {len(all_vectors)} docs...")
        similar_map = compute_top_k_similar(all_vectors, k=args.top_k)
        for doc in all_vectors:
            doc["similar"] = similar_map.get(doc["slug"], [])

        # Write vectors.json
        output = {
            "model": args.model,
            "dim": args.dim,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "count": len(all_vectors),
            "documents": all_vectors,
        }
        OUTPUT_PATH.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")
        size_kb = OUTPUT_PATH.stat().st_size // 1024
        print(f"  ✓ Written: static/vectors.json ({size_kb} KB, {len(all_vectors)} docs)")

        # Update manifest with embedding metadata
        manifest["embedding"] = {
            "model": args.model,
            "dim": args.dim,
            "doc_count": len(all_vectors),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
        MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
        MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
        print("  ✓ manifest.json updated with embedding metadata.")


if __name__ == "__main__":
    main()
