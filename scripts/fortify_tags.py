#!/usr/bin/env python3
"""
scripts/fortify_tags.py

Fortify Tagging Pipeline for CPI(M) Archive.
Combines deterministic rule matching with Vector DB Cosine Similarity
using the existing 256-dim EmbeddingGemma-2 vector database (static/vectors.json).

Identifies cross-cutting topics (such as gender & women's rights, healthcare,
disability & LGBTQI+, caste, environment) within omnibus resolutions and
election manifestos using topic centroid cosine similarity and section heading gates.

Usage:
  python scripts/fortify_tags.py [--dry-run] [--threshold 0.84]
"""

import argparse
import json
import math
import re
import sys
from pathlib import Path
import yaml

ROOT_DIR = Path(__file__).resolve().parent.parent
DOCUMENTS_DIR = ROOT_DIR / "src" / "content" / "documents"
TRANSLATIONS_DIR = ROOT_DIR / "src" / "content" / "translations"
VECTORS_PATH = ROOT_DIR / "static" / "vectors.json"

# Topic Definitions & Cornerstone Anchor Documents for Centroid Computation
TOPIC_ANCHORS = {
    'gender-womens-rights': {
        'anchors': [
            '2009-08-08-perspective-on-womens-issues',
            '2015-07-31-on-crimes-against-women-21congress',
            '2019-03-30-ensure-equal-rights-for-women',
            '2022-04-09-resolution-against-growing-attacks-on-women',
            '2025-04-05-resolution-against-increasing-violence-on-women-and-children'
        ],
        'heading_patterns': [r'\bwomen\b', r'\bgender\b', r'\bcrimes against women\b', r'\bfemale\b', r'\bpatriarch'],
        'body_terms': [r'\bwomen\b', r'\bgender\b', r'\bcrimes against women\b', r'\bviolence against women\b', r'\bpatriarchy\b', r'\bequal remuneration\b'],
        'min_body_mentions': 15,
        'sim_threshold': 0.84
    },
    'healthcare': {
        'anchors': [
            '2019-03-30-make-health-a-fundamental-right',
            '2025-04-05-resolution-to-combat-drug-addiction-among-youngsters',
            '2026-07-20-perspective-action-agenda-on-health-issues'
        ],
        'heading_patterns': [r'\bhealth\b', r'\bhealthcare\b', r'\bmedical\b', r'\bhospital\b'],
        'body_terms': [r'\bpublic health\b', r'\bhealthcare\b', r'\bhospital\b', r'\bmedical care\b', r'\bdrug prices\b', r'\bhealth expenditure\b'],
        'min_body_mentions': 12,
        'sim_threshold': 0.83
    },
    'disability-lgbtq': {
        'anchors': [
            '2015-07-31-on-the-rights-of-persons-with-disabilities-bill-21congress',
            '2025-04-05-resolution-to-ensure-dignity-and-justice-for-the-disabled',
            '2025-04-05-resolution-to-ensure-equal-rights-and-dignity-for-lgbtqi-individuals'
        ],
        'heading_patterns': [r'\bdisabled\b', r'\bdisabilit', r'\blgbtq', r'\btransgender\b'],
        'body_terms': [r'\bdisability\b', r'\bdisabled persons?\b', r'\blgbtqi?\b', r'\btransgender\b', r'\baccessibility\b'],
        'min_body_mentions': 6,
        'sim_threshold': 0.83
    },
    'caste-social-justice': {
        'anchors': [
            '2009-08-08-resolution-adopted-at-the-convention-on-dalit-problems',
            '2009-08-08-on-tribal-question',
            '2017-04-18-defend-dalit-rights-modiwadi-manuwadi',
            '2025-04-04-resolution-to-conduct-general-census-including-caste-census-immediatel',
            '2025-04-05-resolution-to-extend-reservations-for-scs-sts-and-obcs-to-the-private-',
            '2026-07-20-the-annihilation-of-caste-a-marxist-perspective'
        ],
        'heading_patterns': [r'\bcaste\b', r'\bdalit\b', r'\badivasi\b', r'\btribal\b', r'\breservation\b', r'\bcensus\b'],
        'body_terms': [r'\bcaste census\b', r'\bannihilation of caste\b', r'\bdalit\b', r'\badivasi\b', r'\buntouchability\b', r'\bscheduled caste\b'],
        'min_body_mentions': 14,
        'sim_threshold': 0.84
    },
    'environment-climate': {
        'anchors': [
            '2025-04-05-resolution-against-the-deep-sea-mining-policy-of-government-of-india'
        ],
        'heading_patterns': [r'\benvironment\b', r'\bclimate\b', r'\becolog', r'\bforest\b'],
        'body_terms': [r'\bclimate change\b', r'\becological\b', r'\bforest rights\b', r'\bdeep sea mining\b', r'\benvironmental protection\b'],
        'min_body_mentions': 8,
        'sim_threshold': 0.83
    },
    'palestine': {
        'anchors': [
            '2022-04-08-resolution-on-solidarity-with-palestine',
            '2025-04-04-resolution-to-condemn-israels-genocidal-attacks-on-gaza'
        ],
        'heading_patterns': [r'\bpalestine\b', r'\bgaza\b', r'\bisrael\b'],
        'body_terms': [r'\bpalestine\b', r'\bgaza\b', r'\bzionis', r'\bapartheid state\b', r'\bceasefire\b'],
        'min_body_mentions': 6,
        'sim_threshold': 0.83
    }
}

def cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    return dot / (norm_a * norm_b + 1e-9)

def compute_topic_centroids(vectors_map: dict[str, list[float]], dim: int) -> dict[str, list[float]]:
    centroids = {}
    for topic, config in TOPIC_ANCHORS.items():
        anchors = config['anchors']
        valid_vecs = [vectors_map[s] for s in anchors if s in vectors_map]
        if not valid_vecs:
            continue
        c = [0.0] * dim
        for v in valid_vecs:
            for i in range(dim):
                c[i] += v[i]
        c = [val / len(valid_vecs) for val in c]
        centroids[topic] = c
    return centroids

def extract_headings(text: str) -> list[str]:
    """Extract all markdown headings level 1 to 3."""
    headings = re.findall(r'^#{1,3}\s+(.*)', text, re.MULTILINE)
    clean_headings = []
    for h in headings:
        # Strip bold/italics symbols
        h_clean = re.sub(r'[*_`#]', '', h).strip()
        if h_clean:
            clean_headings.append(h_clean)
    return clean_headings

def check_fortification(
    slug: str,
    title: str,
    body: str,
    vec: list[float] | None,
    centroids: dict[str, list[float]],
    current_topics: list[str]
) -> tuple[list[str], list[dict]]:
    new_topics = list(current_topics)
    diagnostics = []
    
    headings = extract_headings(body)
    b_lower = body.lower()
    
    for topic, config in TOPIC_ANCHORS.items():
        if topic in new_topics:
            continue # already tagged
            
        # 1. Check headings
        has_heading = False
        matched_h = None
        for h in headings:
            h_lower = h.lower()
            if any(re.search(pat, h_lower) for pat in config['heading_patterns']):
                has_heading = True
                matched_h = h
                break
                
        # 2. Check body term occurrences
        body_count = 0
        for pat in config['body_terms']:
            body_count += len(re.findall(pat, b_lower))
            
        # 3. Check vector similarity
        sim = 0.0
        if vec and topic in centroids:
            sim = cosine_similarity(vec, centroids[topic])
            
        threshold = config['sim_threshold']
        min_body = config['min_body_mentions']
        
        # Fortification Logic:
        # Either (Sim >= threshold AND (Heading Match OR Body Count >= min_body))
        # Or (Explicit Section Heading Match AND Body Count >= 3)
        qualifies = False
        reason = ""
        
        if has_heading and body_count >= 3:
            qualifies = True
            reason = f"Heading match ('{matched_h}') + {body_count} mentions (sim={sim:.3f})"
        elif sim >= threshold and body_count >= min_body:
            qualifies = True
            reason = f"Cosine similarity {sim:.3f} >= {threshold} + {body_count} mentions"
            
        if qualifies:
            new_topics.append(topic)
            diagnostics.append({
                'topic': topic,
                'sim': sim,
                'reason': reason
            })
            
    # Cap total topics at 5 most relevant to avoid badge bloat
    if len(new_topics) > 5:
        # Preserve original primary topics, truncate extras
        new_topics = new_topics[:5]
        
    return new_topics, diagnostics

def process_all_documents(dry_run: bool = False, sim_threshold_override: float | None = None):
    if not VECTORS_PATH.exists():
        print(f"[!] Vectors database not found at {VECTORS_PATH}. Please run scripts/embed.py first.")
        sys.exit(1)
        
    with open(VECTORS_PATH, 'r', encoding='utf-8') as f:
        vdata = json.load(f)
        
    dim = vdata.get('dim', 256)
    vectors_map = {d['slug']: d['vector'] for d in vdata.get('documents', [])}
    print(f"[*] Loaded {len(vectors_map)} document vectors (dim={dim}) from {VECTORS_PATH}")
    
    centroids = compute_topic_centroids(vectors_map, dim)
    print(f"[*] Computed semantic centroids for {len(centroids)} target topics.")
    
    doc_files = sorted(DOCUMENTS_DIR.glob('*.md'))
    print(f"[*] Scanning {len(doc_files)} markdown documents...")
    
    fortified_count = 0
    slug_to_updated_topics = {}
    
    for df in doc_files:
        with open(df, 'r', encoding='utf-8') as f:
            content = f.read()
            
        match = re.search(r'^---\s*\n(.*?)\n---', content, re.DOTALL)
        if not match:
            continue
            
        body = content[match.end():]
        meta = yaml.safe_load(match.group(1)) or {}
        slug = meta.get('slug', df.stem)
        title = meta.get('title', '')
        current_topics = meta.get('topics', [])
        
        vec = vectors_map.get(slug)
        new_topics, diags = check_fortification(
            slug=slug,
            title=title,
            body=body,
            vec=vec,
            centroids=centroids,
            current_topics=current_topics
        )
        
        if len(new_topics) > len(current_topics):
            fortified_count += 1
            slug_to_updated_topics[slug] = new_topics
            added = [t for t in new_topics if t not in current_topics]
            print(f"\n+ Fortified '{title}'")
            print(f"  Added Topics: {', '.join(added)}")
            for d in diags:
                print(f"    • {d['topic']}: {d['reason']}")
                
            if not dry_run:
                meta['topics'] = new_topics
                new_yaml = yaml.dump(meta, sort_keys=False, allow_unicode=True).strip()
                new_content = f"---\n{new_yaml}\n---{body}"
                with open(df, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                    
    print(f"\n[*] Fortified {fortified_count} documents with cross-cutting topics.")
    
    # Propagate to translations
    trans_files = list(TRANSLATIONS_DIR.glob('*/*.md'))
    trans_updated = 0
    for tf in trans_files:
        with open(tf, 'r', encoding='utf-8') as f:
            content = f.read()
        match = re.search(r'^---\s*\n(.*?)\n---', content, re.DOTALL)
        if not match:
            continue
        body = content[match.end():]
        meta = yaml.safe_load(match.group(1)) or {}
        slug = meta.get('slug')
        if slug in slug_to_updated_topics:
            meta['topics'] = slug_to_updated_topics[slug]
            if not dry_run:
                new_yaml = yaml.dump(meta, sort_keys=False, allow_unicode=True).strip()
                new_content = f"---\n{new_yaml}\n---{body}"
                with open(tf, 'w', encoding='utf-8') as f:
                    f.write(new_content)
            trans_updated += 1
            
    print(f"[*] Propagated fortified topics to {trans_updated} regional translation documents.")
    if dry_run:
        print("\n[!] Dry run complete. No files were modified.")
    else:
        print("\n[+] Fortification complete. All documents and translations are synchronized.")

def main():
    parser = argparse.ArgumentParser(description="Fortify document topics using vector cosine similarity & headings.")
    parser.add_argument('--dry-run', action='store_true', help="Preview tag additions without modifying files")
    parser.add_argument('--threshold', type=float, default=None, help="Cosine similarity threshold override")
    args = parser.parse_args()
    
    process_all_documents(dry_run=args.dry_run, sim_threshold_override=args.threshold)

if __name__ == '__main__':
    main()
