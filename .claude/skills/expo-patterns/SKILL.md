---
name: expo-patterns
description: Expo and React Native patterns for this project. Use when creating screens, components, navigation, SQLite database operations, deep linking, share sheet handling, or animations. Trigger on mentions of Expo Router, expo-sqlite, expo-linking, react-native-gesture-handler, or react-native-reanimated.
---

# Expo Patterns for Korean Vocab Primer

## Navigation (Expo Router)
This app uses file-based routing with Expo Router.

### Tab Layout
```
app/
├── _layout.tsx          # Root layout (tab navigator)
├── (tabs)/
│   ├── _layout.tsx      # Tab bar config (Home + Progress)
│   ├── index.tsx         # Home screen (video list)
│   └── progress.tsx      # Progress/Stats screen
├── add-video.tsx         # Add Video (push screen from Home)
├── video/[id].tsx        # Video Vocab Deck (dynamic route)
└── study/[id].tsx        # Flashcard Study (modal or push)
```

### Navigation Pattern
```typescript
import { router } from 'expo-router';

// Navigate to video deck
router.push(`/video/${videoId}`);

// Navigate to study session
router.push(`/study/${videoId}`);

// Go back
router.back();
```

## SQLite (expo-sqlite)
Always use the async API. All DB operations go through `src/lib/database.ts`.

### Pattern: Database singleton
```typescript
import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('korean-vocab.db');
    await runMigrations(db);
  }
  return db;
}
```

### Pattern: Batch inserts with transactions
```typescript
export async function insertVideoWords(
  videoId: number,
  words: ExtractedWord[]
): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const word of words) {
      // Insert word if not exists, get ID
      // Insert video_word junction
      // Insert user_word if not exists
    }
  });
}
```

## Share Sheet / Deep Linking (expo-linking)
The app receives YouTube URLs from the system share sheet.

### Pattern: URL handling
```typescript
import * as Linking from 'expo-linking';

// In app/_layout.tsx
const url = Linking.useURL();

useEffect(() => {
  if (url) {
    const youtubeId = extractYouTubeId(url);
    if (youtubeId) {
      router.push(`/add-video?url=${encodeURIComponent(url)}`);
    }
  }
}, [url]);
```

## Swipe Gesture (Flashcards)
Use react-native-gesture-handler + react-native-reanimated for tinder-style cards.

### Pattern: Swipe card
```typescript
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';

// translateX shared value for swipe position
// Pan gesture with onEnd callback
// Threshold: >120px right = know, <-120px left = don't know
// Animated style for card rotation and opacity
```

## Error Handling
```typescript
// API calls always need try/catch with offline fallback
try {
  const vocab = await api.extractVocab(youtubeUrl);
  await database.saveVideoWithWords(videoInfo, vocab);
} catch (error) {
  if (!isConnected) {
    Alert.alert('Offline', 'You need internet to add a video. Studying saved videos works offline.');
  } else {
    Alert.alert('Error', 'Could not extract vocabulary from this video.');
  }
}
```
