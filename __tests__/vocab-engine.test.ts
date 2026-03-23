import { buildStudyDeck, StudySession } from '../src/lib/vocab-engine';
import type { StudyWord } from '../src/types';

function makeWord(overrides: Partial<StudyWord> & { id: number }): StudyWord {
  return {
    korean: '단어',
    dictionary_form: '단어',
    english: 'word',
    pos: 'noun',
    difficulty_tier: 1,
    language: 'ko',
    frequency_in_video: 5,
    sentence_context: null,
    status: 'unseen',
    ...overrides,
  };
}

describe('buildStudyDeck', () => {
  it('excludes known words', () => {
    const words: StudyWord[] = [
      makeWord({ id: 1, status: 'known' }),
      makeWord({ id: 2, status: 'unseen' }),
      makeWord({ id: 3, status: 'unknown' }),
    ];
    const deck = buildStudyDeck(words);
    expect(deck.map((w) => w.id)).toEqual([2, 3]);
  });

  it('limits to 20 cards max', () => {
    const words: StudyWord[] = Array.from({ length: 25 }, (_, i) =>
      makeWord({ id: i + 1, dictionary_form: `word${i}` })
    );
    const deck = buildStudyDeck(words);
    expect(deck.length).toBe(20);
  });

  it('prioritizes unseen over unknown', () => {
    const words: StudyWord[] = [
      makeWord({ id: 1, status: 'unknown', dictionary_form: 'a' }),
      makeWord({ id: 2, status: 'unseen', dictionary_form: 'b' }),
    ];
    const deck = buildStudyDeck(words);
    expect(deck[0].id).toBe(2);
    expect(deck[1].id).toBe(1);
  });

  it('prioritizes higher frequency', () => {
    const words: StudyWord[] = [
      makeWord({ id: 1, frequency_in_video: 2, dictionary_form: 'a' }),
      makeWord({ id: 2, frequency_in_video: 10, dictionary_form: 'b' }),
    ];
    const deck = buildStudyDeck(words);
    expect(deck[0].id).toBe(2);
    expect(deck[1].id).toBe(1);
  });

  it('prioritizes nouns/verbs over adjectives/adverbs', () => {
    const words: StudyWord[] = [
      makeWord({ id: 1, pos: 'adverb', dictionary_form: 'a' }),
      makeWord({ id: 2, pos: 'adjective', dictionary_form: 'b' }),
      makeWord({ id: 3, pos: 'verb', dictionary_form: 'c' }),
      makeWord({ id: 4, pos: 'noun', dictionary_form: 'd' }),
    ];
    const deck = buildStudyDeck(words);
    expect(deck.map((w) => w.pos)).toEqual(['noun', 'verb', 'adjective', 'adverb']);
  });
});

describe('StudySession', () => {
  function makeSessionWords(): StudyWord[] {
    return [
      makeWord({ id: 1, dictionary_form: 'a' }),
      makeWord({ id: 2, dictionary_form: 'b' }),
      makeWord({ id: 3, dictionary_form: 'c' }),
    ];
  }

  it('tracks progress correctly', () => {
    const session = new StudySession(makeSessionWords());
    expect(session.progress).toEqual({ current: 1, total: 3 });
    expect(session.isComplete).toBe(false);

    session.swipeRight();
    expect(session.progress).toEqual({ current: 2, total: 3 });
  });

  it('swipeRight marks card as known', () => {
    const session = new StudySession(makeSessionWords());
    session.swipeRight();
    session.swipeRight();
    session.swipeRight();

    const summary = session.getSummary();
    expect(summary.knewCount).toBe(3);
    expect(summary.didntKnowCount).toBe(0);
  });

  it('swipeLeft recycles card to end of deck', () => {
    const session = new StudySession(makeSessionWords());
    const firstCard = session.currentCard;
    session.swipeLeft();

    // Deck should now be 4 cards (original 3 + 1 recycled)
    expect(session.progress.total).toBe(4);
  });

  it('does not recycle the same card twice', () => {
    const session = new StudySession(makeSessionWords());

    // Swipe left on card 1 (it gets recycled to end)
    session.swipeLeft();
    // Swipe right on cards 2 and 3
    session.swipeRight();
    session.swipeRight();
    // Now we're at the recycled card 1 again - swipe left again
    session.swipeLeft();

    // Deck should still be 4 (not 5), card was not recycled a second time
    expect(session.progress.total).toBe(4);
    expect(session.isComplete).toBe(true);
  });

  it('getSummary returns correct counts', () => {
    const session = new StudySession(makeSessionWords());

    session.swipeRight(); // card 1 - know
    session.swipeLeft();  // card 2 - don't know (recycled)
    session.swipeRight(); // card 3 - know
    session.swipeRight(); // card 2 again (recycled) - know this time

    const summary = session.getSummary();
    // Card 2 was swiped left then right - last result wins (knew)
    expect(summary.knewCount).toBe(3);
    expect(summary.didntKnowCount).toBe(0);
    expect(summary.results.length).toBe(3);
  });
});
