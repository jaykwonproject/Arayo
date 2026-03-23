# Korean Vocab Primer

## What This Project Does
Mobile app (Expo/React Native) that extracts Korean vocabulary from YouTube videos so users can study flashcards BEFORE re-watching, creating a recognition-based learning loop.

Core loop: paste/share YouTube URL → extract vocab → study tinder-style flashcards → re-watch video → recognize words in context.

## Tech Stack
- **Frontend**: Expo (managed workflow), TypeScript, Expo Router, expo-sqlite
- **Backend**: FastAPI (Python), Mecab-ko for Korean tokenization, KENGDIC dictionary
- **Hosting**: Fly.io (backend), Expo (frontend builds)
- **No auth**: Device-local storage only, no user accounts

## Project Structure
- `app/` — Expo Router screens (file-based routing)
- `src/components/` — Reusable React Native components
- `src/hooks/` — Custom hooks
- `src/lib/database.ts` — expo-sqlite wrapper (all local DB operations)
- `src/lib/api.ts` — Server API client (single endpoint: POST /extract)
- `src/lib/vocab-engine.ts` — Deck filtering, priority logic, word deduplication
- `src/types/` — TypeScript type definitions
- `server/` — FastAPI backend (deployed separately to Fly.io)
- `docs/` — Product spec, architecture decisions, API contract

## Commands
- `npx expo start` — Start dev server
- `npx expo run:ios` — Run on iOS simulator
- `npx expo run:android` — Run on Android emulator
- `npm test` — Run tests (jest)
- `npx expo lint` — Lint

## Code Style & Rules
- TypeScript strict mode, no `any` — use `unknown` if truly needed
- Functional components only, no class components
- Use Expo SDK APIs over bare React Native when available
- All database access through `src/lib/database.ts` — no raw SQL in components
- All server communication through `src/lib/api.ts` — components never call fetch directly
- Prefer `const` over `let`, never use `var`
- Name files in kebab-case: `vocab-engine.ts`, not `vocabEngine.ts`
- Name components in PascalCase: `FlashCard.tsx`
- Name hooks with `use` prefix: `useVocabDeck.ts`

## Architecture Constraints
- Frontend NEVER talks to the database directly from components — always through the lib layer
- Server is stateless — no user data stored server-side, it only processes YouTube URLs and returns vocab JSON
- All user data (learned words, video history, progress) lives in expo-sqlite on device
- Words table is global — same word across videos is one row, deduped by dictionary_form
- The `user_words` table tracks personal learning status per word

## Database Schema (expo-sqlite)
```sql
-- Videos the user has added
CREATE TABLE videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  youtube_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  thumbnail_url TEXT,
  added_at TEXT DEFAULT (datetime('now'))
);

-- Global word dictionary (deduplicated)
CREATE TABLE words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  korean TEXT NOT NULL,
  dictionary_form TEXT NOT NULL,
  english TEXT NOT NULL,
  pos TEXT NOT NULL, -- noun, verb, adjective, adverb
  difficulty_tier INTEGER NOT NULL, -- 1=top500, 2=500-1500, 3=1500-3000, 4=3000+
  language TEXT DEFAULT 'ko',
  UNIQUE(dictionary_form, pos)
);

-- Junction: which words appear in which videos
CREATE TABLE video_words (
  video_id INTEGER REFERENCES videos(id) ON DELETE CASCADE,
  word_id INTEGER REFERENCES words(id),
  frequency_in_video INTEGER DEFAULT 1,
  sentence_context TEXT, -- Korean sentence from transcript where word appears
  PRIMARY KEY (video_id, word_id)
);

-- User's learning progress per word
CREATE TABLE user_words (
  word_id INTEGER PRIMARY KEY REFERENCES words(id),
  status TEXT DEFAULT 'unseen', -- unseen, known, unknown
  learned_at TEXT,
  times_seen INTEGER DEFAULT 0
);
```

## Screen Flow
1. Home (2 tabs: Home + Progress) → shows video list + stats bar + "Add" button top-right
2. Add Video → paste YouTube URL field, share sheet also lands here
3. Video Vocab Deck → word list for one video + "Study" button
4. Flashcard Study → tinder-style swipe cards (Korean front, English back)
5. Progress → cumulative stats, vocab coverage, streak

## Flashcard Behavior
- Auto-limit to 15-20 highest value words per video
- Priority: new words user hasn't learned > frequency in video > nouns/verbs first
- Exclude words already marked "known" from any previous video
- Swipe right = know, swipe left = don't know
- Unknown cards recycle to end of deck ONCE, then move on
- After session: show summary + "Watch the video" button (opens YouTube app)

## Key Gotchas
- Korean is agglutinative — words attach particles/conjugations. Mecab handles this server-side.
- KENGDIC won't have every word. If no translation found, skip the word entirely — don't create a card.
- YouTube transcripts may be auto-generated (lower quality). Handle gracefully.
- Share sheet deep linking requires expo-linking configuration.
- Cold starts on Fly.io free tier may add 2-3s delay on first request after inactivity.

## Detailed Documentation
When working on specific areas, read the relevant doc first:
- `docs/product-spec.md` — Full product spec with user flows
- `docs/architecture.md` — Architecture decisions and rationale
- `docs/api-contract.md` — Server API request/response format
