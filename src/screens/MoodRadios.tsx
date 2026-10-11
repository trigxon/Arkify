import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Play, Radio, Shuffle } from 'lucide-react-native';
import { COLORS, SIZES, FONTS, TYPE, SHADOWS, MOOD_PALETTE, MoodId } from '../constants/theme';
import { SpringPressable, FadeInUp, GlassView } from '../components/common/Glass';
import { TrackRow } from '../components/lists/TrackRow';
import { Track } from '../core/types';
import { usePlayer } from '../hooks/usePlayer';
import { recommendationEngine } from '../ai/RecommendationEngine';
import { MOODS, moodById } from '../ai/moods';
import { engagement } from '../engagement/Streaks';

/**
 * MoodRadios — one screen, two modes:
 *
 *   • no params: the grid of all mood radios
 *   • { moodId }: the radio itself — an endless mix generated from the
 *     listener's taste model, biased by the mood's keyword/duration program.
 *
 * "Refresh" re-rolls the pool; "Shuffle" reorders what's already here.
 */
export default function MoodRadiosScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<{ key: string; name: string; params?: { moodId?: MoodId } }>();
  const { playTrack } = usePlayer();

  const initialMood = route.params?.moodId ?? null;
  const [activeMood, setActiveMood] = useState<MoodId | null>(initialMood);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [excludeIds, setExcludeIds] = useState<Set<string>>(new Set());

  const mood = useMemo(() => (activeMood ? moodById(activeMood) : null), [activeMood]);

  const loadRadio = useCallback(
    async (moodId: MoodId, exclude: Set<string>) => {
      setLoading(true);
      setError(null);
      try {
        const radio = await recommendationEngine.generateRadio(moodId, {
          excludeIds: exclude,
          size: 30,
        });
        setTracks(radio.tracks);
        engagement.markAIUsed();
      } catch {
        setError('The radio signal dropped. Try again.');
        setTracks([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (activeMood) void loadRadio(activeMood, excludeIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMood]);

  const openMood = useCallback(
    (id: MoodId) => {
      setActiveMood(id);
      setTracks([]);
      setExcludeIds(new Set());
    },
    []
  );

  const refresh = useCallback(() => {
    if (!activeMood) return;
    const nextExclude = new Set([...excludeIds, ...tracks.map((t) => t.id)]);
    setExcludeIds(nextExclude);
    void loadRadio(activeMood, nextExclude);
  }, [activeMood, excludeIds, tracks, loadRadio]);

  const shuffleInPlace = useCallback(() => {
    setTracks((prev) => {
      const out = [...prev];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    });
  }, []);

  // ------------------------- radio view -------------------------
  if (mood) {
    const palette = MOOD_PALETTE[mood.id];
    return (
      <View style={styles.container}>
        {/* Mood hero */}
        <View style={styles.hero}>
          <LinearGradient
            colors={palette.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(12,15,15,0.25)', 'rgba(12,15,15,0.9)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.heroInner, { paddingTop: insets.top + SIZES.lg }]}>
            <View style={styles.heroTop}>
              <SpringPressable
                style={styles.backBtnLight}
                pressScale={0.9}
                onPress={() => {
                  if (initialMood) navigation.goBack();
                  else setActiveMood(null);
                }}
                accessibilityRole="button"
                accessibilityLabel="Back"
              >
                <ArrowLeft color="#FFFFFF" size={SIZES.icon.md} />
              </SpringPressable>
              <View style={styles.heroBadge}>
                <Radio color="#FFFFFF" size={12} />
                <Text style={styles.heroBadgeText}>LIVE RADIO</Text>
              </View>
              <View style={{ width: 38 }} />
            </View>

            <Text style={styles.heroTitle}>{mood.name}</Text>
            <Text style={styles.heroSub}>{mood.tagline}</Text>

            <View style={styles.heroActions}>
              <SpringPressable
                style={styles.playBtn}
                pressScale={0.93}
                onPress={() => tracks.length && playTrack(tracks[0], { tracks, label: `${mood.name} Radio` })}
                accessibilityRole="button"
                accessibilityLabel="Play radio"
              >
                <Play color={COLORS.text.dark} size={18} fill={COLORS.text.dark} />
                <Text style={styles.playBtnText}>Start radio</Text>
              </SpringPressable>
              <SpringPressable
                style={styles.iconAction}
                pressScale={0.9}
                onPress={shuffleInPlace}
                accessibilityRole="button"
                accessibilityLabel="Shuffle"
              >
                <Shuffle color="#FFFFFF" size={17} />
              </SpringPressable>
              <SpringPressable
                style={styles.iconAction}
                pressScale={0.9}
                onPress={refresh}
                accessibilityRole="button"
                accessibilityLabel="Refresh mix"
              >
                <Text style={styles.refreshText}>↻</Text>
              </SpringPressable>
            </View>
          </View>
        </View>

        {/* Tracks */}
        <ScrollView
          contentContainerStyle={[styles.list, { paddingBottom: SIZES.bottomInset }]}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loadingBlock}>
              <ActivityIndicator color={COLORS.accent.primary} size="large" />
              <Text style={styles.loadingText}>Reading your taste, tuning the dial...</Text>
            </View>
          ) : error ? (
            <GlassView weight="thin" style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
              <SpringPressable style={styles.retryBtn} onPress={refresh}>
                <Text style={styles.retryText}>Try again</Text>
              </SpringPressable>
            </GlassView>
          ) : (
            tracks.map((track, i) => (
              <FadeInUp key={track.id} index={Math.min(i, 6)} preset="fast">
                <TrackRow
                  track={track}
                  onPress={(t) => playTrack(t, { tracks, label: `${mood.name} Radio` })}
                />
              </FadeInUp>
            ))
          )}

          {!loading && !error && tracks.length ? (
            <SpringPressable style={styles.moreBtn} pressScale={0.97} onPress={refresh}
              accessibilityRole="button" accessibilityLabel="Load more">
              <Text style={styles.moreText}>Keep it going</Text>
            </SpringPressable>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  // ------------------------- grid view -------------------------
  return (
    <View style={styles.container}>
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
        <Text style={styles.headerTitle}>Mood Radios</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.grid, { paddingBottom: SIZES.bottomInset }]}
        showsVerticalScrollIndicator={false}
      >
        {MOODS.map((m, i) => {
          const palette = MOOD_PALETTE[m.id];
          return (
            <FadeInUp key={m.id} index={i} style={styles.gridCell}>
              <SpringPressable
                style={styles.gridCard}
                pressScale={0.95}
                onPress={() => openMood(m.id)}
                accessibilityRole="button"
                accessibilityLabel={`${m.name} radio`}
              >
                <LinearGradient
                  colors={palette.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <LinearGradient
                  colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.5)']}
                  start={{ x: 0.5, y: 0.15 }}
                  end={{ x: 0.5, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.gridTop}>
                  <View style={styles.gridIcon}>
                    <Radio color="#FFFFFF" size={16} />
                  </View>
                </View>
                <View>
                  <Text style={styles.gridName}>{m.name}</Text>
                  <Text style={styles.gridTag} numberOfLines={2}>{m.tagline}</Text>
                </View>
              </SpringPressable>
            </FadeInUp>
          );
        })}
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
  backBtnLight: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.title3.fontSize,
    color: COLORS.text.primary,
  },

  // Radio hero
  hero: {
    paddingBottom: SIZES.lg,
    overflow: 'hidden',
  },
  heroInner: {
    paddingHorizontal: SIZES.gutter,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SIZES.lg,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  heroBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    letterSpacing: 1.5,
    color: '#FFFFFF',
  },
  heroTitle: {
    fontFamily: FONTS.bold,
    fontSize: 34,
    color: '#FFFFFF',
    letterSpacing: -0.8,
  },
  heroSub: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.body.fontSize,
    color: 'rgba(255,255,255,0.82)',
    marginTop: 2,
    marginBottom: SIZES.lg,
  },
  heroActions: {
    flexDirection: 'row',
    gap: SIZES.sm,
  },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 46,
    paddingHorizontal: 22,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
  },
  playBtnText: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.callout.fontSize,
    color: '#101314',
  },
  iconAction: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshText: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: '#FFFFFF',
    marginTop: -2,
  },

  // List
  list: {
    paddingHorizontal: SIZES.gutter,
    paddingTop: SIZES.md,
  },
  loadingBlock: {
    alignItems: 'center',
    paddingVertical: SIZES.xxl,
    gap: SIZES.md,
  },
  loadingText: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.subheadline.fontSize,
    color: COLORS.text.secondary,
  },
  errorCard: {
    padding: SIZES.lg,
    alignItems: 'center',
    gap: SIZES.md,
  },
  errorText: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: COLORS.accent.primary,
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  retryText: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.dark,
  },
  moreBtn: {
    marginTop: SIZES.md,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.primary,
  },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SIZES.md,
    paddingHorizontal: SIZES.gutter,
    paddingTop: SIZES.md,
  },
  gridCell: {
    width: '47.5%',
    flexGrow: 1,
  },
  gridCard: {
    height: 150,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: SIZES.md,
    justifyContent: 'space-between',
    ...SHADOWS.ambient,
  },
  gridTop: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  gridIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridName: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.headline.fontSize,
    color: '#FFFFFF',
  },
  gridTag: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.micro.fontSize,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
});
