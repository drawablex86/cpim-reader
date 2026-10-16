# Local LLM, VLM & Cloud Fallback Specification (`LLM_SPEC.md`)

## 1. Target Hardware Profile
- **Primary Machine**: Apple MacBook Air (M1, Fanless Passive Cooling)
- **Unified Memory**: 16 GB RAM
- **Local Runtime**: Ollama (`http://localhost:11434`)
- **Cloud Fallback Runtime**: OpenRouter Free Tier API (`https://openrouter.ai/api/v1/chat/completions`)

---

## 2. Multi-Tier Model Architecture

```text
[PDF / Document Page]
         │
         ├───► Tier 1: Born-digital text? ──► pymupdf4llm (Instant, 0 MB VRAM)
         │
         └───► Tier 2: Scanned, Dense Tables, or Formatting Required
                   │
                   ├──► Local Inference (Ollama)
                   │     ├─ Vision VLM: Qwen2.5-VL 3B (`qwen2.5vl:3b`) [~3.2 GB]
                   │     │  └─ Ultra-compact fallback: GLM-OCR 0.9B (`glm-ocr`) [~1.2 GB]
                   │     └─ Structuring: Qwen2.5 7B (`qwen2.5:7b`) [~4.7 GB]
                   │
                   └──► Cloud Free Fallback (OpenRouter `OPENROUTER_API_KEY`)
                         ├─ Vision VLM: `nvidia/nemotron-3.5-super-vl:free`
                         └─ Structuring: `nvidia/nemotron-3-ultra-550b-a55b:free`
```

---

## 3. Local Model Specifications (Ollama)

### 3.1 Primary Vision Specialist: `qwen2.5vl:3b` (Alibaba Cloud)
- **Parameter Count**: 3B (`~3.2 GB` quantized in unified memory)
- **Ollama Tag**: `qwen2.5vl:3b` (or `qwen2.5vl`)
- **Key Capabilities**:
  - **Dynamic Resolution**: Natively preserves original document aspect ratios without forcing distortion, ensuring tiny table fonts remain sharp.
  - **Spatial Layout Recognition**: Accurately reproduces multi-column text flow and complex table borders in Markdown.
- **Operating Constraints**:
  - `concurrency = 1` (never run parallel VLM calls on fanless M1 Air).
  - Downscale rendered PDF pages to `max_dim = 1024px` at 140 DPI.
  - `keep_alive = "5m"` to release unified RAM promptly after extraction batches.
  - Parameters: `"temperature": 0.0`, `"num_ctx": 8192`.

### 3.2 Ultra-Compact Vision Specialist: `glm-ocr` (Zhipu AI)
- **Parameter Count**: 0.9B (`~1.2 GB` quantized in unified memory)
- **Ollama Tag**: `glm-ocr`
- **Role**: Lightweight fallback for memory-constrained local runs.
- **Operating Constraints**: Cap image at `max_dim = 768px`. Prompt prefix: `"Table Recognition:"` or `"Text Recognition:"`.

### 3.3 Structural Markdown Formatter: `qwen2.5:7b` (Alibaba Cloud)
- **Parameter Count**: 7B (Q4_K_M quantization, `~4.7 GB` unified memory)
- **Ollama Tag**: `qwen2.5:7b`
- **Role**: Post-processes raw text from `pymupdf4llm`.
  - Normalizes Roman numeral sections (`I.`, `II.`, `Part-I`) into Markdown `##` and `###` headings.
  - Strips recurring letterhead noise (A.K. Gopalan Bhawan address, phone lines, standalone page numbers).
  - Preserves 100% verbatim text with zero omissions or editorializing.

---

## 4. Cloud Free Fallback: NVIDIA Nemotron (OpenRouter)

When the repo maintainer prefers zero local GPU/battery consumption or faster processing on long multi-page documents, `scripts/sync.py` supports OpenRouter's free tier:

- **Environment Variable**: `export OPENROUTER_API_KEY="sk-or-v1-..."`
- **API Endpoint**: `https://openrouter.ai/api/v1/chat/completions`

### 4.1 Structuring Model: `nvidia/nemotron-3-ultra-550b-a55b:free`
- **Architecture**: 550B total / 55B active Mixture-of-Experts (MoE).
- **Alternative Tag**: `nvidia/llama-3.1-nemotron-70b-instruct:free`
- **Role**: Frontier-level reasoning and instruction-following to parse dense political resolutions into clean, structured Markdown hierarchy.

### 4.2 Vision Model: `nvidia/nemotron-3.5-super-vl:free`
- **Role**: Multimodal visual OCR on difficult or multi-column scanned pages via base64 data URLs.

---

## 5. Strict Archival Prompting Contract

Whether calling local Ollama or OpenRouter Nemotron, all extraction prompts must strictly enforce verbatim archival fidelity:

```text
SYSTEM PROMPT:
You are an archival document transcription engine for the Communist Party of India (Marxist).
Your mission is to transcribe the provided text/image into clean, well-formatted Markdown.

ABSOLUTE ARCHIVAL RULES:
1. VERBATIM ACCURACY: Never summarize, rephrase, omit, or interpret political resolutions. Every word must be preserved exactly as published.
2. SECTION HIERARCHY:
   - Convert primary Roman numeral sections ("I. Public Health", "Part II") into "## " headings.
   - Convert sub-sections or state sections into "### " headings.
3. REMOVE BOILERPLATE NOISE:
   - Strip recurring publisher letterhead lines (e.g. "A.K. Gopalan Bhawan, 27-29 Bhai Vir Singh Marg, New Delhi 110001", telephone numbers, email addresses).
   - Strip standalone page number lines (e.g. "Page 12 of 34", "- 12 -").
4. OUTPUT FORMAT:
   - Output valid Markdown ONLY. Do not include introductory remarks, commentary, or conversational wrappers.
```