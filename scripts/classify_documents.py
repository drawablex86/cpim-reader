#!/usr/bin/env python3
"""
scripts/classify_documents.py

Faceted Archival Classification Pipeline for cpim-reader.
Deterministic-first classifier that analyzes:
1. Canonical Document Titles
2. Formal Congress Body Headings (e.g. '### Resolution', 'Report on Political Developments')
3. Topic Salience Keyword Frequencies
4. Geographic & Organisational Milestones

Updates frontmatter of src/content/documents/*.md and propagates to src/content/translations/*/*.md.
Supports --dry-run to preview assignments without modifying files.
"""

import argparse
import glob
import os
import re
import yaml
from pathlib import Path

# Controlled Taxonomy Definitions
VALID_DOC_TYPES = [
    'resolution',
    'report',
    'review',
    'manifesto',
    'speech',
    'campaign',
    'publication',
    'policy-programme',
    'legal',
    'solidarity'
]

TOPIC_RULES = {
    'palestine': {
        'title': [r'\bpalestine\b', r'\bgaza\b', r'\bisrael\b', r'\bzionis'],
        'body': [r'\bpalestine\b', r'\bgaza\b', r'\bzionis', r'apartheid state']
    },
    'labour-workers': {
        'title': [r'labour', r'worker', r'strike', r'trade union', r'unemployment', r'jobs', r'wages'],
        'body': [r'trade union', r'labour code', r'minimum wage', r'general strike', r'working class', r'unemployment', r'unorganised worker']
    },
    'agriculture-farmers': {
        'title': [r'kisan', r'farmer', r'agricultural', r'rural worker', r'msp', r'farming', r'crop'],
        'body': [r'\bkisan\b', r'\bfarmers?\b', r'agricultural workers?', r'\bmsp\b', r'swaminathan', r'land acquisition', r'rural indebted']
    },
    'communalism-secularism': {
        'title': [r'communal', r'\brss\b', r'\bbjp\b', r'sangh parivar', r'hindutva', r'waqf', r'secularism', r'polarisation', r'minorities'],
        'body': [r'communalism', r'secularism', r'sangh parivar', r'hindutva', r'minorities', r'communal violence', r'places of worship']
    },
    'caste-social-justice': {
        'title': [r'caste', r'dalit', r'adivasi', r'tribal', r'reservation', r'census', r'untouchability', r'scs, sts and obcs'],
        'body': [r'caste census', r'annihilation of caste', r'dalit', r'adivasi', r'untouchability', r'scheduled caste', r'social oppression', r'atrocities on dalit']
    },
    'gender-womens-rights': {
        'title': [r'women', r'gender', r'violence on women', r'crimes against women'],
        'body': [r"women's rights", r'crimes against women', r'patriarchy', r'equal remuneration', r'violence against women', r'women reservation']
    },
    'economy-public-sector': {
        'title': [r'budget', r'privatisation', r'public sector', r'lic', r'electricity', r'adani', r'tariff', r'monetisation', r'inflation', r'price hike', r'economic'],
        'body': [r'privatisation', r'disinvestment', r'public sector', r'fiscal deficit', r'corporates', r'neoliberal', r'price rise', r'loot of public asset']
    },
    'elections-democracy': {
        'title': [r'election', r'lok sabha', r'delimitation', r'one nation', r'voter', r'evm', r'assembly election', r'electoral'],
        'body': [r'election commission', r'electoral reform', r'assembly election', r'general election', r'delimitation', r'electoral bonds']
    },
    'education-students': {
        'title': [r'education', r'ugc', r'student', r'youth', r'university', r'school'],
        'body': [r'higher education', r'nep', r'national education policy', r'ugc', r'student community', r'commercialisation of education']
    },
    'healthcare': {
        'title': [r'health', r'drug addiction', r'medical', r'hospital'],
        'body': [r'public health', r'healthcare system', r'out-of-pocket', r'health expenditure', r'right to health']
    },
    'anti-imperialism': {
        'title': [r'imperialism', r'cuba', r'us imperialist', r'tariff war', r'nuclear', r'foreign policy', r'imperialist'],
        'body': [r'imperialism', r'us imperialism', r'solidarity with socialist', r'anti-imperialist', r'nato', r'foreign policy']
    },
    'federalism-states': {
        'title': [r'federalism', r'manipur', r'kashmir', r'statehood', r'left democratic front', r'tripura', r'west bengal', r'centre-state', r'governor'],
        'body': [r'federalism', r'centre-state relations', r'governor', r'finance commission', r'state rights', r'fiscal federalism']
    },
    'environment-climate': {
        'title': [r'environment', r'climate', r'deep sea mining', r'ecology', r'forest rights'],
        'body': [r'climate change', r'ecological', r'forest conservation', r'deep sea mining', r'pollution']
    },
    'disability-lgbtq': {
        'title': [r'disabled', r'disability', r'lgbtq', r'lgbtqi'],
        'body': [r'persons with disabilities', r'disability rights', r'lgbtqi', r'equal rights and dignity']
    }
}

GEO_RULES = {
    'palestine': [r'\bpalestine\b', r'\bgaza\b', r'\bwest bank\b'],
    'kerala': [r'\bkerala\b', r'left democratic front', r'\bldf\b'],
    'west-bengal': [r'west bengal', r'bengal', r'left front govt'],
    'tripura': [r'\btripura\b'],
    'jammu-kashmir': [r'jammu & kashmir', r'jammu and kashmir', r'\bkashmir\b'],
    'manipur': [r'\bmanipur\b'],
    'andhra-pradesh': [r'andhra pradesh'],
    'telangana': [r'\btelangana\b'],
    'cuba': [r'\bcuba\b'],
    'international': [r'fraternal parties', r'imperialism', r'latin america', r'gaza', r'palestine', r'israel', r'cuba', r'tariff war']
}

def determine_doc_type(title: str, body: str) -> str:
    t_lower = title.lower()
    b_first_1200 = body[:1200].lower()
    combined = t_lower + ' ' + b_first_1200

    # 1. High priority title/body exact keywords
    if 'manifesto' in t_lower:
        return 'manifesto'
    if any(k in t_lower for k in ['writ petition', 'application in', 'intervening application']):
        return 'legal'
    if any(k in t_lower for k in ['disclosure on candidates']):
        return 'publication'
    if any(k in t_lower for k in ['speech by comrade', 'inaugural speech', 'presidential address', 'welcome speech', 'speech by']):
        return 'speech'
    if any(k in t_lower for k in ['greetings from', 'messages of greetings', 'fraternal parties']):
        return 'solidarity'
    if any(k in t_lower for k in ['review of', 'election review', 'review of the', 'review of assembly']):
        return 'review'
    if any(k in t_lower for k in ['annihilation of caste', 'booklet', 'pamphlet', 'perspective & action']):
        return 'publication'
    if any(k in t_lower for k in ['charter for', 'programme of', 'tasks on', 'work on the']):
        return 'policy-programme'
    if any(t_lower.startswith(prefix) for prefix in ['stop ', 'resist ', 'save ', 'jobs, not jumlas', 'teen saal', 'four years of modi']):
        return 'campaign'
    
    # Check for resolution in title or first lines of body
    if 'resolution' in t_lower or '# _resolution_' in b_first_1200 or 'resolution adopted' in b_first_1200:
        return 'resolution'
    
    # Reports
    if any(k in t_lower for k in ['report on', 'c.c. report', 'cc report', 'report of', 'report –', 'report -', 'political report']):
        return 'report'
    
    # Fallback checks on body
    if 'the resolution was adopted' in b_first_1200 or 'resolution on' in b_first_1200:
        return 'resolution'
    if 'report on political developments' in b_first_1200 or 'central committee report' in b_first_1200:
        return 'report'
    
    return 'report'

def determine_period(title: str, date_str: str, body: str) -> str:
    combined = (title + ' ' + body[:1200]).lower()
    
    # Congress pattern
    m = re.search(r'(\d+)(?:st|nd|rd|th)?\s+(?:cpi-m\s+|cpi\s*\(m\)\s+)?(?:party\s+)?congress', combined)
    if m:
        num = m.group(1)
        return f"{num}th-congress"
    
    # Election pattern
    if 'lok sabha' in combined or 'election manifesto' in combined:
        m_year = re.search(r'(19\d\d|20\d\d)', title)
        if m_year:
            return f"{m_year.group(1)}-elections"
        # Try from date
        if date_str and len(date_str) >= 4:
            year = date_str[:4]
            if year in ['2009', '2014', '2019', '2024']:
                return f"{year}-elections"
    
    # Derive from publication year if it falls in known Congress year
    if date_str:
        year = date_str[:4]
        if year in ['2025', '2026'] and ('cc report' in combined or 'party congress' in combined):
            return '24th-congress'
        elif year in ['2022', '2023', '2024'] and ('cc report' in combined or 'party congress' in combined):
            return '23rd-congress'
        elif year in ['2018', '2019', '2020', '2021'] and ('cc report' in combined or 'party congress' in combined):
            return '22nd-congress'
        elif year in ['2015', '2016', '2017'] and ('cc report' in combined or 'party congress' in combined):
            return '21st-congress'
        elif year in ['2012', '2013', '2014'] and ('cc report' in combined or 'party congress' in combined):
            return '20th-congress'
        elif year in ['2008', '2009', '2010', '2011'] and ('cc report' in combined or 'party congress' in combined):
            return '19th-congress'
            
    return 'national-current'

def determine_geo(title: str, body: str) -> list[str]:
    t_lower = title.lower()
    b_intro = body[:1500].lower()
    
    geos = []
    for geo_key, patterns in GEO_RULES.items():
        if geo_key in ['national', 'international']:
            continue
        if any(re.search(p, t_lower) for p in patterns) or any(re.search(p, b_intro) for p in patterns):
            geos.append(geo_key)
            
    # International check
    if any(k in geos for k in ['palestine', 'cuba']) or any(re.search(p, t_lower) for p in GEO_RULES['international']):
        if 'international' not in geos:
            geos.append('international')
            
    if not geos:
        geos.append('national')
    elif 'international' not in geos and 'national' not in geos:
        geos.append('national')
        
    return geos

def score_topics(title: str, body: str) -> list[str]:
    t_lower = title.lower()
    b_lower = body.lower()
    
    scores = {}
    for topic, rules in TOPIC_RULES.items():
        score = 0
        # Title matches carry heavyweight priority (10 pts)
        for pat in rules['title']:
            if re.search(pat, t_lower):
                score += 10
                
        # Body occurrences
        body_count = 0
        for pat in rules['body']:
            body_count += len(re.findall(pat, b_lower))
            
        if body_count >= 10:
            score += 5
        elif body_count >= 4:
            score += 3
        elif body_count >= 2:
            score += 1
            
        if score > 0:
            scores[topic] = score
            
    # Sort topics by score descending
    sorted_topics = sorted(scores.items(), key=lambda x: -x[1])
    
    # Top 1 to 4 topics that have score >= 3 (or at least score > 0 if very short)
    selected = [t for t, s in sorted_topics if s >= 3][:4]
    if not selected and sorted_topics:
        selected = [sorted_topics[0][0]]
        
    # If still empty, default to general topic
    if not selected:
        selected = ['communalism-secularism', 'economy-public-sector']
        
    return selected

def process_file(file_path: Path, dry_run: bool = False):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    match = re.search(r'^---\s*\n(.*?)\n---', content, re.DOTALL)
    if not match:
        return None

    raw_yaml = match.group(1)
    body = content[match.end():]
    meta = yaml.safe_load(raw_yaml) or {}

    title = meta.get('title', '')
    date_str = str(meta.get('date', ''))
    slug = meta.get('slug', file_path.stem)

    doc_type = determine_doc_type(title, body)
    period = determine_period(title, date_str, body)
    geo = determine_geo(title, body)
    topics = score_topics(title, body)

    meta['doc_type'] = doc_type
    meta['topics'] = topics
    meta['geo'] = geo
    meta['period'] = period

    if not dry_run:
        new_yaml = yaml.dump(meta, sort_keys=False, allow_unicode=True).strip()
        new_content = f"---\n{new_yaml}\n---{body}"
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)

    return {
        'slug': slug,
        'title': title,
        'doc_type': doc_type,
        'topics': topics,
        'geo': geo,
        'period': period
    }

def propagate_translations(classified_map: dict, translations_dir: Path, dry_run: bool = False):
    trans_files = list(translations_dir.glob('*/*.md'))
    updated = 0
    for tf in trans_files:
        with open(tf, 'r', encoding='utf-8') as f:
            content = f.read()
        match = re.search(r'^---\s*\n(.*?)\n---', content, re.DOTALL)
        if not match:
            continue
        body = content[match.end():]
        meta = yaml.safe_load(match.group(1)) or {}
        slug = meta.get('slug', '')
        if slug in classified_map:
            c = classified_map[slug]
            meta['doc_type'] = c['doc_type']
            meta['topics'] = c['topics']
            meta['geo'] = c['geo']
            meta['period'] = c['period']
            if not dry_run:
                new_yaml = yaml.dump(meta, sort_keys=False, allow_unicode=True).strip()
                new_content = f"---\n{new_yaml}\n---{body}"
                with open(tf, 'w', encoding='utf-8') as f:
                    f.write(new_content)
            updated += 1
    return updated

def main():
    parser = argparse.ArgumentParser(description="Classify documents and inject faceted metadata.")
    parser.add_argument('--dry-run', action='store_true', help="Run without modifying files")
    parser.add_argument('--sample', type=int, default=0, help="Print N sample classifications")
    args = parser.parse_args()

    project_root = Path(__file__).resolve().parent.parent
    docs_dir = project_root / 'src' / 'content' / 'documents'
    trans_dir = project_root / 'src' / 'content' / 'translations'

    doc_files = sorted(docs_dir.glob('*.md'))
    print(f"[*] Found {len(doc_files)} master documents in {docs_dir}")

    classified_map = {}
    type_counts = {}
    topic_counts = {}

    for df in doc_files:
        res = process_file(df, dry_run=args.dry_run)
        if res:
            classified_map[res['slug']] = res
            t = res['doc_type']
            type_counts[t] = type_counts.get(t, 0) + 1
            for top in res['topics']:
                topic_counts[top] = topic_counts.get(top, 0) + 1

    print("\n--- Document Type Distribution ---")
    for t, c in sorted(type_counts.items(), key=lambda x: -x[1]):
        print(f"  {t:<18}: {c}")

    print("\n--- Topic Distribution ---")
    for top, c in sorted(topic_counts.items(), key=lambda x: -x[1]):
        print(f"  {top:<25}: {c}")

    trans_updated = propagate_translations(classified_map, trans_dir, dry_run=args.dry_run)
    print(f"\n[*] Propagated faceted metadata to {trans_updated} regional translation files.")

    if args.sample > 0 or args.dry_run:
        print("\n--- Sample Classifications ---")
        for res in list(classified_map.values())[:max(5, args.sample)]:
            print(f"Title   : {res['title']}")
            print(f"Type    : {res['doc_type']}")
            print(f"Topics  : {', '.join(res['topics'])}")
            print(f"Geo     : {', '.join(res['geo'])}")
            print(f"Period  : {res['period']}")
            print("-" * 50)

    if args.dry_run:
        print("\n[!] Dry run complete. No files were modified.")
    else:
        print("\n[+] Successfully classified and updated all documents & translations.")

if __name__ == '__main__':
    main()
