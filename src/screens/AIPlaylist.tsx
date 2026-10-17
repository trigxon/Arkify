import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import {
  ArrowLeft,
  BookmarkPlus,
  Check,
  Play,
  Shuffle,
  Sparkles,
  Wand2,
} from 'lucide-react-native';
import { COLORS, SIZES, FONTS, TYPE, SHADOWS } from '../constants/theme';
import { SpringPressable, FadeInUp, GlassView, PulsingGlow } from '../components/common/Glass';
import { ErrorState } from '../components/common/UI';
import { TrackRow } from '../components/lists/TrackRow';
import { TrackActionsHost } from '../components/lists/TrackActionsHost';
import { Track } from '../core/types';
import { MiniPlayer } from '../components/player/MiniPlayer';
import { StatusBarScrim } from '../components/common/StatusBarScrim';
import { usePlayer } from '../hooks/usePlayer';
import { useLibrary } from '../hooks/useLibrary';
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

const DEFAULT_MIX_TITLE = 'Arkify AI Mix';

/**
 * AIPlaylist — "Ask Arkify AI".
 *
 * Type a vibe, get a playlist. Arkify AI plans the queries (Gemini backs the
 * planner when a key is set); the on-device planner handles it otherwise.
 * Either way the results are ranked through the listener's taste model, and
 * one tap saves the mix to the library.
 */
/** Fisher-Yates — unbiased shuffle (matches playback/queue.ts). */
function shuffled<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export default function AIPlaylistScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { playTrack, isLoading, currentTrack, isPlaying, togglePlayPause } = usePlayer();
  const { createPlaylist } = useLibrary();

  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [actionsTrack, setActionsTrack] = useState<Track | null>(null);
  const [planTitle, setPlanTitle] = useState('');
  const [planSource, setPlanSource] = useState<'gemini' | 'on-device' | null>(null);
  const [geminiReady, setGeminiReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Never touch state after unmount (slow AI calls can outlive the screen).
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    void isGeminiConfigured().then((ok) => {
      if (alive.current) setGeminiReady(ok);
    });
    return () => {
      alive.current = false;
    };
  }, []);

  const generate = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || loading) return;

      setLoading(true);
      setTracks([]);
      setPlanTitle('');
      setPlanSource(null);
      setError(null);
      setSaved(false);
      try {
        const { plan, tracks: result } = await recommendationEngine.generateFromPrompt(q);
        if (!alive.current) return;
        setTracks(result);
        setPlanTitle(plan.title);
        setPlanSource(plan.source);
        if (!result.length) {
          setError('No tracks matched that vibe. Try a different wording.');
        }
        engagement.markAIUsed();
      } catch {
        if (!alive.current) return;
        setTracks([]);
        setError("Arkify AI couldn't reach the music service. Check your connection and retry.");
      } finally {
        if (alive.current) setLoading(false);
      }
    },
    [loading]
  );

  const mixLabel = planTitle || DEFAULT_MIX_TITLE;

  const saveMix = useCallback(() => {
    if (!tracks.length || saved) return;
    createPlaylist(mixLabel, tracks);
    setSaved(true);
  }, [tracks, saved, createPlaylist, mixLabel]);

  const canPlay = tracks.length > 0;

  return (
    <View style={styles.container}>
      <StatusBarScrim />
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
        <Text style={styles.headerTitle}>Arkify AI</Text>
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
            <Wand2 color={COLORS.accent.primary} size={32} />
          </View>
          <Text style={styles.heroTitle}>Describe a vibe.</Text>
          <Text style={styles.heroSub}>
            Arkify AI will build the playlist —{'\n'}
            {geminiReady ? 'cloud planner on, expect magic.' : 'planning on-device, fully private.'}
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
            accessibilityLabel="Describe the mix you want"
          />
          <SpringPressable
            style={[styles.goBtn, (!prompt.trim() || loading) && styles.goBtnDisabled]}
            pressScale={0.92}
            glow
            onPress={() => void generate(prompt)}
            accessibilityRole="button"
            accessibilityLabel="Generate playlist"
            accessibilityState={{ busy: loading }}
            aria-busy={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={COLORS.text.dark} />
            ) : (
              <Sparkles color={COLORS.text.dark} size={18} />
            )}
          </SpringPressable>
        </View>

        {/* Ideas */}
        {!tracks.length && !loading && !error ? (
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
            <PulsingGlow size={120} color="rgba(59, 240, 223, 0.12)" style={styles.generatingGlow} />
            <ActivityIndicator color={COLORS.accent.primary} size="large" />
            <Text style={styles.generatingText}>Arkify AI is reading your taste...</Text>
            <Text style={styles.generatingSub}>picking, ranking, sequencing</Text>
          </View>
        ) : null}

        {/* Failure — visible, retryable, never a silent reset */}
        {!loading && error ? (
          <FadeInUp>
            <ErrorState
              message={error}
              retryLabel={prompt.trim() ? 'Retry' : undefined}
              onRetry={prompt.trim() ? () => void generate(prompt) : undefined}
            />
          </FadeInUp>
        ) : null}

        {/* Results */}
        {canPlay ? (
          <>
            <FadeInUp index={0} preset="fast">
              <GlassView weight="thin" style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <View style={styles.resultTextWrap}>
                    <Text style={styles.resultTitle} numberOfLines={2}>
                      {mixLabel}
                    </Text>
                    <Text style={styles.resultMeta}>
                      {tracks.length} tracks ·{' '}
                      {planSource === 'gemini' ? 'Arkify AI · cloud plan' : 'Arkify AI · on-device'} ·
                      taste-ranked
                    </Text>
                  </View>
                  <SpringPressable
                    style={styles.playBtn}
                    pressScale={0.9}
                    glow
                    onPress={() => playTrack(tracks[0], { tracks, label: mixLabel })}
                    accessibilityRole="button"
                    accessibilityLabel="Play mix"
                  >
                    <Play color={COLORS.text.dark} size={20} fill={COLORS.text.dark} />
                  </SpringPressable>
                </View>

                <View style={styles.resultActions}>
                  <SpringPressable
                    style={[styles.resultActionBtn, styles.resultActionPrimary]}
                    pressScale={0.94}
                    onPress={() =>
                      playTrack(tracks[0], {
                        tracks: shuffled(tracks),
                        label: mixLabel,
                      })
                    }
                    accessibilityRole="button"
                    accessibilityLabel="Shuffle play mix"
                  >
                    <Shuffle color={COLORS.accent.primary} size={16} />
                    <Text style={[styles.resultActionText, styles.resultActionTextAccent]}>
                      Shuffle
                    </Text>
                  </SpringPressable>
                  <SpringPressable
                    style={[styles.resultActionBtn, saved && styles.resultActionSaved]}
                    pressScale={0.94}
                    onPress={saveMix}
                    disabled={saved}
                    accessibilityRole="button"
                    accessibilityLabel={saved ? 'Mix saved to library' : 'Save mix to library'}
                  >
                    {saved ? (
                      <Check color={COLORS.accent.primary} size={16} />
                    ) : (
                      <BookmarkPlus color={COLORS.text.primary} size={16} />
                    )}
                    <Text style={styles.resultActionText}>{saved ? 'Saved' : 'Save'}</Text>
                  </SpringPressable>
                </View>
              </GlassView>
            </FadeInUp>

            {tracks.map((track, i) => (
              <FadeInUp key={track.id} index={Math.min(i, 6) + 1} preset="fast">
                <TrackRow
                  track={track}
                  onPress={(t) => playTrack(t, { tracks, label: mixLabel })}
                  onMorePress={setActionsTrack}
                />
              </FadeInUp>
            ))}
          </>
        ) : null}
      </ScrollView>

      <TrackActionsHost track={actionsTrack} onClose={() => setActionsTrack(null)} />

      {currentTrack ? (
        <MiniPlayer
          track={currentTrack}
          isPlaying={isPlaying}
          isLoading={isLoading}
          onPlayPause={togglePlayPause}
          onPress={() => navigation.navigate('NowPlaying' as never)}
          tabBarHeight={0}
        />
      ) : null}
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
    fontSize: TYPE.title2.fontSize,
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
    textAlign: 'center',
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
    gap: SIZES.sm,
  },
  generatingGlow: {
    position: 'absolute',
    top: SIZES.xl - 10,
  },
  generatingText: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.primary,
    marginTop: SIZES.xs,
  },
  generatingSub: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.muted,
  },

  resultCard: {
    padding: SIZES.md,
    marginBottom: SIZES.md,
    marginTop: SIZES.sm,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultTextWrap: {
    flex: 1,
    marginRight: SIZES.md,
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
  resultActions: {
    flexDirection: 'row',
    gap: SIZES.sm,
    marginTop: SIZES.md,
  },
  resultActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    backgroundColor: COLORS.surface,
  },
  resultActionPrimary: {
    borderColor: COLORS.accent.border,
    backgroundColor: COLORS.accent.soft,
  },
  resultActionSaved: {
    borderColor: COLORS.accent.border,
  },
  resultActionText: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.primary,
  },
  resultActionTextAccent: {
    color: COLORS.accent.primary,
  },
});
