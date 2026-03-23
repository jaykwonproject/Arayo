import { useCallback, useState } from 'react';
import {
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import { getVideo, getStudyWordsForVideo } from '../../src/lib/database';
import type { Video, StudyWord } from '../../src/types';

const TIER_COLORS: Record<number, string> = {
  1: '#4CAF50',
  2: '#8BC34A',
  3: '#FF9800',
  4: '#F44336',
};

export default function VideoVocabDeckScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [video, setVideo] = useState<Video | null>(null);
  const [words, setWords] = useState<StudyWord[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [id])
  );

  async function loadData() {
    const videoId = Number(id);
    const [videoData, wordsData] = await Promise.all([
      getVideo(videoId),
      getStudyWordsForVideo(videoId),
    ]);
    setVideo(videoData);
    setWords(wordsData);
  }

  const learnedCount = words.filter((w) => w.status === 'known').length;
  const unlearnedWords = words.filter((w) => w.status !== 'known');

  return (
    <View style={styles.container}>
      {video && (
        <Pressable
          style={styles.header}
          onPress={() =>
            Linking.openURL(`https://youtube.com/watch?v=${video.youtube_id}`)
          }
        >
          <Text style={styles.videoTitle}>{video.title}</Text>
          <Text style={styles.watchLink}>Watch on YouTube</Text>
        </Pressable>
      )}

      <View style={styles.progressRow}>
        <Text style={styles.progressText}>
          {learnedCount}/{words.length} words learned
        </Text>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: words.length
                  ? `${(learnedCount / words.length) * 100}%`
                  : '0%',
              },
            ]}
          />
        </View>
      </View>

      {unlearnedWords.length > 0 && (
        <Pressable
          style={styles.studyButton}
          onPress={() => router.push(`/study/${id}`)}
        >
          <Text style={styles.studyButtonText}>
            Study ({Math.min(unlearnedWords.length, 20)} words)
          </Text>
        </Pressable>
      )}

      <FlatList
        data={words}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.wordRow}>
            <View style={[styles.tierDot, { backgroundColor: TIER_COLORS[item.difficulty_tier] }]} />
            <View style={styles.wordInfo}>
              <Text style={styles.korean}>{item.korean}</Text>
              <Text style={styles.english}>{item.english}</Text>
            </View>
            <Text style={styles.pos}>{item.pos}</Text>
            {item.status === 'known' && <Text style={styles.check}>&#10003;</Text>}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  videoTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  watchLink: { fontSize: 13, color: '#4A90D9', marginTop: 4 },
  progressRow: { padding: 16, backgroundColor: '#fff' },
  progressText: { fontSize: 14, color: '#666', marginBottom: 8 },
  progressBarBg: {
    height: 6,
    backgroundColor: '#eee',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: { height: '100%', backgroundColor: '#4A90D9', borderRadius: 3 },
  studyButton: {
    backgroundColor: '#4A90D9',
    margin: 16,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  studyButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginTop: 6,
    borderRadius: 8,
  },
  tierDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  wordInfo: { flex: 1 },
  korean: { fontSize: 16, fontWeight: '600', color: '#333' },
  english: { fontSize: 13, color: '#888', marginTop: 2 },
  pos: { fontSize: 12, color: '#aaa', marginRight: 8 },
  check: { fontSize: 16, color: '#4CAF50' },
});
