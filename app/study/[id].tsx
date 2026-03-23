import { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import { getVideo, getStudyWordsForVideo, updateWordStatus } from '../../src/lib/database';
import { StudySession } from '../../src/lib/vocab-engine';
import type { Video, StudyWord } from '../../src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

const TIER_COLORS: Record<number, string> = {
  1: '#4CAF50',
  2: '#8BC34A',
  3: '#FF9800',
  4: '#F44336',
};

export default function StudyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<StudySession | null>(null);
  const [currentCard, setCurrentCard] = useState<StudyWord | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [summary, setSummary] = useState<{ knewCount: number; didntKnowCount: number } | null>(null);
  const [video, setVideo] = useState<Video | null>(null);

  const translateX = useSharedValue(0);
  const rotateZ = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      loadSession();
    }, [id])
  );

  async function loadSession() {
    const videoId = Number(id);
    const [videoData, words] = await Promise.all([
      getVideo(videoId),
      getStudyWordsForVideo(videoId),
    ]);
    setVideo(videoData);
    const s = new StudySession(words);
    setSession(s);
    setCurrentCard(s.currentCard);
    setProgress(s.progress);
  }

  function advanceCard(direction: 'right' | 'left') {
    if (!session) return;

    if (direction === 'right') {
      session.swipeRight();
    } else {
      session.swipeLeft();
    }

    if (session.isComplete) {
      const sum = session.getSummary();
      setSummary(sum);
      // Save results
      for (const r of sum.results) {
        updateWordStatus(r.wordId, r.knew ? 'known' : 'unknown');
      }
      setCurrentCard(null);
    } else {
      setCurrentCard(session.currentCard);
      setProgress(session.progress);
    }
    setFlipped(false);
  }

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
      rotateZ.value = interpolate(e.translationX, [-SCREEN_WIDTH, 0, SCREEN_WIDTH], [-15, 0, 15]);
    })
    .onEnd((e) => {
      if (e.translationX > SWIPE_THRESHOLD) {
        translateX.value = withTiming(SCREEN_WIDTH * 1.5, { duration: 200 });
        rotateZ.value = withTiming(15, { duration: 200 });
        runOnJS(advanceCard)('right');
      } else if (e.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-SCREEN_WIDTH * 1.5, { duration: 200 });
        rotateZ.value = withTiming(-15, { duration: 200 });
        runOnJS(advanceCard)('left');
      } else {
        translateX.value = withSpring(0);
        rotateZ.value = withSpring(0);
      }
      // Reset for next card after animation
      setTimeout(() => {
        translateX.value = 0;
        rotateZ.value = 0;
      }, 250);
    });

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { rotateZ: `${rotateZ.value}deg` },
    ],
  }));

  const swipeIndicatorStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD],
      [1, 0, 1]
    );
    return { opacity };
  });

  // Summary screen
  if (summary) {
    return (
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>Session Complete!</Text>
        <Text style={styles.summaryText}>
          You learned {summary.knewCount} new words!
        </Text>
        {summary.didntKnowCount > 0 && (
          <Text style={styles.summarySubtext}>
            {summary.didntKnowCount} to review next time.
          </Text>
        )}
        {video && (
          <Pressable
            style={styles.watchButton}
            onPress={() =>
              Linking.openURL(`https://youtube.com/watch?v=${video.youtube_id}`)
            }
          >
            <Text style={styles.watchButtonText}>Watch the Video</Text>
          </Pressable>
        )}
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Back to Deck</Text>
        </Pressable>
      </View>
    );
  }

  if (!currentCard) {
    return (
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.closeButton}>&#10005;</Text>
        </Pressable>
        <Text style={styles.progressText}>
          {progress.current}/{progress.total}
        </Text>
        <View style={{ width: 30 }} />
      </View>

      <View style={styles.progressBarBg}>
        <View
          style={[
            styles.progressBarFill,
            { width: `${(progress.current / progress.total) * 100}%` },
          ]}
        />
      </View>

      <View style={styles.cardArea}>
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.card, cardAnimatedStyle]}>
            <Pressable
              style={styles.cardInner}
              onPress={() => setFlipped(!flipped)}
            >
              {!flipped ? (
                <>
                  <Text style={styles.korean}>{currentCard.korean}</Text>
                  <Text style={styles.pos}>{currentCard.pos}</Text>
                  <View
                    style={[
                      styles.tierBadge,
                      { backgroundColor: TIER_COLORS[currentCard.difficulty_tier] },
                    ]}
                  >
                    <Text style={styles.tierText}>Tier {currentCard.difficulty_tier}</Text>
                  </View>
                  <Text style={styles.tapHint}>Tap to reveal</Text>
                </>
              ) : (
                <>
                  <Text style={styles.korean}>{currentCard.korean}</Text>
                  <Text style={styles.english}>{currentCard.english}</Text>
                  {currentCard.sentence_context && (
                    <View style={styles.contextBox}>
                      <Text style={styles.contextText}>
                        {currentCard.sentence_context}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.swipeHint}>
                    Swipe right = know, left = don't know
                  </Text>
                </>
              )}
            </Pressable>
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 8,
  },
  closeButton: { fontSize: 20, color: '#888', padding: 8 },
  progressText: { fontSize: 16, fontWeight: '600', color: '#555' },
  progressBarBg: {
    height: 4,
    backgroundColor: '#eee',
    marginHorizontal: 16,
  },
  progressBarFill: { height: '100%', backgroundColor: '#4A90D9' },
  cardArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: SCREEN_WIDTH - 48,
    minHeight: 400,
    backgroundColor: '#fff',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  cardInner: {
    flex: 1,
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  korean: { fontSize: 40, fontWeight: '700', color: '#333', textAlign: 'center' },
  pos: { fontSize: 14, color: '#999', marginTop: 8 },
  tierBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 16,
  },
  tierText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  tapHint: { fontSize: 13, color: '#ccc', marginTop: 32 },
  english: {
    fontSize: 22,
    color: '#4A90D9',
    marginTop: 12,
    textAlign: 'center',
  },
  contextBox: {
    backgroundColor: '#f0f4f8',
    borderRadius: 8,
    padding: 12,
    marginTop: 20,
    width: '100%',
  },
  contextText: { fontSize: 16, color: '#555', textAlign: 'center', lineHeight: 24 },
  swipeHint: { fontSize: 12, color: '#ccc', marginTop: 24 },
  summaryContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 32,
  },
  summaryTitle: { fontSize: 28, fontWeight: '700', color: '#333', marginBottom: 16 },
  summaryText: { fontSize: 18, color: '#555', textAlign: 'center' },
  summarySubtext: { fontSize: 16, color: '#888', marginTop: 8 },
  watchButton: {
    backgroundColor: '#FF0000',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 32,
  },
  watchButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginTop: 12,
  },
  backButtonText: { color: '#4A90D9', fontSize: 16, fontWeight: '600' },
});
