#!/usr/bin/env python3
"""
Incremental Scraper & Dual-Mode Document Extraction Pipeline for https://cpim.org/documents/
Supports both PDF documents and official HTML articles across 273+ cataloged documents.
Multi-provider architecture:
  - Local Ollama: qwen2.5vl:3b / glm-ocr (Vision) + qwen2.5:7b (Text Structuring)
  - Cloud Free Fallback: OpenRouter Free tier with nvidia/nemotron-3-ultra-550b-a55b:free
  - Fast Baseline: Deterministic pymupdf4llm (zero GPU/API)
"""

import argparse
import base64
import hashlib
import io
import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

import pymupdf as fitz
import httpx
import pymupdf4llm
from bs4 import BeautifulSoup
from PIL import Image
from slugify import slugify

BASE_URL = "https://cpim.org/documents/"
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434/api/generate")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

DEFAULT_VLM_MODEL = "qwen2.5vl:3b"
DEFAULT_TEXT_MODEL = "qwen2.5:7b"
NEMOTRON_TEXT_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free"
NEMOTRON_VL_MODEL = "nvidia/nemotron-3.5-super-vl:free"

ROOT_DIR = Path(__file__).resolve().parent.parent
MANIFEST_PATH = ROOT_DIR / "data" / "manifest.json"
PDF_CACHE_DIR = ROOT_DIR / ".cache" / "pdfs"
OUTPUT_MD_DIR = ROOT_DIR / "src" / "content" / "documents"


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

LETTERHEAD_PATTERNS = [
    r"A\.?\s*K\.?\s*Gopalan\s*Bhawan.*?(?:New\s*Delhi|110\s*001).*?\n",
    r"27-29,?\s*Bhai\s*Vir\s*Singh\s*Marg.*?(?:\n|$)",
    r"^\s*Page\s+\d+\s*(?:of\s+\d+)?\s*$",
    r"^\s*-\s*\d+\s*-\s*$",
]


def load_manifest() -> dict:
    if MANIFEST_PATH.exists():
        return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    return {"version": "1.0.0", "last_synced": None, "documents": {}}


def save_manifest(manifest: dict) -> None:
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    manifest["last_synced"] = datetime.now(timezone.utc).isoformat()
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")


def parse_date(date_str: str) -> str:
    date_str = date_str.strip()
    for fmt in ("%B %d, %Y", "%b %d, %Y", "%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(date_str, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return datetime.today().strftime("%Y-%m-%d")


def clean_letterhead_regex(text: str) -> str:
    for pattern in LETTERHEAD_PATTERNS:
        text = re.sub(pattern, "", text, flags=re.IGNORECASE | re.MULTILINE)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def discover_documents(client: httpx.Client) -> list[dict]:
    """Scrapes cpim.org/documents/ for both PDF entries and HTML article entries."""
    resp = client.get(BASE_URL, timeout=30.0)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    discovered = []
    seen_identifiers = set()

    for row in soup.select("table#example tbody tr, table tr"):
        tds = row.find_all("td")
        if len(tds) < 2:
            continue

        raw_date = tds[0].get_text(strip=True)
        title_link = tds[1].find("a")
        title = title_link.get_text(strip=True) if title_link else tds[1].get_text(strip=True)
        title = re.sub(r"\s*Download\s*$", "", title, flags=re.I).strip()
        if not title:
            continue

        post_url = urljoin(BASE_URL, title_link["href"].strip()) if title_link else None

        # Check for direct PDF download link in 3rd column or elsewhere in row
        pdf_link = row.find("a", href=re.compile(r"\.pdf$", re.I))
        pdf_url = urljoin(BASE_URL, pdf_link["href"].strip()) if pdf_link else None

        identifier = pdf_url or post_url
        if not identifier or identifier in seen_identifiers:
            continue
        seen_identifiers.add(identifier)

        # Categorization heuristic
        category = "CC Documents"
        lower_title = title.lower()
        if "congress" in lower_title:
            category = "Party Congress"
        elif any(k in lower_title for k in ["caste", "health", "education", "kisan", "women", "worker"]):
            category = "Issues"
        elif "note" in lower_title or "stand" in lower_title:
            category = "Left View"

        discovered.append({
            "title": title,
            "date": parse_date(raw_date),
            "category": category,
            "source_pdf_url": pdf_url,
            "source_post_url": post_url,
            "has_direct_pdf": bool(pdf_url),
        })

    return discovered


def page_needs_vision_ocr(page: fitz.Page) -> tuple[bool, str]:
    text = page.get_text("text").strip()
    if len(text) < 60:
        return True, "Text Recognition:"
    tables = page.find_tables()
    if tables and len(tables.tables) > 0:
        return True, "Table Recognition:"
    return False, ""


def ocr_page_with_ollama(client: httpx.Client, page: fitz.Page, model: str, prompt_prefix: str, max_dim: int = 1024) -> str:
    pix = page.get_pixmap(dpi=140)
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64_img = base64.b64encode(buf.getvalue()).decode("utf-8")

    payload = {
        "model": model,
        "prompt": prompt_prefix,
        "images": [b64_img],
        "stream": False,
        "keep_alive": "5m",
        "options": {"temperature": 0.0, "num_ctx": 4096},
    }
    resp = client.post(OLLAMA_URL, json=payload, timeout=120.0)
    resp.raise_for_status()
    return resp.json().get("response", "").strip()


def ocr_page_with_openrouter(client: httpx.Client, page: fitz.Page, api_key: str, max_dim: int = 1024) -> str:
    pix = page.get_pixmap(dpi=140)
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64_img = base64.b64encode(buf.getvalue()).decode("utf-8")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "https://github.com/cpim-archive/cpim-reader",
        "X-Title": "CPIM Archive Sync Pipeline",
    }
    payload = {
        "model": NEMOTRON_VL_MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Extract all text from this page verbatim into clean Markdown. Preserve all headings and tables."},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64_img}"}},
                ],
            }
        ],
        "temperature": 0.0,
    }
    resp = client.post(OPENROUTER_URL, headers=headers, json=payload, timeout=120.0)
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"].strip()


def normalize_markdown(client: httpx.Client, raw_md: str, provider: str = "ollama", api_key: str = None) -> str:
    system_prompt = (
        "You are an archival document transcription engine for the Communist Party of India (Marxist). "
        "Strict rules: 1. Preserved text must be 100% verbatim. Do NOT summarize or omit words. "
        "2. Convert primary Roman numeral sections (e.g. Part I, I., II.) into '## ' headings. "
        "3. Strip recurring publisher address letterhead noise and standalone page numbers. Output Markdown ONLY."
    )

    if provider == "openrouter" and api_key:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "HTTP-Referer": "https://github.com/cpim-archive/cpim-reader",
            "X-Title": "CPIM Archive Sync Pipeline",
        }
        payload = {
            "model": NEMOTRON_TEXT_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": raw_md[:20000]},
            ],
            "temperature": 0.0,
        }
        try:
            resp = client.post(OPENROUTER_URL, headers=headers, json=payload, timeout=120.0)
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()
        except Exception as exc:
            print(f"  [warn] OpenRouter Nemotron cleanup failed ({exc}); using regex-cleaned text.")
            return raw_md

    # Default to Local Ollama
    payload = {
        "model": DEFAULT_TEXT_MODEL,
        "system": system_prompt,
        "prompt": raw_md[:12000],
        "stream": False,
        "keep_alive": "5m",
        "options": {"temperature": 0.0, "num_ctx": 8192},
    }
    try:
        resp = client.post(OLLAMA_URL, json=payload, timeout=120.0)
        resp.raise_for_status()
        return resp.json().get("response", raw_md).strip()
    except Exception as exc:
        print(f"  [warn] Local Ollama cleanup skipped ({exc}); using regex-cleaned text.")
        return raw_md


def extract_pdf(pdf_path: Path, client: httpx.Client, provider: str = "ollama", api_key: str = None, vlm_model: str = DEFAULT_VLM_MODEL) -> tuple[str, int, str]:
    doc = fitz.open(pdf_path)
    page_count = len(doc)
    page_chunks = []
    used_vlm = False

    for idx, page in enumerate(doc):
        needs_vlm, prompt_prefix = page_needs_vision_ocr(page)
        if provider != "none" and needs_vlm:
            try:
                print(f"  -> Page {idx + 1}/{page_count}: Running VLM ({provider})")
                if provider == "openrouter" and api_key:
                    vlm_md = ocr_page_with_openrouter(client, page, api_key)
                else:
                    vlm_md = ocr_page_with_ollama(client, page, vlm_model, prompt_prefix)
                page_chunks.append(clean_letterhead_regex(vlm_md))
                used_vlm = True
                continue
            except Exception as exc:
                print(f"  [warn] VLM failed on page {idx + 1} ({exc}), falling back to pymupdf4llm")

        md_text = pymupdf4llm.to_markdown(doc, pages=[idx])
        page_chunks.append(clean_letterhead_regex(md_text))

    combined_md = "\n\n".join(chunk for chunk in page_chunks if chunk)
    if provider != "none" and not used_vlm and len(combined_md) < 15000:
        combined_md = normalize_markdown(client, combined_md, provider=provider, api_key=api_key)

    method = f"hybrid-{provider}" if used_vlm else "pymupdf4llm"
    return combined_md, page_count, method


def extract_html_post(post_url: str, client: httpx.Client) -> tuple[str, str]:
    """Extracts article text from cpim.org WordPress post and strips noisy widgets."""
    resp = client.get(post_url, timeout=30.0)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    article = soup.select_one(".articleText") or soup.select_one(".articleBody") or soup.select_one(".articleContainer")
    if not article:
        raise ValueError(f"Could not locate article body in {post_url}")

    # Remove sharing buttons, scripts, and embedded download buttons
    for tag in article.select(".heateor_sss_sharing_container, .articleImage, script, style"):
        tag.decompose()

    # Convert paragraphs to clean markdown
    blocks = []
    for p in article.find_all("p"):
        txt = p.get_text(" ", strip=True)
        if not txt:
            continue
        # Heading heuristics
        if p.find(["b", "strong"]) and len(txt) < 80 and not txt.endswith("."):
            blocks.append(f"\n## {txt}\n")
        else:
            blocks.append(txt)

    body_md = "\n\n".join(blocks)
    sha256_hash = hashlib.sha256(body_md.encode("utf-8")).hexdigest()
    return body_md, sha256_hash


def main():
    parser = argparse.ArgumentParser(description="Sync and extract CPI(M) official documents to Markdown.")
    parser.add_argument("--limit", type=int, default=5, help="Max new documents to process in one run")
    parser.add_argument("--dry-run", action="store_true", help="List new documents without downloading")
    parser.add_argument("--provider", choices=["ollama", "openrouter", "none"], default="ollama", help="Inference provider")
    parser.add_argument("--vlm-model", default=DEFAULT_VLM_MODEL, help="Local VLM model tag (e.g. qwen2.5vl:3b, glm-ocr)")
    parser.add_argument("--force", action="store_true", help="Re-process even if already in manifest")
    args = parser.parse_args()

    openrouter_key = os.environ.get("OPENROUTER_API_KEY")
    if args.provider == "openrouter" and not openrouter_key:
        print("[error] --provider openrouter requires OPENROUTER_API_KEY environment variable.")
        return

    PDF_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_MD_DIR.mkdir(parents=True, exist_ok=True)
    manifest = load_manifest()

    with httpx.Client(follow_redirects=True, headers={"User-Agent": "CPIM-Archive-Sync/2.0"}) as client:
        docs = discover_documents(client)
        print(f"Discovered {len(docs)} documents on {BASE_URL}")

        new_docs = [
            d for d in docs
            if args.force or (d["source_pdf_url"] or d["source_post_url"]) not in manifest["documents"]
        ]
        print(f"New/pending documents to process: {len(new_docs)}")

        if args.dry_run:
            for d in new_docs[: args.limit]:
                mode = "PDF" if d["has_direct_pdf"] else "HTML"
                print(f"  [DRY-RUN] [{mode}] {d['date']} | {d['title']} -> {d['source_pdf_url'] or d['source_post_url']}")
            return

        for count, item in enumerate(new_docs[: args.limit], start=1):
            slug = f"{item['date']}-{slugify(item['title'])[:70]}"
            md_file = OUTPUT_MD_DIR / f"{slug}.md"
            print(f"[{count}/{min(len(new_docs), args.limit)}] Processing: {item['title']}")

            if item["has_direct_pdf"]:
                pdf_file = PDF_CACHE_DIR / f"{slug}.pdf"
                pdf_resp = client.get(item["source_pdf_url"], timeout=60.0)
                pdf_resp.raise_for_status()
                pdf_file.write_bytes(pdf_resp.content)
                sha256_hash = hashlib.sha256(pdf_resp.content).hexdigest()
                body_md, pages, method = extract_pdf(
                    pdf_file, client, provider=args.provider, api_key=openrouter_key, vlm_model=args.vlm_model
                )
            else:
                body_md, sha256_hash = extract_html_post(item["source_post_url"], client)
                pages = max(1, len(body_md) // 2500)
                method = "html-archive"

            safe_title = item["title"].replace('"', "'")
            frontmatter = (
                "---\n"
                f'title: "{safe_title}"\n'
                f'slug: "{slug}"\n'
                f'date: "{item["date"]}"\n'
                f'category: "{item["category"]}"\n'
                'author: "Central Committee, Communist Party of India (Marxist)"\n'
                'publisher: "Communist Party of India (Marxist)"\n'
                f'source_pdf_url: "{item["source_pdf_url"] or ""}"\n'
                f'source_post_url: "{item["source_post_url"] or ""}"\n'
                f"page_count: {pages}\n"
                f'extraction_method: "{method}"\n'
                f'sha256: "{sha256_hash}"\n'
                "---\n\n"
            )
            md_file.write_text(frontmatter + body_md + "\n", encoding="utf-8")

            record_key = item["source_pdf_url"] or item["source_post_url"]
            manifest["documents"][record_key] = {
                "slug": slug,
                "title": item["title"],
                "date": item["date"],
                "category": item["category"],
                "page_count": pages,
                "sha256": sha256_hash,
                "extraction_method": method,
                "status": "completed",
                "processed_at": datetime.now(timezone.utc).isoformat(),
            }
            save_manifest(manifest)
            time.sleep(1.0)


if __name__ == "__main__":
    main()