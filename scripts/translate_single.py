#!/usr/bin/env python3
"""
scripts/translate_single.py

Dedicated Single-Document Translation Worker for Development & Verification.
Translates ONE official CPI(M) document from English to Malayalam (or other Indic languages)
with granular real-time progress logging, model state tracking, and ideological glossary preservation.

Usage:
    python scripts/translate_single.py --slug 2025-04-04-resolution-to-condemn-israels-genocidal-attacks-on-gaza --engine ollama --lang ml --save
"""

import os
import sys
import json
import re
import argparse
from pathlib import Path
from datetime import datetime, timezone
import httpx

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent
DOCUMENTS_DIR = WORKSPACE_ROOT / "src" / "content" / "documents"
TRANSLATIONS_DIR = WORKSPACE_ROOT / "src" / "content" / "translations"
GLOSSARY_FILE = WORKSPACE_ROOT / "scripts" / "glossary" / "marxist_indic.json"
MANIFEST_FILE = WORKSPACE_ROOT / "data" / "manifest.json"

INDICTRANS_LANG_MAP = {
    "ml": {"name": "മലയാളം", "english_name": "Malayalam", "tag": "mal_Mlym"},
    "hi": {"name": "हिन्दी", "english_name": "Hindi", "tag": "hin_Deva"},
    "bn": {"name": "বাংলা", "english_name": "Bengali", "tag": "ben_Beng"},
}

def log(tag: str, msg: str):
    """Outputs structured progress lines for dev stream consumption."""
    print(f"[{tag}] {msg}", flush=True)

def load_glossary():
    if GLOSSARY_FILE.exists():
        try:
            with open(GLOSSARY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            log("WARN", f"Could not load glossary: {e}")
    return {}

def parse_frontmatter(content: str):
    match = re.match(r"^---\n(.*?)\n---\n(.*)$", content, re.DOTALL)
    if not match:
        return {}, content
    yaml_raw, body = match.group(1), match.group(2)
    meta = {}
    for line in yaml_raw.split("\n"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" in line:
            key, val = line.split(":", 1)
            meta[key.strip()] = val.strip().strip('"').strip("'")
    return meta, body

def serialize_frontmatter(meta: dict) -> str:
    lines = ["---"]
    for k, v in meta.items():
        if isinstance(v, (int, float)):
            lines.append(f"{k}: {v}")
        else:
            lines.append(f'{k}: "{v}"')
    lines.append("---\n")
    return "\n".join(lines)

def apply_glossary(text: str, glossary: dict, target_lang: str):
    masks = {}
    counter = 0
    masked = text
    applied_terms = []

    for term, trans in glossary.items():
        if term.lower() in masked.lower() and target_lang in trans:
            target_val = trans[target_lang]
            pattern = re.compile(re.escape(term), re.IGNORECASE)
            matches = set(pattern.findall(masked))
            for m in matches:
                mask_key = f"__TERM_{counter}__"
                counter += 1
                masks[mask_key] = target_val
                masked = masked.replace(m, mask_key)
                applied_terms.append(f"{term} -> {target_val}")

    return masked, masks, applied_terms

def restore_glossary(text: str, masks: dict):
    res = text
    for k, v in masks.items():
        res = res.replace(k, v)
        match = re.search(r"__TERM_(\d+)__", k)
        if match:
            idx = match.group(1)
            spaced_pattern = re.compile(rf"_{{1,2}}\s*TERM\s*_\s*{idx}\s*_+", re.IGNORECASE)
            res = spaced_pattern.sub(v, res)
    # Strip any stray lone underscores surrounded by whitespace
    res = re.sub(r"\s+_\s+", " ", res)
    return res

class SingleDocumentTranslator:
    def __init__(self, engine: str, target_lang: str, glossary: dict):
        self.engine = engine
        self.target_lang = target_lang
        self.glossary = glossary
        self.lang_info = INDICTRANS_LANG_MAP.get(target_lang, {"name": target_lang, "english_name": target_lang, "tag": f"{target_lang}_Indic"})
        self._indictrans_model = None
        self._indictrans_tokenizer = None
        self._ct2_translator = None
        self._ct2_ip = None
        self._ct2_sp_src = None
        self._ct2_sp_tgt = None

    def load_ct2(self):
        if self._ct2_translator is not None:
            return
        log("LOAD", "Loading CTranslate2 INT8 model (.cache/models/indictrans2/ct2-200m/)...")
        try:
            import ctranslate2
            import sentencepiece as spm
            from IndicTransToolkit.processor import IndicProcessor

            model_dir = WORKSPACE_ROOT / ".cache" / "models" / "indictrans2" / "ct2-200m" / "en-indic-200m-ct2" / "ctranslate2_model"
            sp_src_path = model_dir / "vocab" / "model.SRC"
            sp_tgt_path = model_dir / "vocab" / "model.TGT"

            self._ct2_ip = IndicProcessor(inference=True)
            self._ct2_translator = ctranslate2.Translator(str(model_dir), device="cpu", compute_type="int8")
            self._ct2_sp_src = spm.SentencePieceProcessor(model_file=str(sp_src_path))
            self._ct2_sp_tgt = spm.SentencePieceProcessor(model_file=str(sp_tgt_path))
            log("LOAD", "CTranslate2 INT8 model and tokenizers ready in memory.")
        except Exception as e:
            log("ERROR", f"Failed to load CTranslate2 model: {e}")
            raise

    def translate_with_ct2(self, text: str) -> str:
        self.load_ct2()
        tgt_tag = self.lang_info.get("tag", "mal_Mlym")

        # 1. IndicTransToolkit preprocess
        preprocessed = self._ct2_ip.preprocess_batch([text], src_lang="eng_Latn", tgt_lang=tgt_tag)

        # 2. Tokenize with source and target tags
        tokens = ["eng_Latn", tgt_tag] + self._ct2_sp_src.encode(preprocessed[0], out_type=str)

        # 3. Translate via CTranslate2
        results = self._ct2_translator.translate_batch([tokens], beam_size=1, max_decoding_length=512)
        hyp = results[0].hypotheses[0]

        # Filter language tags before decoding
        filtered = [t for t in hyp if t not in ["eng_Latn", tgt_tag] and not t.startswith("<2")]
        decoded = self._ct2_sp_tgt.decode(filtered)

        # 4. IndicTransToolkit postprocess
        postprocessed = self._ct2_ip.postprocess_batch([decoded], lang=tgt_tag)[0]

        # Clean any leftover language tag markers before target text
        clean_text = postprocessed.strip()
        clean_text = re.sub(r"^(?:(?:English|e?ng|mal|mlym|hindi|Latn|Mlim)\b|@\w+|[_\s])+", "", clean_text, flags=re.IGNORECASE).strip()
        clean_text = re.sub(r"^(?:(?:English|e?ng|mal|mlym|hindi|Latn|Mlim)\b|@\w+|[_\s])+", "", clean_text, flags=re.IGNORECASE).strip()
        return clean_text

    def load_indictrans2(self):
        if self._indictrans_model is not None:
            return
        log("LOAD", "Loading IndicTrans2 1B model into memory from .cache/models/indictrans2/1b/ ...")
        try:
            import torch
            from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
            model_dir = WORKSPACE_ROOT / ".cache" / "models" / "indictrans2" / "1b"
            self._indictrans_tokenizer = AutoTokenizer.from_pretrained(str(model_dir), trust_remote_code=True)
            self._indictrans_model = AutoModelForSeq2SeqLM.from_pretrained(str(model_dir), trust_remote_code=True)
            self._indictrans_model.eval()
            log("LOAD", "IndicTrans2 1B model loaded successfully into PyTorch.")
        except Exception as e:
            log("ERROR", f"Failed to load IndicTrans2 1B model: {e}")
            raise

    def translate_with_indictrans2(self, text: str) -> str:
        self.load_indictrans2()
        tag = self.lang_info.get("tag", "mal_Mlym")
        input_text = f"eng_Latn {tag} {text}"
        inputs = self._indictrans_tokenizer(input_text, return_tensors="pt")
        import torch
        with torch.no_grad():
            outputs = self._indictrans_model.generate(**inputs, max_new_tokens=512, num_beams=1, use_cache=False)
        return self._indictrans_tokenizer.batch_decode(outputs, skip_special_tokens=True)[0].strip()

    def translate_with_ollama(self, text: str) -> str:
        ollama_url = os.environ.get("OLLAMA_URL", "http://localhost:11434/api/generate")
        if "/api/generate" not in ollama_url:
            ollama_url = ollama_url.rstrip("/") + "/api/generate"

        lang_name = self.lang_info["english_name"]
        system_rules = (
            f"You are an official archivist for the Communist Party of India (Marxist).\n"
            f"Translate the following English document text into formal, publication-grade {lang_name} ({self.lang_info['name']}).\n"
            f"RULES:\n"
            f"1. Transcribe verbatim. Retain all political meanings accurately without summarizing or altering tone.\n"
            f"2. Maintain all Markdown syntax (such as headings #, lists -, bold **).\n"
            f"3. Return ONLY the translated Malayalam text. Do not include conversational remarks or preambles."
        )

        with httpx.Client(timeout=300.0) as client:
            resp = client.post(
                ollama_url,
                json={
                    "model": "qwen2.5:7b",
                    "prompt": f"{system_rules}\n\nText to translate:\n{text}",
                    "stream": False,
                    "options": {"temperature": 0.1, "num_ctx": 4096}
                }
            )
            if resp.status_code != 200:
                raise RuntimeError(f"Ollama returned HTTP {resp.status_code}: {resp.text}")
            out = resp.json().get("response", "").strip()
            return out

    def translate_with_openrouter(self, text: str) -> str:
        api_key = os.environ.get("OPENROUTER_API_KEY")
        if not api_key:
            env_file = WORKSPACE_ROOT / ".env"
            if env_file.exists():
                for line in env_file.read_text().splitlines():
                    if line.startswith("OPENROUTER_API_KEY="):
                        api_key = line.split("=", 1)[1].strip().strip('"').strip("'")
                        break

        if not api_key:
            raise RuntimeError("OPENROUTER_API_KEY is not set.")

        lang_name = self.lang_info["english_name"]
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "nvidia/nemotron-3-ultra-550b-a55b:free",
            "messages": [
                {
                    "role": "system",
                    "content": f"You are an official translator for the Communist Party of India (Marxist). Translate from English to {lang_name} verbatim without conversational commentary."
                },
                {"role": "user", "content": text}
            ],
            "temperature": 0.1
        }
        with httpx.Client(timeout=60.0) as client:
            resp = client.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload)
            if resp.status_code != 200:
                raise RuntimeError(f"OpenRouter returned HTTP {resp.status_code}: {resp.text}")
            return resp.json()["choices"][0]["message"]["content"].strip()

    def translate_unit(self, unit_text: str) -> str:
        if self.engine == "ct2":
            return self.translate_with_ct2(unit_text)
        elif self.engine == "ollama":
            return self.translate_with_ollama(unit_text)
        elif self.engine == "indictrans2":
            return self.translate_with_indictrans2(unit_text)
        elif self.engine == "openrouter":
            return self.translate_with_openrouter(unit_text)
        else:
            return f"[MOCK {self.target_lang.upper()}]: " + unit_text

    def translate_segment(self, segment: str, index: int, total: int) -> str:
        segment = segment.strip()
        if not segment:
            return ""

        masked_text, masks, terms = apply_glossary(segment, self.glossary, self.target_lang)
        if terms:
            log("GLOSSARY", f"Chunk {index}/{total}: Protected terms applied -> {', '.join(terms[:3])}")

        log("TRANSLATING", f"Processing chunk {index}/{total} ({len(segment)} chars) via {self.engine.upper()}...")

        # If a single chunk is long (> 800 chars), split by sentences to prevent timeouts
        if len(masked_text) > 800:
            sentences = re.split(r'(?<=[.!?])\s+', masked_text)
            sub_results = []
            curr_sub = ""
            for s in sentences:
                if len(curr_sub) + len(s) < 600:
                    curr_sub = f"{curr_sub} {s}".strip()
                else:
                    if curr_sub:
                        sub_results.append(self.translate_unit(curr_sub))
                    curr_sub = s
            if curr_sub:
                sub_results.append(self.translate_unit(curr_sub))
            raw_out = " ".join(sub_results)
        else:
            raw_out = self.translate_unit(masked_text)

        final_out = restore_glossary(raw_out, masks)
        preview_snippet = final_out.replace("\n", " ")[:90]
        log("PREVIEW", f"Chunk {index}/{total} -> {preview_snippet}...")
        return final_out


def main():
    parser = argparse.ArgumentParser(description="Single-Document Malayalam Translation Worker")
    parser.add_argument("--slug", default="2025-04-04-resolution-to-condemn-israels-genocidal-attacks-on-gaza", help="Document slug to translate")
    parser.add_argument("--engine", choices=["ct2", "ollama", "indictrans2", "openrouter", "mock"], default="ct2", help="Inference engine")
    parser.add_argument("--lang", default="ml", help="Target language code (ml = Malayalam)")
    parser.add_argument("--save", action="store_true", help="Automatically write result to src/content/translations/[lang]/")
    args = parser.parse_args()

    log("STATUS", f"Initiating single-document translation pipeline")
    log("CONFIG", f"Target Document : {args.slug}")
    log("CONFIG", f"Engine          : {args.engine.upper()}")
    log("CONFIG", f"Target Language : {args.lang.upper()} ({INDICTRANS_LANG_MAP.get(args.lang, {}).get('name', args.lang)})")

    doc_file = DOCUMENTS_DIR / f"{args.slug}.md"
    if not doc_file.exists():
        log("ERROR", f"File not found: {doc_file}")
        sys.exit(1)

    with open(doc_file, "r", encoding="utf-8") as f:
        raw_content = f.read()

    meta, body = parse_frontmatter(raw_content)
    glossary = load_glossary()
    log("LOAD", f"Loaded document '{meta.get('title', args.slug)}' ({len(body.splitlines())} lines)")
    log("LOAD", f"Ideological glossary ready with {len(glossary)} Marxist-Leninist definitions")

    translator = SingleDocumentTranslator(engine=args.engine, target_lang=args.lang, glossary=glossary)

    # 1. Translate Title
    log("STATUS", f"Translating document headline...")
    translated_title = translator.translate_segment(meta.get("title", ""), 0, 1)

    # 2. Translate Paragraphs
    paragraphs = [p.strip() for p in body.split("\n\n") if p.strip()]
    total_chunks = len(paragraphs)
    log("STATUS", f"Splitting document into {total_chunks} structured sections for translation")

    translated_paragraphs = []
    for i, p in enumerate(paragraphs, start=1):
        # Heading handling
        heading_match = re.match(r"^(#{1,6})\s+(.*)$", p)
        if heading_match:
            hashes, heading_text = heading_match.group(1), heading_match.group(2)
            t_head = translator.translate_segment(heading_text, i, total_chunks)
            translated_paragraphs.append(f"{hashes} {t_head}")
        else:
            t_para = translator.translate_segment(p, i, total_chunks)
            translated_paragraphs.append(t_para)

    final_translated_body = "\n\n".join(translated_paragraphs) + "\n"

    # Assemble translated metadata
    trans_meta = dict(meta)
    trans_meta["title"] = translated_title
    trans_meta["original_title"] = meta.get("title", "")
    trans_meta["language"] = args.lang
    trans_meta["language_name"] = INDICTRANS_LANG_MAP.get(args.lang, {}).get("name", args.lang)
    trans_meta["translated_via"] = f"{args.engine}-pipeline"
    trans_meta["translated_at"] = datetime.now(timezone.utc).isoformat()

    full_output = serialize_frontmatter(trans_meta) + "\n" + final_translated_body

    if args.save:
        out_dir = TRANSLATIONS_DIR / args.lang
        out_dir.mkdir(parents=True, exist_ok=True)
        out_file = out_dir / f"{args.slug}.md"
        with open(out_file, "w", encoding="utf-8") as f:
            f.write(full_output)
        log("SAVED", f"Successfully wrote translation to: {out_file.relative_to(WORKSPACE_ROOT)}")

        # Update manifest
        if MANIFEST_FILE.exists():
            try:
                manifest = json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))
                source_url = meta.get("source_pdf_url") or meta.get("source_post_url") or args.slug
                if source_url in manifest.get("documents", {}):
                    if "translations" not in manifest["documents"][source_url]:
                        manifest["documents"][source_url]["translations"] = {}
                    manifest["documents"][source_url]["translations"][args.lang] = {
                        "status": "completed",
                        "engine": args.engine,
                        "file": str(out_file.relative_to(WORKSPACE_ROOT)),
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                    MANIFEST_FILE.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
                    log("SAVED", f"Updated data/manifest.json registry.")
            except Exception as e:
                log("WARN", f"Could not update manifest: {e}")

    log("COMPLETED", f"Single-document Malayalam translation complete!")
    print("\n" + "=" * 50)
    print("FINAL TRANSLATED PREVIEW (HEADLINE):")
    print(translated_title)
    print("=" * 50)

if __name__ == "__main__":
    main()
