// Database entity types (mirror SQLite schema)

export interface Video {
  id: number;
  youtube_id: string;
  title: string;
  thumbnail_url: string | null;
  added_at: string;
}

export interface Word {
  id: number;
  korean: string;
  dictionary_form: string;
  english: string;
  pos: 'noun' | 'verb' | 'adjective' | 'adverb';
  difficulty_tier: 1 | 2 | 3 | 4;
  language: string;
}

export interface VideoWord {
  video_id: number;
  word_id: number;
  frequency_in_video: number;
  sentence_context: string | null;
}

export type UserWordStatus = 'unseen' | 'known' | 'unknown';

export interface UserWord {
  word_id: number;
  status: UserWordStatus;
  learned_at: string | null;
  times_seen: number;
}

// Composite types for UI

export interface VideoWithProgress extends Video {
  total_words: number;
  learned_words: number;
}

export interface StudyWord extends Word {
  frequency_in_video: number;
  sentence_context: string | null;
  status: UserWordStatus;
}

// API types (match server contract)

export interface ExtractRequest {
  youtube_url: string;
  max_words?: number;
  exclude_dictionary_forms?: string[];
}

export interface ExtractedWord {
  korean: string;
  dictionary_form: string;
  english: string;
  pos: 'noun' | 'verb' | 'adjective' | 'adverb';
  difficulty_tier: 1 | 2 | 3 | 4;
  frequency_in_video: number;
  sentence_context: string;
}

export interface ExtractResponse {
  youtube_id: string;
  title: string;
  thumbnail_url: string;
  words: ExtractedWord[];
  meta: {
    total_morphemes: number;
    unique_words: number;
    words_with_translations: number;
    words_returned: number;
    processing_time_ms: number;
  };
}

export interface ExtractError {
  error: 'invalid_url' | 'no_subtitles' | 'processing_error';
  message: string;
}

export interface HealthResponse {
  status: string;
  mecab: boolean;
  dictionary_size: number;
}
