import type { StudyWord } from '../types';

const MAX_DECK_SIZE = 20;
const MIN_DECK_SIZE = 15;

/**
 * Builds a study deck from a video's words.
 * Priority: new words first > higher frequency > nouns/verbs first > lower difficulty tier.
 * Excludes words already marked "known".
 */
export function buildStudyDeck(words: StudyWord[]): StudyWord[] {
  const candidates = words.filter((w) => w.status !== 'known');

  const sorted = [...candidates].sort((a, b) => {
    // New (unseen) words first
    const aIsNew = a.status === 'unseen' ? 0 : 1;
    const bIsNew = b.status === 'unseen' ? 0 : 1;
    if (aIsNew !== bIsNew) return aIsNew - bIsNew;

    // Higher frequency first
    if (b.frequency_in_video !== a.frequency_in_video) {
      return b.frequency_in_video - a.frequency_in_video;
    }

    // Nouns/verbs before adjectives/adverbs
    const posOrder = { noun: 0, verb: 1, adjective: 2, adverb: 3 };
    const aPos = posOrder[a.pos] ?? 4;
    const bPos = posOrder[b.pos] ?? 4;
    if (aPos !== bPos) return aPos - bPos;

    // Lower difficulty first
    return a.difficulty_tier - b.difficulty_tier;
  });

  return sorted.slice(0, MAX_DECK_SIZE);
}

/**
 * Manages card recycling during a study session.
 * Cards swiped "don't know" recycle to end once, then are discarded.
 */
export class StudySession {
  private deck: StudyWord[];
  private currentIndex: number;
  private recycledIds: Set<number>;
  private results: { wordId: number; knew: boolean }[];

  constructor(words: StudyWord[]) {
    this.deck = buildStudyDeck(words);
    this.currentIndex = 0;
    this.recycledIds = new Set();
    this.results = [];
  }

  get currentCard(): StudyWord | null {
    if (this.currentIndex >= this.deck.length) return null;
    return this.deck[this.currentIndex];
  }

  get progress(): { current: number; total: number } {
    return { current: this.currentIndex + 1, total: this.deck.length };
  }

  get isComplete(): boolean {
    return this.currentIndex >= this.deck.length;
  }

  swipeRight(): void {
    const card = this.currentCard;
    if (!card) return;
    this.results.push({ wordId: card.id, knew: true });
    this.currentIndex++;
  }

  swipeLeft(): void {
    const card = this.currentCard;
    if (!card) return;
    this.results.push({ wordId: card.id, knew: false });

    if (!this.recycledIds.has(card.id)) {
      this.recycledIds.add(card.id);
      this.deck.push(card);
    }

    this.currentIndex++;
  }

  getSummary(): { knewCount: number; didntKnowCount: number; results: { wordId: number; knew: boolean }[] } {
    const finalResults = new Map<number, boolean>();
    for (const r of this.results) {
      finalResults.set(r.wordId, r.knew);
    }

    let knewCount = 0;
    let didntKnowCount = 0;
    for (const knew of finalResults.values()) {
      if (knew) knewCount++;
      else didntKnowCount++;
    }

    return {
      knewCount,
      didntKnowCount,
      results: Array.from(finalResults.entries()).map(([wordId, knew]) => ({ wordId, knew })),
    };
  }
}
