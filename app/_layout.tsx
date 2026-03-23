import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="add-video"
          options={{ title: 'Add Video', presentation: 'modal' }}
        />
        <Stack.Screen
          name="video/[id]"
          options={{ title: 'Vocab Deck' }}
        />
        <Stack.Screen
          name="study/[id]"
          options={{ headerShown: false, presentation: 'fullScreenModal' }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
