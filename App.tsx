import React, { useEffect } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { PlayerProvider } from './src/hooks/usePlayer';
import { LibraryProvider } from './src/hooks/useLibrary';
import { COLORS } from './src/constants/theme';
import { DownloadService } from './src/services/DownloadService';
import { AudioFX } from './src/services/AudioFX';
import { playbackEngine } from './src/playback/PlaybackEngine';
import { engagement } from './src/engagement/Streaks';
import { tasteProfile } from './src/ai/TasteProfile';
import { getPlatformInfo, isArkifyNativeAvailable } from './modules/arkify-native';

export default function App() {
  // Proof-of-connection for the Android native module. Dev-only, no UI impact.
  useEffect(() => {
    if (__DEV__) {
      console.log(
        '[ArkifyNative] available:',
        isArkifyNativeAvailable(),
        'getPlatformInfo():',
        getPlatformInfo()
      );
    }
  }, []);

  // Warm the download index early so the first Download tap is fast and
  // so offline-stream checks don't pay the AsyncStorage cost on the
  // first play.
  useEffect(() => {
    void DownloadService.init();
  }, []);

  // Boot the intelligence + engagement layer once, quietly:
  //   • taste model loads its persisted state
  //   • engagement (streaks/XP/badges) subscribes to real listens
  //   • audio effects restore the equalizer/bass/crossfade shape
  //   • smart offline quietly tops up downloads on Wi-Fi (best-effort)
  useEffect(() => {
    void tasteProfile.load();
    engagement.attach();

    void (async () => {
      await AudioFX.load();
      playbackEngine.setCrossfade(AudioFX.getState().crossfade);
    })();

    void DownloadService.smartAutoDownload().catch(() => undefined);
  }, []);

  return (
    <SafeAreaProvider>
      <LibraryProvider>
        <PlayerProvider>
          <View style={styles.webWrapper}>
            <View style={styles.appContainer}>
              <RootNavigator />
              <StatusBar style="light" />
            </View>
          </View>
        </PlayerProvider>
      </LibraryProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  webWrapper: {
    flex: 1,
    backgroundColor: '#000000', // Darker background for the empty space on desktop
    alignItems: 'center',
    justifyContent: 'center',
  },
  appContainer: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 420 : '100%',
    maxHeight: Platform.OS === 'web' ? 900 : '100%',
    backgroundColor: COLORS.background,
    overflow: 'hidden',
    // Add subtle borders and rounded corners to look like a phone screen on Web
    borderWidth: Platform.OS === 'web' ? 1 : 0,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: Platform.OS === 'web' ? 40 : 0,
  }
});
