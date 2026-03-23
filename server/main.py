import csv
import os
import re
import time
from pathlib import Path
from typing import Optional

import MeCab
import mecab_ko_dic
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from youtube_transcript_api import YouTubeTranscriptApi

app = FastAPI(title="Korean Vocab Primer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Models ---


class ExtractRequest(BaseModel):
    youtube_url: str
    max_words: int = 20
    exclude_dictionary_forms: list[str] = []


class ExtractedWord(BaseModel):
    korean: str
    dictionary_form: str
    english: str
    pos: str
    difficulty_tier: int
    frequency_in_video: int
    sentence_context: str


class ExtractMeta(BaseModel):
    total_morphemes: int
    unique_words: int
    words_with_translations: int
    words_returned: int
    processing_time_ms: int


class ExtractResponse(BaseModel):
    youtube_id: str
    title: str
    thumbnail_url: str
    words: list[ExtractedWord]
    meta: ExtractMeta


class HealthResponse(BaseModel):
    status: str
    mecab: bool
    dictionary_size: int


# --- Globals ---

dictionary: dict[str, str] = {}
frequency_ranks: dict[str, int] = {}
mecab_tagger: Optional[MeCab.Tagger] = None

# POS tag mapping: Mecab-ko tags -> our categories
POS_MAP = {
    "NNG": "noun",     # General noun
    "NNP": None,       # Proper noun (excluded)
    "NNB": None,       # Dependent noun (excluded)
    "VV": "verb",      # Verb
    "VA": "adjective", # Adjective
    "MAG": "adverb",   # General adverb
}

# Common particles/endings to exclude
EXCLUDED_POS_PREFIXES = {"J", "E", "XS", "XP", "SF", "SP", "SS", "SE", "SO", "SW", "SL", "SH", "SN", "NR"}


def load_dictionary():
    """Load KENGDIC CSV into memory."""
    global dictionary
    dict_path = Path(__file__).parent / "data" / "kengdic.tsv"
    if not dict_path.exists():
        print(f"WARNING: Dictionary not found at {dict_path}")
        return

    with open(dict_path, "r", encoding="utf-8") as f:
        reader = csv.reader(f, delimiter="\t")
        header = next(reader, None)
        for row in reader:
            if len(row) >= 2:
                korean_word = row[0].strip()
                english_def = row[1].strip()
                if korean_word and english_def:
                    dictionary[korean_word] = english_def


def load_frequency_list():
    """Load Korean word frequency rankings."""
    global frequency_ranks
    freq_path = Path(__file__).parent / "data" / "frequency.tsv"
    if not freq_path.exists():
        print(f"WARNING: Frequency list not found at {freq_path}")
        return

    with open(freq_path, "r", encoding="utf-8") as f:
        reader = csv.reader(f, delimiter="\t")
        header = next(reader, None)  # skip header row
        for row in reader:
            if len(row) >= 3:
                rank = int(row[0].strip())
                word = row[1].strip()
                if word:
                    frequency_ranks[word] = rank


def init_mecab():
    """Initialize MeCab tagger with mecab-ko-dic (Korean dictionary)."""
    global mecab_tagger
    try:
        mecab_tagger = MeCab.Tagger(mecab_ko_dic.MECAB_ARGS)
        mecab_tagger.parse("테스트")
        print("MeCab initialized successfully with mecab-ko-dic")
    except Exception as e:
        print(f"MeCab initialization error: {e}")
        mecab_tagger = None


def get_difficulty_tier(dictionary_form: str) -> int:
    """Assign difficulty tier based on frequency rank."""
    rank = frequency_ranks.get(dictionary_form, 99999)
    if rank <= 500:
        return 1
    elif rank <= 1500:
        return 2
    elif rank <= 3000:
        return 3
    else:
        return 4


def extract_youtube_id(url: str) -> str:
    """Extract video ID from various YouTube URL formats."""
    patterns = [
        r"(?:v=|/v/|youtu\.be/)([a-zA-Z0-9_-]{11})",
        r"(?:embed/)([a-zA-Z0-9_-]{11})",
        r"(?:shorts/)([a-zA-Z0-9_-]{11})",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    raise ValueError("Could not extract YouTube video ID")


def tokenize_text(text: str) -> list[dict]:
    """Tokenize Korean text using MeCab and return morpheme info."""
    if not mecab_tagger:
        return []

    result = mecab_tagger.parse(text)
    morphemes = []

    for line in result.split("\n"):
        if line == "EOS" or line == "" or "\t" not in line:
            continue

        parts = line.split("\t")
        if len(parts) < 2:
            continue

        surface = parts[0]
        features = parts[1].split(",")

        if len(features) < 1:
            continue

        pos_tag = features[0]

        # Skip excluded POS types
        skip = False
        for prefix in EXCLUDED_POS_PREFIXES:
            if pos_tag.startswith(prefix):
                skip = True
                break
        if skip:
            continue

        # Map to our POS categories
        our_pos = POS_MAP.get(pos_tag)
        if our_pos is None:
            continue

        # Skip single characters
        if len(surface) <= 1:
            continue

        # Get dictionary form from mecab-ko-dic
        # Format: POS,*,final_jamo,reading,type,*,*,compound_info
        # features[3] = reading/lemma for simple words
        dict_form = surface
        if len(features) >= 4 and features[3] != "*":
            dict_form = features[3]

        # For verbs and adjectives, ensure dictionary form ends with 다
        if our_pos in ("verb", "adjective") and not dict_form.endswith("다"):
            dict_form = dict_form + "다"

        morphemes.append({
            "surface": surface,
            "dictionary_form": dict_form,
            "pos": our_pos,
            "pos_tag": pos_tag,
        })

    return morphemes


@app.on_event("startup")
async def startup():
    load_dictionary()
    load_frequency_list()
    init_mecab()
    print(f"Dictionary loaded: {len(dictionary)} entries")
    print(f"Frequency list loaded: {len(frequency_ranks)} entries")


@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        mecab=mecab_tagger is not None,
        dictionary_size=len(dictionary),
    )


@app.post("/extract", response_model=ExtractResponse)
async def extract(request: ExtractRequest):
    start_time = time.time()

    # 1. Extract YouTube ID
    try:
        youtube_id = extract_youtube_id(request.youtube_url)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_url", "message": "Not a valid YouTube URL"},
        )

    # 2. Fetch transcript
    try:
        ytt_api = YouTubeTranscriptApi()
        transcript = ytt_api.fetch(youtube_id, languages=["ko"])
        segments = transcript.snippets
        full_text = " ".join(s.text for s in segments)
    except Exception as e:
        error_str = str(e)
        if "No transcripts" in error_str or "not found" in error_str.lower():
            raise HTTPException(
                status_code=404,
                detail={"error": "no_subtitles", "message": "This video does not have Korean subtitles"},
            )
        raise HTTPException(
            status_code=500,
            detail={"error": "processing_error", "message": f"Failed to fetch transcript: {error_str}"},
        )

    # 3. Tokenize
    if not mecab_tagger:
        raise HTTPException(
            status_code=500,
            detail={"error": "processing_error", "message": "MeCab tokenizer not available"},
        )

    morphemes = tokenize_text(full_text)
    total_morphemes = len(morphemes)

    # 4. Count word frequencies and find sentence context
    word_freq: dict[str, int] = {}
    word_context: dict[str, str] = {}
    word_info: dict[str, dict] = {}

    # Build sentence map from segments
    segment_texts = [s.text for s in segments]

    for morpheme in morphemes:
        dict_form = morpheme["dictionary_form"]
        word_freq[dict_form] = word_freq.get(dict_form, 0) + 1

        if dict_form not in word_info:
            word_info[dict_form] = morpheme

        # Find sentence context if we don't have one yet
        if dict_form not in word_context:
            for seg_text in segment_texts:
                if morpheme["surface"] in seg_text:
                    word_context[dict_form] = seg_text
                    break

    unique_words = len(word_freq)

    # 5. Filter: must be in dictionary, not in exclude list
    exclude_set = set(request.exclude_dictionary_forms)
    candidates = []

    for dict_form, freq in word_freq.items():
        if dict_form in exclude_set:
            continue
        if dict_form not in dictionary:
            continue

        info = word_info[dict_form]
        tier = get_difficulty_tier(dict_form)
        context = word_context.get(dict_form, "")

        candidates.append({
            "korean": info["surface"],
            "dictionary_form": dict_form,
            "english": dictionary[dict_form],
            "pos": info["pos"],
            "difficulty_tier": tier,
            "frequency_in_video": freq,
            "sentence_context": context,
        })

    words_with_translations = len(candidates)

    # 6. Sort by priority: frequency desc, nouns/verbs first, lower tier first
    pos_order = {"noun": 0, "verb": 1, "adjective": 2, "adverb": 3}
    candidates.sort(key=lambda w: (
        -w["frequency_in_video"],
        pos_order.get(w["pos"], 4),
        w["difficulty_tier"],
    ))

    # 7. Limit
    words = [ExtractedWord(**w) for w in candidates[:request.max_words]]

    # 8. Build response
    thumbnail_url = f"https://img.youtube.com/vi/{youtube_id}/mqdefault.jpg"
    processing_time = int((time.time() - start_time) * 1000)

    # Try to get title (best effort)
    title = f"YouTube Video ({youtube_id})"

    return ExtractResponse(
        youtube_id=youtube_id,
        title=title,
        thumbnail_url=thumbnail_url,
        words=words,
        meta=ExtractMeta(
            total_morphemes=total_morphemes,
            unique_words=unique_words,
            words_with_translations=words_with_translations,
            words_returned=len(words),
            processing_time_ms=processing_time,
        ),
    )
