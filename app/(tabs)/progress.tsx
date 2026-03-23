import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getProgressStats, type ProgressStats } from '../../src/lib/database';

export default function ProgressScreen() {
  const [stats, setStats] = useState<ProgressStats>({
    totalLearned: 0, totalUnknown: 0, totalUnseen: 0,
    tier1: 0, tier2: 0, tier3: 0, tier4: 0,
    nouns: 0, verbs: 0, adjectives: 0, adverbs: 0,
  });

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [])
  );

  async function loadStats() {
    const result = await getProgressStats();
    setStats(result);
  }

  const coveragePercent = Math.round((stats.tier1 + stats.tier2) / 1500 * 100);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.bigStat}>
        <Text style={styles.bigNumber}>{stats.totalLearned}</Text>
        <Text style={styles.bigLabel}>Words Learned</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Vocab Coverage</Text>
        <Text style={styles.coverageText}>
          You know {coveragePercent}% of the top 1500 Korean words
        </Text>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${Math.min(coveragePercent, 100)}%` }]} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>By Difficulty</Text>
        <StatRow label="Top 500" value={stats.tier1} color="#4CAF50" />
        <StatRow label="500-1500" value={stats.tier2} color="#8BC34A" />
        <StatRow label="1500-3000" value={stats.tier3} color="#FF9800" />
        <StatRow label="3000+" value={stats.tier4} color="#F44336" />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>By Part of Speech</Text>
        <StatRow label="Nouns" value={stats.nouns} color="#4A90D9" />
        <StatRow label="Verbs" value={stats.verbs} color="#9C27B0" />
        <StatRow label="Adjectives" value={stats.adjectives} color="#FF5722" />
        <StatRow label="Adverbs" value={stats.adverbs} color="#607D8B" />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Study Status</Text>
        <StatRow label="Known" value={stats.totalLearned} color="#4CAF50" />
        <StatRow label="To Review" value={stats.totalUnknown} color="#FF9800" />
        <StatRow label="Unseen" value={stats.totalUnseen} color="#9E9E9E" />
      </View>
    </ScrollView>
  );
}

function StatRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.statRow}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.statRowLabel}>{label}</Text>
      <Text style={styles.statRowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { padding: 16 },
  bigStat: { alignItems: 'center', paddingVertical: 24 },
  bigNumber: { fontSize: 48, fontWeight: '700', color: '#4A90D9' },
  bigLabel: { fontSize: 16, color: '#888', marginTop: 4 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 12 },
  coverageText: { fontSize: 14, color: '#666', marginBottom: 8 },
  progressBarBg: {
    height: 8,
    backgroundColor: '#eee',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4A90D9',
    borderRadius: 4,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  statRowLabel: { flex: 1, fontSize: 14, color: '#555' },
  statRowValue: { fontSize: 14, fontWeight: '600', color: '#333' },
});
