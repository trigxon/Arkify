import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Bot, Play, Shuffle, Sparkles } from 'lucide-react-native';
import { COLORS, SIZES, FONTS, TYPE, SHADOWS } from '../constants/theme';
import { SpringPressable, FadeInUp, GlassView, PulsingGlow } from '../components/common/Glass';
import { TrackRow } from '../components/lists/TrackRow';
import { Track } from '../core/types';
import { usePlayer } from '../hooks/usePlayer';
import { recommendationEngine } from '../ai/RecommendationEngine';
import { engagement } from '../engagement/Streaks';
import { isGeminiConfigured } from '../ai/gemini';

const PROMPT_IDEAS = [
  'gym energy, no mercy',
  '3am heartbreak hours',
  'deep focus, zero vocals',
  'sunday morning coffee',
  'punjabi bangers only',
  'rainy window lofi',
  'road trip at sunset',
  'main character energy',
];

/**
 * AIPlaylist — "Ask AI for anything".
 *
 * Type a vibe, get a playlist. Gemini plans the queries when a key is set;
 * the on-device planner handles it otherwise. Either way the results are
 * ranked through the listener's taste model.
 */
export default function AIPlaylistScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { playTrack } = usePlayer();

  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [planTitle, setPlanTitle] = useState('');
  const [planSource, setPlanSource] = useState<'gemini' | 'on-device' | null>(null);
  const [geminiReady, setGeminiReady] = useState(false);

  useEffect(() => {
    void isGeminiConfigured().then(setGeminiReady);
  }, []);

  const generate = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || loading) return;

      setLoading(true);
      setTracks([]);
      setPlanTitle('');
      try {
        const { plan, tracks: result } = await recommendationEngine.generateFromPrompt(q);
        setTracks(result);
        setPlanTitle(plan.title);
        setPlanSource(plan.source);
        engagement.markAIUsed();
      } catch {
        setTracks([]);
      } finally {
        setLoading(false);
      }
    },
    [loading]
  );

  const canPlay = tracks.length > 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SIZES.sm }]}>
        <SpringPressable
          style={styles.backBtn}
          pressScale={0.9}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft color={COLORS.text.primary} size={SIZES.icon.md} />
        </SpringPressable>
        <Text style={styles.headerTitle}>Ask AI</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: SIZES.bottomInset }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero prompt area */}
        <View style={styles.hero}>
          <PulsingGlow size={180} color="rgba(53,214,198,0.14)" style={styles.heroGlow} />
          <View style={styles.heroIcon}>
            <Bot color={COLORS.accent.primary} size={34} />
          </View>
          <Text style={styles.heroTitle}>Describe a vibe.</Text>
          <Text style={styles.heroSub}>
            I'll build the playlist. {geminiReady ? 'Gemini is on — expect magic.' : 'Running on-device.'}
          </Text>
        </View>

        {/* Input */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="e.g. gym energy, no mercy"
            placeholderTextColor={COLORS.text.muted}
            value={prompt}
            onChangeText={setPrompt}
            onSubmitEditing={() => void generate(prompt)}
            returnKeyType="go"
            maxLength={80}
          />
          <SpringPressable
            style={[styles.goBtn, (!prompt.trim() || loading) && styles.goBtnDisabled]}
            pressScale={0.92}
            glow
            onPress={() => void generate(prompt)}
            accessibilityRole="button"
            accessibilityLabel="Generate playlist"
          >
            {loading ? (
              <ActivityIndicator size="small" color={COLORS.text.dark} />
            ) : (
              <Sparkles color={COLORS.text.dark} size={18} />
            )}
          </SpringPressable>
        </View>

        {/* Ideas */}
        {!tracks.length && !loading ? (
          <View style={styles.ideasWrap}>
            <Text style={styles.ideasTitle}>Try one</Text>
            <View style={styles.ideasRow}>
              {PROMPT_IDEAS.map((idea, i) => (
                <FadeInUp key={idea} index={i} preset="fast">
                  <SpringPressable
                    style={styles.ideaChip}
                    pressScale={0.94}
                    onPress={() => {
                      setPrompt(idea);
                      void generate(idea);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Try ${idea}`}
                  >
                    <Text style={styles.ideaText}>{idea}</Text>
                  </SpringPressable>
                </FadeInUp>
              ))}
            </View>
          </View>
        ) : null}

        {/* Generating */}
        {loading ? (
          <View style={styles.generating}>
            <ActivityIndicator color={COLORS.accent.primary} size="large" />
            <Text style={styles.generatingText}>Reading your taste, picking tracks...</Text>
          </View>
        ) : null}

        {/* Results */}
        {canPlay ? (
          <>
            <View style={styles.resultHeader}>
              <View>
                <Text style={styles.resultTitle}>{planTitle || 'Your mix'}</Text>
                <Text style={styles.resultMeta}>
                  {tracks.length} tracks · {planSource === 'gemini' ? 'Gemini plan' : 'On-device plan'} · taste-ranked
                </Text>
              </View>
              <SpringPressable
                style={styles.playBtn}
                pressScale={0.9}
                glow
                onPress={() => playTrack(tracks[0], { tracks, label: planTitle || 'AI Mix' })}
                accessibilityRole="button"
                accessibilityLabel="Play mix"
              >
                <Play color={COLORS.text.dark} size={20} fill={COLORS.text.dark} />
              </SpringPressable>
            </View>

            {tracks.map((track, i) => (
              <FadeInUp key={track.id} index={Math.min(i, 6)} preset="fast">
                <TrackRow
                  track={track}
                  onPress={(t) => playTrack(t, { tracks, label: planTitle || 'AI Mix' })}
                />
              </FadeInUp>
            ))}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.gutter,
    paddingBottom: SIZES.sm,
    zIndex: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.title3.fontSize,
    color: COLORS.text.primary,
  },
  scroll: {
    paddingHorizontal: SIZES.gutter,
    paddingTop: SIZES.md,
  },

  hero: {
    alignItems: 'center',
    paddingVertical: SIZES.xl,
  },
  heroGlow: {
    position: 'absolute',
    top: 10,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.accent.soft,
    borderWidth: 1.5,
    borderColor: COLORS.accent.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SIZES.md,
  },
  heroTitle: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.title2.fontSize,
    color: COLORS.text.primary,
  },
  heroSub: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.subheadline.fontSize,
    color: COLORS.text.secondary,
    marginTop: 4,
  },

  inputRow: {
    flexDirection: 'row',
    gap: SIZES.sm,
    marginBottom: SIZES.lg,
  },
  input: {
    flex: 1,
    height: 52,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: 26,
    paddingHorizontal: 20,
    fontFamily: FONTS.regular,
    fontSize: TYPE.body.fontSize,
    color: COLORS.text.primary,
  },
  goBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.ambient,
  },
  goBtnDisabled: {
    opacity: 0.4,
  },

  ideasWrap: {
    marginBottom: SIZES.lg,
  },
  ideasTitle: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.subheadline.fontSize,
    color: COLORS.text.secondary,
    marginBottom: SIZES.sm + 2,
  },
  ideasRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ideaChip: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  ideaText: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.soft,
  },

  generating: {
    alignItems: 'center',
    paddingVertical: SIZES.xxl,
    gap: SIZES.md,
  },
  generatingText: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.subheadline.fontSize,
    color: COLORS.text.secondary,
  },

  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SIZES.md,
    marginTop: SIZES.sm,
  },
  resultTitle: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.title3.fontSize,
    color: COLORS.text.primary,
  },
  resultMeta: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.muted,
    marginTop: 2,
  },
  playBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
