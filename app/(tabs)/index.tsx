import { useCallback, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  Alert,
} from 'react-native';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { getVideos, getStats, deleteVideo } from '../../src/lib/database';
import type { VideoWithProgress } from '../../src/types';

export default function HomeScreen() {
  const router = useRouter();
  const [videos, setVideos] = useState<VideoWithProgress[]>([]);
  const [stats, setStats] = useState({ totalWordsLearned: 0, totalVideos: 0, knownInTop1500: 0 });

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    const [videosData, statsData] = await Promise.all([getVideos(), getStats()]);
    setVideos(videosData);
    setStats(statsData);
  }

  function handleDelete(video: VideoWithProgress) {
    Alert.alert('Delete Video', `Remove "${video.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteVideo(video.id);
          loadData();
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.totalWordsLearned}</Text>
          <Text style={styles.statLabel}>Words Learned</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.knownInTop1500}</Text>
          <Text style={styles.statLabel}>Top 1500</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.totalVideos}</Text>
          <Text style={styles.statLabel}>Videos</Text>
        </View>
      </View>

      {videos.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Add your first YouTube video to start learning</Text>
          <Link href="/add-video" asChild>
            <Pressable style={styles.addButton}>
              <Text style={styles.addButtonText}>Add Video</Text>
            </Pressable>
          </Link>
        </View>
      ) : (
        <FlatList
          data={videos}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <Pressable
              style={styles.videoRow}
              onPress={() => router.push(`/video/${item.id}`)}
              onLongPress={() => handleDelete(item)}
            >
              {item.thumbnail_url && (
                <Image source={{ uri: item.thumbnail_url }} style={styles.thumbnail} />
              )}
              <View style={styles.videoInfo}>
                <Text style={styles.videoTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.videoBadge}>
                  {item.learned_words}/{item.total_words} words learned
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}

      <Link href="/add-video" asChild>
        <Pressable style={styles.fab}>
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  statItem: { alignItems: 'center' },
  statNumber: { fontSize: 24, fontWeight: '700', color: '#4A90D9' },
  statLabel: { fontSize: 12, color: '#888', marginTop: 2 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { fontSize: 16, color: '#888', textAlign: 'center', marginBottom: 16 },
  addButton: {
    backgroundColor: '#4A90D9',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  videoRow: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  thumbnail: { width: 100, height: 56, borderRadius: 6, backgroundColor: '#ddd' },
  videoInfo: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  videoTitle: { fontSize: 14, fontWeight: '600', color: '#333' },
  videoBadge: { fontSize: 12, color: '#888', marginTop: 4 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4A90D9',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 30 },
});
