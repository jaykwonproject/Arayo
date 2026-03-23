---
name: korean-nlp
description: Korean NLP domain knowledge including Mecab tokenization, KENGDIC dictionary lookups, Korean morphological analysis, POS tagging, and frequency-based difficulty tiers. Use when working on the server-side extraction pipeline, word processing logic, or anything related to Korean language processing.
---

# Korean NLP for Vocab Extraction

## Overview
The server pipeline: YouTube transcript → Mecab tokenization → POS filtering → dictionary form extraction → KENGDIC lookup → frequency tier assignment → JSON response.

## Mecab-ko
Mecab is a C-based morphological analyzer. The Python wrapper (`mecab-python3` with `mecab-ko-dic`) handles Korean tokenization.

### What Mecab Does
Korean is agglutinative. Example:
- Input: `먹었는데` (but [I] ate)
- Mecab output: `먹/VV + 었/EP + 는데/EC`
- Dictionary form: `먹다` (to eat)
- POS: VV (verb)

### POS Tags We Care About
| Mecab Tag | Meaning | Include? |
|-----------|---------|----------|
| NNG | General noun | Yes |
| NNP | Proper noun | No (names, places) |
| VV | Verb | Yes |
| VA | Adjective | Yes |
| MAG | General adverb | Yes |
| NNB | Dependent noun | No |
| XSV | Verb suffix | No |
| JK* | Particles | No (은/는/이/가/을/를) |
| E* | Endings | No |

### Important: Dictionary Form Conversion
Mecab gives morphemes, not dictionary forms directly. For verbs and adjectives:
- Verb stem `먹` → dictionary form `먹다` (append 다)
- Adjective stem `예쁘` → dictionary form `예쁘다` (append 다)
- Nouns are already in dictionary form

## KENGDIC
Open-source Korean-English dictionary (~90K entries).
- Format: TSV with columns for Korean, English, POS, etc.
- Load into memory as a hashmap keyed by dictionary_form + POS
- If a word is not in KENGDIC, **skip it entirely** — do not create a flashcard

## Frequency-Based Difficulty Tiers
Use the National Institute of Korean Language frequency data.

| Tier | Word Rank | Rough TOPIK Level | Label |
|------|-----------|-------------------|-------|
| 1 | 1-500 | Beginner (1-2) | Essential |
| 2 | 501-1500 | Intermediate (3-4) | Common |
| 3 | 1501-3000 | Upper-intermediate (5) | Useful |
| 4 | 3000+ | Advanced (6+) | Advanced |

If a word is not in the frequency list, default to Tier 4.

## Server Response Format
```json
{
  "youtube_id": "dQw4w9WgXcQ",
  "title": "Video Title",
  "thumbnail_url": "https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
  "words": [
    {
      "korean": "사랑",
      "dictionary_form": "사랑",
      "english": "love",
      "pos": "noun",
      "difficulty_tier": 1,
      "frequency_in_video": 5,
      "sentence_context": "사랑은 언제나 아름답다"
    }
  ],
  "total_words_extracted": 87,
  "words_with_translations": 62,
  "words_returned": 20
}
```

## Common Pitfalls
- Don't tokenize punctuation or numbers as words
- Filter out single-character morphemes (particles, suffixes)
- Handle compound nouns: Mecab may split `한국어` into `한국` + `어` — prefer the compound if it exists in KENGDIC
- Auto-generated YouTube subtitles may have spacing errors — Mecab handles this reasonably well but expect some noise
