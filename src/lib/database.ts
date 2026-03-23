import * as SQLite from 'expo-sqlite';
import type {
  Video,
  Word,
  VideoWord,
  UserWord,
  VideoWithProgress,
  StudyWord,
  ExtractedWord,
  UserWordStatus,
} from '../types';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('korean-vocab-primer.db');
  await initSchema(db);
  return db;
}

async function initSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      youtube_id TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      thumbnail_url TEXT,
      added_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      korean TEXT NOT NULL,
      dictionary_form TEXT NOT NULL,
      english TEXT NOT NULL,
      pos TEXT NOT NULL,
      difficulty_tier INTEGER NOT NULL,
      language TEXT DEFAULT 'ko',
      UNIQUE(dictionary_form, pos)
    );

    CREATE TABLE IF NOT EXISTS video_words (
      video_id INTEGER REFERENCES videos(id) ON DELETE CASCADE,
      word_id INTEGER REFERENCES words(id),
      frequency_in_video INTEGER DEFAULT 1,
      sentence_context TEXT,
      PRIMARY KEY (video_id, word_id)
    );

    CREATE TABLE IF NOT EXISTS user_words (
      word_id INTEGER PRIMARY KEY REFERENCES words(id),
      status TEXT DEFAULT 'unseen',
      learned_at TEXT,
      times_seen INTEGER DEFAULT 0
    );
  `);
}

// --- Videos ---

export async function insertVideo(
  youtubeId: string,
  title: string,
  thumbnailUrl: string | null
): Promise<number> {
  const database = await getDatabase();
  const result = await database.runAsync(
    `INSERT INTO videos (youtube_id, title, thumbnail_url) VALUES (?, ?, ?)
     ON CONFLICT(youtube_id) DO UPDATE SET title = excluded.title, thumbnail_url = excluded.thumbnail_url`,
    [youtubeId, title, thumbnailUrl]
  );
  if (result.changes === 0) {
    const row = await database.getFirstAsync<{ id: number }>(
      'SELECT id FROM videos WHERE youtube_id = ?',
      [youtubeId]
    );
    return row!.id;
  }
  return result.lastInsertRowId;
}

export async function getVideos(): Promise<VideoWithProgress[]> {
  const database = await getDatabase();
  return database.getAllAsync<VideoWithProgress>(`
    SELECT
      v.*,
      COUNT(vw.word_id) as total_words,
      COUNT(CASE WHEN uw.status = 'known' THEN 1 END) as learned_words
    FROM videos v
    LEFT JOIN video_words vw ON v.id = vw.video_id
    LEFT JOIN user_words uw ON vw.word_id = uw.word_id
    GROUP BY v.id
    ORDER BY v.added_at DESC
  `);
}

export async function getVideo(id: number): Promise<Video | null> {
  const database = await getDatabase();
  return database.getFirstAsync<Video>('SELECT * FROM videos WHERE id = ?', [id]);
}

export async function deleteVideo(id: number): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM videos WHERE id = ?', [id]);
}

// --- Words ---

export async function insertWord(word: ExtractedWord): Promise<number> {
  const database = await getDatabase();
  const result = await database.runAsync(
    `INSERT INTO words (korean, dictionary_form, english, pos, difficulty_tier)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(dictionary_form, pos) DO UPDATE SET
       korean = excluded.korean,
       english = excluded.english,
       difficulty_tier = excluded.difficulty_tier`,
    [word.korean, word.dictionary_form, word.english, word.pos, word.difficulty_tier]
  );
  if (result.changes === 0) {
    const row = await database.getFirstAsync<{ id: number }>(
      'SELECT id FROM words WHERE dictionary_form = ? AND pos = ?',
      [word.dictionary_form, word.pos]
    );
    return row!.id;
  }
  return result.lastInsertRowId;
}

export async function linkWordToVideo(
  videoId: number,
  wordId: number,
  frequencyInVideo: number,
  sentenceContext: string | null
): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO video_words (video_id, word_id, frequency_in_video, sentence_context)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(video_id, word_id) DO UPDATE SET
       frequency_in_video = excluded.frequency_in_video,
       sentence_context = excluded.sentence_context`,
    [videoId, wordId, frequencyInVideo, sentenceContext]
  );
}

export async function ensureUserWord(wordId: number): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT OR IGNORE INTO user_words (word_id) VALUES (?)`,
    [wordId]
  );
}

// --- Study ---

export async function getStudyWordsForVideo(videoId: number): Promise<StudyWord[]> {
  const database = await getDatabase();
  return database.getAllAsync<StudyWord>(`
    SELECT
      w.*,
      vw.frequency_in_video,
      vw.sentence_context,
      COALESCE(uw.status, 'unseen') as status
    FROM video_words vw
    JOIN words w ON vw.word_id = w.id
    LEFT JOIN user_words uw ON w.id = uw.word_id
    WHERE vw.video_id = ?
    ORDER BY
      CASE WHEN COALESCE(uw.status, 'unseen') = 'known' THEN 1 ELSE 0 END,
      vw.frequency_in_video DESC,
      CASE w.pos WHEN 'noun' THEN 0 WHEN 'verb' THEN 1 ELSE 2 END,
      w.difficulty_tier ASC
  `, [videoId]);
}

export async function updateWordStatus(
  wordId: number,
  status: UserWordStatus
): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO user_words (word_id, status, learned_at, times_seen)
     VALUES (?, ?, CASE WHEN ? = 'known' THEN datetime('now') ELSE NULL END, 1)
     ON CONFLICT(word_id) DO UPDATE SET
       status = excluded.status,
       learned_at = CASE WHEN excluded.status = 'known' THEN datetime('now') ELSE user_words.learned_at END,
       times_seen = user_words.times_seen + 1`,
    [wordId, status, status]
  );
}

// --- Stats ---

export async function getStats(): Promise<{
  totalWordsLearned: number;
  totalVideos: number;
  knownInTop1500: number;
}> {
  const database = await getDatabase();
  const stats = await database.getFirstAsync<{
    totalWordsLearned: number;
    totalVideos: number;
    knownInTop1500: number;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM user_words WHERE status = 'known') as totalWordsLearned,
      (SELECT COUNT(*) FROM videos) as totalVideos,
      (SELECT COUNT(*) FROM user_words uw
       JOIN words w ON uw.word_id = w.id
       WHERE uw.status = 'known' AND w.difficulty_tier <= 2) as knownInTop1500
  `);
  return stats ?? { totalWordsLearned: 0, totalVideos: 0, knownInTop1500: 0 };
}

export async function getKnownDictionaryForms(): Promise<string[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{ dictionary_form: string }>(
    `SELECT w.dictionary_form FROM user_words uw
     JOIN words w ON uw.word_id = w.id
     WHERE uw.status = 'known'`
  );
  return rows.map((r) => r.dictionary_form);
}

// --- Save full extraction result ---

export async function saveExtraction(
  youtubeId: string,
  title: string,
  thumbnailUrl: string,
  words: ExtractedWord[]
): Promise<number> {
  const videoId = await insertVideo(youtubeId, title, thumbnailUrl);

  for (const word of words) {
    const wordId = await insertWord(word);
    await linkWordToVideo(videoId, wordId, word.frequency_in_video, word.sentence_context);
    await ensureUserWord(wordId);
  }

  return videoId;
}
