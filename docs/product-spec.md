# Product Spec — Korean Vocab Primer

## One-Liner
Learn vocab from YouTube videos you already watch, then re-watch and experience recognition in context.

## Core Insight
The user is already watching Korean content (K-dramas, YouTube, K-pop) and absorbing pronunciation, sentence rhythm, and contextual meaning. The bottleneck is vocabulary density — she doesn't know enough words for comprehensible input to click. This app closes that gap by front-loading vocab from content she's already going to re-watch.

## Core Loop
1. Paste/share YouTube URL → app extracts Korean vocab
2. Study tinder-style flashcards (15-20 highest-value words)
3. Re-watch the video
4. Experience recognition — hear words you just studied
5. Dopamine hit → retention spikes → repeat

This is **proactive vocab priming**, not reactive lookup. The user learns words BEFORE encountering them, so the recognition moment happens naturally during viewing.

---

## Target User
- Someone who already watches Korean content regularly
- Understands some Korean through context/immersion but wants to accelerate vocab acquisition
- Not a total beginner — has exposure to Korean sounds and sentence patterns
- Specifically: the developer's girlfriend, expanding to K-drama/K-pop fans who want to understand what they're watching

## Platform
- iOS and Android (Expo managed workflow, both from day one)

## Auth Model
- No auth. Device-local storage only. No accounts, no sign-up, no login.

## Language Scope
- Korean only for MVP
- Architecture supports adding other languages later (abstract NLP layer behind a language interface)

---

## Screens

### Screen 1: Home
**Tab: Home (bottom tab 1 of 2)**

- **Top bar**: "Add" button (top-right) to add a new video
- **Stats bar**: Total words learned, current streak (days), vocab coverage % ("You know 340 of the top 1500 Korean words")
- **Main content**: Scrollable list of saved videos
  - Each row: thumbnail, title, progress badge ("8/18 words learned"), date added
- **Interactions**:
  - Tap video → navigates to Video Vocab Deck
  - Tap "Add" → navigates to Add Video
  - Swipe left on video → delete with confirmation
- **Empty state**: "Add your first YouTube video to start learning"

### Screen 2: Add Video
**Push screen from Home**

Three entry points all land here:
1. **Paste URL**: Text field with paste button, validates YouTube URL format
2. **Share sheet**: User is in YouTube app → taps Share → selects this app → deep links here with URL pre-filled
3. **In-app YouTube search**: v2 (not MVP)

**Flow after URL submitted**:
1. Show loading state ("Extracting vocab...")
2. Server fetches transcript → tokenizes → returns vocab JSON
3. App stores video + vocab locally in SQLite
4. Auto-navigates to Video Vocab Deck

**Error states**:
- No Korean subtitles → "This video doesn't have Korean subtitles"
- No network → "You need internet to add a video. Studying saved videos works offline."
- Server cold start → longer spinner (2-3s), no special UI needed

### Screen 3: Video Vocab Deck
**Push screen from Home (dynamic route: /video/[id])**

- **Header**: Video thumbnail + title (tappable → opens YouTube)
- **Progress ring**: "12/18 words learned"
- **Word list**: Scrollable list showing:
  - Korean word
  - POS tag (noun/verb/adj)
  - Difficulty tier dot (color-coded)
  - Learned/unlearned status (checkmark or empty)
- **"Study" button**: Prominent, starts flashcard session

### Screen 4: Flashcard Study
**Push/modal from Video Vocab Deck (route: /study/[id])**

**Layout**:
- Card stack — one card visible at a time, centered
- **Front**: Korean word (large), POS label (small), difficulty tier indicator
- **Tap card** → flips to back: English translation(s) + Korean sentence from transcript where the word appeared
- **Swipe right** → "I know this" → green flash
- **Swipe left** → "Don't know" → red/orange flash
- **Progress bar** at top: "7/18"

**Card behavior**:
- Cards swiped left (don't know) recycle to end of deck within same session
- If swiped left on same card twice → stays marked "unlearned", session moves on (no infinite loop)

**After all cards — Session Summary**:
- "You learned 11 new words! 7 to review next time."
- **"Watch the video" CTA** → opens YouTube app via deep link
- "Back to deck" / "Back to home"

### Screen 5: Progress
**Tab: Progress (bottom tab 2 of 2)**

- **Total words learned** (big number, prominent)
- **Vocab coverage bar**: "You know X% of the top 1500 Korean words" — the killer metric
- **Words by difficulty tier**: Simple bar chart (Tier 1-4)
- **Words by POS**: Breakdown of nouns/verbs/adjectives learned
- **Streak**: Consecutive days with at least one study session
- **Recent activity**: Last 7 days, words learned per day

---

## Navigation
- Bottom tab bar: 2 tabs (Home, Progress)
- Add Video: push screen from Home (triggered by "Add" button top-right)
- Video Vocab Deck: push screen from Home (triggered by tapping a video)
- Flashcard Study: push/modal from Video Vocab Deck

---

## Flashcard Deck Logic

### Auto-limit: 15-20 words per video

**Priority ranking for which words make the deck**:
1. Words the user has NOT learned yet across ANY video (new words first)
2. Higher frequency in this specific video (word appears 5x > word appears 1x)
3. Nouns and verbs prioritized over adverbs and adjectives (more useful for comprehension)

**Exclusions**:
- Words already marked "known" from previous videos are excluded automatically
- Words not found in KENGDIC dictionary are excluded entirely (no card created)
- Common particles and grammatical words filtered out server-side (은/는/이/가/을/를)
- Single-character morphemes filtered out
- Proper nouns (NNP tag) filtered out

**Cross-video deduplication**:
- The `words` table is global — same word across videos is one row
- Learning a word in Video A automatically reflects in Video B's deck
- A word learned anywhere never appears as "new" in any future video

---

## Flashcard Display

**Front (Korean side)**:
- Korean word in large text (e.g., 사랑)
- POS label small below (noun)
- Difficulty tier color indicator

**Back (English side)**:
- English translation(s) from KENGDIC (e.g., "love; affection")
- Korean sentence from the video transcript where the word appeared
- (No audio pronunciation for MVP — she hears it in the video)

**Card direction**: Recognition only (see Korean → guess English). Production (see English → recall Korean) is v2.

---

## Data Model (expo-sqlite, device-local)

```sql
videos (id, youtube_id UNIQUE, title, thumbnail_url, added_at)
words (id, korean, dictionary_form, english, pos, difficulty_tier, language, UNIQUE(dictionary_form, pos))
video_words (video_id FK, word_id FK, frequency_in_video, sentence_context, PK(video_id, word_id))
user_words (word_id PK FK, status [unseen|known|unknown], learned_at, times_seen)
```

---

## Server (FastAPI on Fly.io)

**Single endpoint**: `POST /extract`
- Input: YouTube URL + optional max_words + optional exclude list
- Output: Structured vocab JSON (word, dictionary_form, english, pos, tier, frequency, sentence_context)
- Stateless — no user data stored server-side

**Pipeline**:
1. Fetch Korean transcript via `youtube-transcript-api` (Python)
2. Tokenize with Mecab-ko (morphological analysis)
3. Filter by POS (nouns, verbs, adjectives, adverbs only)
4. Convert to dictionary form (verb stems → append 다)
5. Lookup translations in KENGDIC (~90K entries, in-memory hashmap)
6. Assign difficulty tier from Korean word frequency list
7. Skip words not found in KENGDIC
8. Sort by frequency in video, return top N

**Health check**: `GET /health` (also used to keep Fly.io warm)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend framework | Expo (managed workflow), TypeScript |
| Navigation | Expo Router (file-based) |
| Local database | expo-sqlite |
| Swipe gestures | react-native-gesture-handler + react-native-reanimated |
| Deep linking / share sheet | expo-linking |
| Backend | FastAPI (Python) |
| Korean tokenizer | Mecab-ko (mecab-python3 + mecab-ko-dic) |
| Dictionary | KENGDIC (open-source Korean-English, ~90K entries) |
| Word frequency | National Institute of Korean Language frequency list |
| Hosting | Fly.io free tier |

---

## What's NOT in MVP
- SRS / spaced repetition scheduling (just simple known/unknown for now)
- Audio pronunciation on cards
- User accounts / cloud sync
- In-app YouTube browsing/search
- Sentence context with video timestamps (just the sentence text)
- Production-mode flashcards (English front → Korean back)
- Multiple language support (architecture ready, not implemented)
- Onboarding / tutorial screens

## v2 Features (Post-MVP)
- SRS with proper interval scheduling
- In-app YouTube search
- Sentence timestamps (tap to jump to that moment in the video)
- Production-mode cards (English → Korean)
- User level selection (beginner/intermediate/advanced filtering)
- Export learned words to Anki
- Netflix subtitle support (if technically feasible)
- Optional cloud sync with simple auth