import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { extractVocab, ApiError } from '../src/lib/api';
import { saveExtraction, getKnownDictionaryForms } from '../src/lib/database';

export default function AddVideoScreen() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const trimmed = url.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);

    try {
      const knownForms = await getKnownDictionaryForms();
      const result = await extractVocab({
        youtube_url: trimmed,
        exclude_dictionary_forms: knownForms,
      });

      const videoId = await saveExtraction(
        result.youtube_id,
        result.title,
        result.thumbnail_url,
        result.words
      );

      router.replace(`/video/${videoId}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'no_subtitles') {
          setError("This video doesn't have Korean subtitles");
        } else if (err.code === 'invalid_url') {
          setError('Not a valid YouTube URL');
        } else {
          setError(err.message);
        }
      } else {
        setError('Could not connect to server. Check your internet connection.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Paste a YouTube URL</Text>
      <TextInput
        style={styles.input}
        placeholder="https://youtube.com/watch?v=..."
        placeholderTextColor="#aaa"
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        editable={!loading}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.button, (!url.trim() || loading) && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={!url.trim() || loading}
      >
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.buttonText}> Extracting vocab...</Text>
          </View>
        ) : (
          <Text style={styles.buttonText}>Extract Vocabulary</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  label: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fafafa',
  },
  error: {
    color: '#e53935',
    fontSize: 14,
    marginTop: 12,
  },
  button: {
    backgroundColor: '#4A90D9',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  loadingRow: { flexDirection: 'row', alignItems: 'center' },
});
