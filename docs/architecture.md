# Architecture Decisions

## ADR-001: Device-local storage, no auth
**Decision**: All user data stored locally via expo-sqlite. No user accounts.
**Rationale**: Target user is one person (girlfriend). No need for sync. Removes entire auth stack. If we launch publicly later, can add optional sync as a feature.
**Trade-off**: No cross-device sync. Losing the phone = losing data.

## ADR-002: Stateless server for NLP only
**Decision**: Server handles ONLY YouTube transcript fetching + Korean NLP processing. No user data stored server-side.
**Rationale**: Mecab (C library) cannot run client-side in React Native. Server is minimal — one POST endpoint, no database, no state.
**Trade-off**: Requires network to add videos. Studying is fully offline.

## ADR-003: Fly.io for backend hosting
**Decision**: Deploy FastAPI server to Fly.io free tier.
**Rationale**: Supports Docker containers (needed for Mecab C library). Free tier provides 3 shared-CPU VMs with 256MB RAM — more than enough. Cold start ~2-3s is acceptable.
**Trade-off**: Cold starts on free tier. Can warm with cron ping if needed.

## ADR-004: youtube-transcript-api (Python scraper) for transcripts
**Decision**: Use the unofficial `youtube-transcript-api` Python library instead of official YouTube Data API.
**Rationale**: No API key needed. No quota limits. Works with both manual and auto-generated subtitles. Every competitor in this space uses it.
**Trade-off**: Against YouTube TOS. Could break if YouTube changes. Acceptable risk for personal use; re-evaluate before public launch.

## ADR-005: KENGDIC for translations, skip unknown words
**Decision**: Use KENGDIC open-source dictionary. If a word is not found, do not create a flashcard.
**Rationale**: No AI cost. Deterministic. Covers ~90K entries which handles common vocab well. Slang, brand names, and rare words are skipped — acceptable for language learning.
**Trade-off**: ~20-30% of extracted words may not have translations. This is fine — better to show reliable cards than garbage.

## ADR-006: Korean-first, multi-language architecture
**Decision**: Build for Korean only, but abstract NLP layer behind a language interface.
**Rationale**: Korean is the only target now, but the tokenize → translate → tier pipeline is language-agnostic in concept. Different languages swap in different tokenizers and dictionaries.
**Trade-off**: Slight over-engineering for current needs. Minimal cost since it's just an interface pattern.

## ADR-007: Expo managed workflow
**Decision**: Stay in Expo managed workflow, no ejecting.
**Rationale**: expo-sqlite, expo-linking, expo-router all work in managed. No native modules needed that require bare workflow. Managed = simpler builds, OTA updates, less config.
**Trade-off**: If we need a native module not supported by Expo, we'd need to eject or use a dev client.
