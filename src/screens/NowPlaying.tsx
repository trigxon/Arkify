import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronDown,
  Heart,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
  Shuffle,
  Share,
  Mic,
  AudioLines,
  Timer,
  ListMusic,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SIZES, FONTS, TYPE, SHADOWS } from '../constants/theme';
import { SeekBar } from '../components/player/SeekBar';
import { QueueSheet } from '../components/player/QueueSheet';
import { TrackActionsSheet } from '../components/lists/TrackActionsSheet';
import { Artwork } from '../components/common/Artwork';
import { DownloadService } from '../services/DownloadService';
import { LyricsService, Lyrics } from '../services/LyricsService';
import { SleepTimer } from '../services/SleepTimerService';
import { Track } from '../core/types';
import { usePlayer, useProgress } from '../hooks/usePlayer';
import { useLibrary } from '../hooks/useLibrary';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

/** Tactile press: quick scale-down, spring back. Short and interruptible. */
function usePressScale() {
  const value = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.spring(value, { toValue: 0.92, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
  const onPressOut = () => Animated.spring(value, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  return { animatedStyle: { transform: [{ scale: value }] }, onPressIn, onPressOut };
}

// ---------------------------------------------------------------------------
// Lyrics view — the reference's focused lyrics layout with Lyrics/About tabs
// ---------------------------------------------------------------------------

const LyricsView: React.FC<{
  track: Track;
  lyrics: Lyrics | null;
  loading: boolean;
}> = ({ track, lyrics, loading }) => {
  const { position, duration } = useProgress();
  const scrollRef = useRef<ScrollView>(null);
  const activeIndexRef = useRef(-1);

  const activeIndex = useMemo(
    () => (lyrics?.synced ? LyricsService.activeLineIndex(lyrics, position) : -1),
    [lyrics, Math.floor(position * 2)] // twice a second is plenty for line highlight
  );

  // Keep the active line centred. Runs only when the line actually changes.
  useEffect(() => {
    if (activeIndex < 0 || activeIndex === activeIndexRef.current) return;
    activeIndexRef.current = activeIndex;
    scrollRef.current?.scrollTo({ y: Math.max(0, activeIndex * 44 - 140), animated: true });
  }, [activeIndex]);

  return (
    <View style={styles.lyricsWrap}>
      {/* Track header: small artwork + title/artist, per the reference. */}
      <View style={styles.lyricsHeader}>
        <Artwork uri={track.albumImageUrl} size={44} radius={10} />
        <View style={styles.lyricsHeaderText}>
          <Text style={styles.lyricsTitle} numberOfLines={1}>{track.title}</Text>
          <Text style={styles.lyricsArtist} numberOfLines={1}>{track.artist.name}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.lyricsLoading}>
          <ActivityIndicator color={COLORS.text.muted} />
        </View>
      ) : !lyrics || lyrics.lines.length === 0 ? (
        <View style={styles.lyricsEmpty}>
          <AudioLines color={COLORS.text.muted} size={SIZES.icon.lg} />
          <Text style={styles.lyricsEmptyTitle}>No lyrics available</Text>
          <Text style={styles.lyricsEmptyHint}>
            Lyrics aren't set up for this track. Playback is unaffected.
          </Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.lyricsScroll}
          contentContainerStyle={styles.lyricsContent}
          showsVerticalScrollIndicator={false}
        >
          {lyrics.lines.map((line, i) => (
            <Text
              key={i}
              style={[
                styles.lyricLine,
                lyrics.synced && i === activeIndex && styles.lyricLineActive,
                lyrics.synced && i !== activeIndex && styles.lyricLineDim,
              ]}
            >
              {line.text || ' '}
            </Text>
          ))}
          <Text style={styles.lyricsSource}>
            {lyrics.source}
            {lyrics.synced ? ' · synced' : ''}
          </Text>
        </ScrollView>
      )}
    </View>
  );
};

// ---------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------

export default function NowPlayingScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const {
    currentTrack,
    isPlaying,
    togglePlayPause,
    isLoading,
    isBuffering,
    error,
    retry,
    seekTo,
    seekBy,
    next,
    previous,
    shuffle,
    toggleShuffle,
    repeat,
    cycleRepeat,
    queue,
    upcoming,
    queueContext,
    jumpTo,
    removeFromQueue,
    reorderUpcomingInQueue,
    clearQueue,
    canPlayCurrent,
  } = usePlayer();

  const { isLiked, toggleLike } = useLibrary();
  const [view, setView] = useState<'player' | 'lyrics' | 'about'>('player');
  const [showQueue, setShowQueue] = useState(false);
  const [actionsTrack, setActionsTrack] = useState<Track | null>(null);

  // Lyrics: fetched for the current track from whatever provider the app
  // ships with (none by default — the UI shows the graceful empty state).
  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);

  useEffect(() => {
    if (!currentTrack) return;
    let cancelled = false;
    setLyrics(null);
    setLyricsLoading(true);
    LyricsService.get(currentTrack)
      .then((result) => {
        if (!cancelled) setLyrics(result);
      })
      .finally(() => {
        if (!cancelled) setLyricsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentTrack?.id]);

  // Sleep timer: wired here so the action sheet's picker controls real
  // playback pause through the app's own play/pause path.
  const handleSleepTimer = useCallback(
    (minutes: number | null) => {
      if (minutes === null) {
        SleepTimer.cancel();
        return;
      }
      SleepTimer.start(minutes, () => {
        // Fires through the same toggle used by the play button, so the UI,
        // notification controls and engine state all stay in sync.
        if (isPlaying) togglePlayPause();
      });
      Alert.alert('Sleep timer', `Playback will pause in ${minutes} minutes.`);
    },
    [isPlaying, togglePlayPause]
  );

  const play = usePressScale();

  if (!currentTrack) return null;

  const liked = isLiked(currentTrack.id);
  const busy = isLoading || isBuffering;

  /** Artist/album lookup: real search navigation, same as Library rows. */
  const goToString = (q: string) => {
    setShowQueue(false);
    setActionsTrack(null);
    navigation.goBack();
    navigation.navigate('Main' as never);
    // SearchTab picks up browseQuery params from other screens; run the
    // lookup through the same route param Home's chips use.
    setTimeout(() => {
      (navigation.navigate as (name: string, params?: object) => void)('SearchTab', {
        browseQuery: q,
      });
    }, 80);
  };

  return (
    <View style={styles.container}>
      {/* Background artwork blur — the track colours the room. */}
      <Image
        source={{ uri: currentTrack.albumImageUrl }}
        style={StyleSheet.absoluteFill}
        blurRadius={100}
      />
      <LinearGradient
        colors={['rgba(6, 8, 8, 0.55)', COLORS.background]}
        locations={[0, 0.72]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom + SIZES.md }]}>

        {/* Header: collapse · Playing from · actions */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerIcon}
            accessibilityRole="button"
            accessibilityLabel="Close player"
          >
            <ChevronDown color={COLORS.text.primary} size={SIZES.icon.xl} />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerSub}>PLAYING FROM</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {queueContext || 'Audia'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => {
              void DownloadService.shareTrack(currentTrack);
            }}
            accessibilityRole="button"
            accessibilityLabel="Share track"
          >
            <Share color={COLORS.text.primary} size={SIZES.icon.md} />
          </TouchableOpacity>
        </View>

        {view === 'player' ? (
          <>
            {/* Artwork hero */}
            <View style={styles.artworkGlowWrap}>
              <View style={styles.artworkGlow} />
              <View style={[styles.artworkContainer, SHADOWS.artwork]}>
                <Artwork uri={currentTrack.albumImageUrl} size={width - SIZES.lg * 2} radius={SIZES.radius.xl} />
              </View>
            </View>

            {/* Track Info */}
            <View style={styles.infoContainer}>
              <View style={styles.textInfo}>
                <Text style={styles.trackTitle} numberOfLines={1}>{currentTrack.title}</Text>
                <Text style={styles.trackArtist} numberOfLines={1}>{currentTrack.artist.name}</Text>
              </View>
              <TouchableOpacity
                onPress={() => toggleLike(currentTrack)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={liked ? 'Remove from liked songs' : 'Add to liked songs'}
                accessibilityState={{ selected: liked }}
              >
                <Heart
                  color={liked ? COLORS.accent.primary : COLORS.text.primary}
                  fill={liked ? COLORS.accent.primary : 'transparent'}
                  size={SIZES.icon.lg + 2}
                />
              </TouchableOpacity>
            </View>

            {/* Progress. SeekBar owns its own measurement, gesture handling and
                position subscription, so this screen no longer re-renders on every
                playback tick. */}
            <SeekBar onSeek={seekTo} />

            {/* Error state -- never leaves the player stuck */}
            {error && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={retry}
                style={styles.errorBanner}
                accessibilityRole="button"
                accessibilityLabel={`Playback error: ${error}. Tap to retry.`}
              >
                <Text style={styles.errorText} numberOfLines={2}>{error}</Text>
                <Text style={styles.errorHint}>Tap to retry</Text>
              </TouchableOpacity>
            )}

            {/* Relative seek, mirroring the lock-screen +/-10s buttons. */}
            <View style={styles.seekRow}>
              <TouchableOpacity
                style={styles.seekButton}
                onPress={() => seekBy(-10)}
                accessibilityRole="button"
                accessibilityLabel="Back 10 seconds"
              >
                <Text style={styles.seekLabel}>-10s</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.seekButton}
                onPress={() => seekBy(10)}
                accessibilityRole="button"
                accessibilityLabel="Forward 10 seconds"
              >
                <Text style={styles.seekLabel}>+10s</Text>
              </TouchableOpacity>
            </View>

            {/* Main Controls */}
            <View style={styles.controlsContainer}>
              <TouchableOpacity
                onPress={toggleShuffle}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={shuffle ? 'Shuffle on' : 'Shuffle off'}
                accessibilityState={{ selected: shuffle }}
              >
                <Shuffle color={shuffle ? COLORS.accent.primary : COLORS.text.secondary} size={SIZES.icon.md + 2} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={previous}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Previous track"
              >
                <SkipBack color={COLORS.text.primary} size={SIZES.icon.xl} />
              </TouchableOpacity>
              <Animated.View style={[play.animatedStyle, styles.playButtonWrap]}>
                <TouchableOpacity
                  style={styles.playButton}
                  onPress={togglePlayPause}
                  onPressIn={play.onPressIn}
                  onPressOut={play.onPressOut}
                  activeOpacity={1}
                  accessibilityRole="button"
                  accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
                >
                  {busy ? (
                    <ActivityIndicator color="#04211D" />
                  ) : isPlaying ? (
                    <Pause color="#04211D" size={SIZES.icon.play} fill="#04211D" />
                  ) : (
                    <Play color="#04211D" size={SIZES.icon.play} fill="#04211D" />
                  )}
                </TouchableOpacity>
              </Animated.View>
              <TouchableOpacity
                onPress={next}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Next track"
              >
                <SkipForward color={COLORS.text.primary} size={SIZES.icon.xl} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={cycleRepeat}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={`Repeat mode: ${repeat === 'off' ? 'off' : repeat === 'all' ? 'repeat all' : 'repeat one'}`}
                accessibilityState={{ selected: repeat !== 'off' }}
              >
                {repeat === 'one' ? (
                  <Repeat1 color={COLORS.accent.primary} size={SIZES.icon.md + 2} />
                ) : (
                  <Repeat
                    color={repeat === 'all' ? COLORS.accent.primary : COLORS.text.secondary}
                    size={SIZES.icon.md + 2}
                  />
                )}
              </TouchableOpacity>
            </View>

            {/* Bottom actions: Lyrics (pill, per reference) + queue + timer */}
            <View style={styles.bottomActions}>
              <TouchableOpacity
                style={styles.lyricsPill}
                onPress={() => setView('lyrics')}
                accessibilityRole="button"
                accessibilityLabel="Open lyrics"
              >
                <Mic color={COLORS.accent.primary} size={SIZES.icon.sm + 2} />
                <Text style={styles.lyricsPillText}>Lyrics</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActionsTrack(currentTrack)}
                accessibilityRole="button"
                accessibilityLabel="More actions"
              >
                <Timer color={COLORS.text.secondary} size={SIZES.icon.md} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowQueue(true)}
                accessibilityRole="button"
                accessibilityLabel="Show queue"
              >
                <ListMusic
                  color={showQueue ? COLORS.accent.primary : COLORS.text.secondary}
                  size={SIZES.icon.md}
                />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            {/* Lyrics/About tabs, per the reference. About carries the real
                album metadata — never invented content. */}
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tabChip, view === 'lyrics' && styles.tabChipActive]}
                activeOpacity={0.8}
                onPress={() => setView('lyrics')}
                accessibilityRole="tab"
                accessibilityState={{ selected: view === 'lyrics' }}
                accessibilityLabel="Lyrics tab"
              >
                <Text style={[styles.tabText, view === 'lyrics' && styles.tabTextActive]}>
                  Lyrics
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabChip, view === 'about' && styles.tabChipActive]}
                activeOpacity={0.8}
                onPress={() => setView('about')}
                accessibilityRole="tab"
                accessibilityState={{ selected: view === 'about' }}
                accessibilityLabel="About tab"
              >
                <Text style={[styles.tabText, view === 'about' && styles.tabTextActive]}>
                  About
                </Text>
              </TouchableOpacity>
            </View>

            {view === 'lyrics' ? (
              <LyricsView track={currentTrack} lyrics={lyrics} loading={lyricsLoading} />
            ) : (
              <View style={styles.aboutWrap}>
                <View style={styles.aboutArtwork}>
                  <Artwork uri={currentTrack.albumImageUrl} size={148} radius={SIZES.radius.lg} />
                </View>
                <Text style={styles.aboutTitle} numberOfLines={2}>{currentTrack.title}</Text>
                <Text style={styles.aboutArtist} numberOfLines={1}>{currentTrack.artist.name}</Text>
                {currentTrack.album ? (
                  <View style={styles.aboutRow}>
                    <Text style={styles.aboutLabel}>ALBUM</Text>
                    <Text style={styles.aboutValue} numberOfLines={1}>{currentTrack.album}</Text>
                  </View>
                ) : null}
                <View style={styles.aboutRow}>
                  <Text style={styles.aboutLabel}>SOURCE</Text>
                  <Text style={styles.aboutValue}>{currentTrack.provider}</Text>
                </View>
                <View style={styles.aboutRow}>
                  <Text style={styles.aboutLabel}>DURATION</Text>
                  <Text style={styles.aboutValue}>
                    {currentTrack.duration > 0
                      ? `${Math.round(currentTrack.duration / 60)} min`
                      : '—'}
                  </Text>
                </View>
              </View>
            )}

            {/* Progress + controls stay available beneath the lyrics, per the
                reference: lyrics never trap the player. */}
            <SeekBar onSeek={seekTo} />
            <View style={styles.controlsContainer}>
              <TouchableOpacity onPress={previous} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button" accessibilityLabel="Previous track">
                <SkipBack color={COLORS.text.primary} size={SIZES.icon.xl} />
              </TouchableOpacity>
              <Animated.View style={[play.animatedStyle, styles.playButtonWrap]}>
                <TouchableOpacity
                  style={styles.playButton}
                  onPress={togglePlayPause}
                  onPressIn={play.onPressIn}
                  onPressOut={play.onPressOut}
                  activeOpacity={1}
                  accessibilityRole="button"
                  accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
                >
                  {busy ? (
                    <ActivityIndicator color="#04211D" />
                  ) : isPlaying ? (
                    <Pause color="#04211D" size={SIZES.icon.play} fill="#04211D" />
                  ) : (
                    <Play color="#04211D" size={SIZES.icon.play} fill="#04211D" />
                  )}
                </TouchableOpacity>
              </Animated.View>
              <TouchableOpacity onPress={next} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button" accessibilityLabel="Next track">
                <SkipForward color={COLORS.text.primary} size={SIZES.icon.xl} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* Queue sheet */}
      <QueueSheet
        visible={showQueue}
        onClose={() => setShowQueue(false)}
        queue={queue}
        currentTrack={currentTrack}
        context={queueContext}
        upcoming={upcoming}
        onJumpTo={jumpTo}
        onRemove={removeFromQueue}
        onReorder={reorderUpcomingInQueue}
        onClear={clearQueue}
      />

      {/* Action sheet (reference composition) */}
      <TrackActionsSheet
        track={actionsTrack}
        onClose={() => setActionsTrack(null)}
        onGoToArtist={(t) => goToString(t.artist.name)}
        onViewAlbum={(t) => goToString(`${t.album} ${t.artist.name}`)}
        onSleepTimer={handleSleepTimer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: SIZES.lg,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.md,
  },
  headerIcon: {
    padding: SIZES.xs,
    minHeight: SIZES.touchTarget,
    justifyContent: 'center',
  },
  headerTextContainer: {
    alignItems: 'center',
  },
  headerSub: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.overline.fontSize,
    letterSpacing: 2,
    color: COLORS.text.muted,
    marginBottom: 2,
  },
  headerTitle: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.subheadline.fontSize,
    color: COLORS.text.primary,
  },
  artworkGlowWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SIZES.md,
  },
  artworkGlow: {
    position: 'absolute',
    width: width - SIZES.lg * 2 + 56,
    height: width - SIZES.lg * 2 + 56,
    borderRadius: (width - SIZES.lg * 2 + 56) / 2,
    backgroundColor: COLORS.accent.glow,
  },
  artworkContainer: {
    width: width - SIZES.lg * 2,
    height: width - SIZES.lg * 2,
    borderRadius: SIZES.radius.xl,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  infoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SIZES.xl,
    marginBottom: SIZES.lg,
  },
  textInfo: {
    flex: 1,
    paddingRight: SIZES.md,
  },
  trackTitle: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.title2.fontSize,
    lineHeight: TYPE.title2.lineHeight,
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  trackArtist: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.body.fontSize,
    color: COLORS.text.secondary,
  },
  seekRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SIZES.xxl,
    marginBottom: SIZES.md,
  },
  seekButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.xs,
    paddingVertical: SIZES.xs,
    paddingHorizontal: SIZES.sm,
    minHeight: SIZES.touchTarget - 8,
    justifyContent: 'center',
    borderRadius: SIZES.radius.pill,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.hairline,
  },
  seekLabel: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.secondary,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.xl,
    paddingHorizontal: SIZES.sm,
  },
  playButtonWrap: {},
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.accent.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: COLORS.accent.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
  },
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.sm,
    marginBottom: SIZES.md,
  },
  lyricsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm + 2,
    paddingHorizontal: SIZES.lg,
    height: 44,
    borderRadius: SIZES.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(61, 214, 195, 0.35)',
    backgroundColor: COLORS.accent.soft,
  },
  lyricsPillText: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.accent.primary,
  },
  tabRow: {
    flexDirection: 'row',
    gap: SIZES.sm,
    marginBottom: SIZES.lg,
  },
  tabChip: {
    flex: 1,
    height: 44,
    borderRadius: SIZES.radius.pill,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabChipActive: {
    borderColor: COLORS.accent.primary,
    backgroundColor: COLORS.accent.soft,
  },
  tabText: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.secondary,
  },
  tabTextActive: {
    color: COLORS.accent.primary,
  },
  lyricsWrap: {
    flex: 1,
    minHeight: 0,
  },
  aboutWrap: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
    paddingTop: SIZES.sm,
  },
  aboutArtwork: {
    marginBottom: SIZES.lg,
  },
  aboutTitle: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.title3.fontSize,
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  aboutArtist: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.subheadline.fontSize,
    color: COLORS.text.secondary,
    marginTop: 2,
    marginBottom: SIZES.lg,
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: SIZES.radius.md,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm + 2,
    marginBottom: SIZES.sm,
  },
  aboutLabel: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.overline.fontSize,
    letterSpacing: 2,
    color: COLORS.text.muted,
  },
  aboutValue: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.primary,
    textAlign: 'right',
    marginLeft: SIZES.md,
  },
  lyricsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.md,
    marginBottom: SIZES.md,
  },
  lyricsHeaderText: {
    flex: 1,
  },
  lyricsTitle: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.headline.fontSize,
    color: COLORS.text.primary,
  },
  lyricsArtist: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.subheadline.fontSize,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  lyricsScroll: {
    flex: 1,
  },
  lyricsContent: {
    paddingBottom: SIZES.xl,
  },
  lyricLine: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.title3.fontSize,
    lineHeight: 44,
    color: COLORS.text.primary,
  },
  lyricLineActive: {
    color: COLORS.text.primary,
  },
  lyricLineDim: {
    color: 'rgba(244, 244, 242, 0.38)',
  },
  lyricsSource: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.micro.fontSize,
    color: COLORS.text.muted,
    marginTop: SIZES.md,
  },
  lyricsLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lyricsEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SIZES.xl,
  },
  lyricsEmptyTitle: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.primary,
    marginTop: SIZES.md,
  },
  lyricsEmptyHint: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.muted,
    textAlign: 'center',
    marginTop: SIZES.xs,
    lineHeight: 18,
  },
  errorBanner: {
    backgroundColor: COLORS.status.errorGlow,
    borderRadius: SIZES.radius.sm,
    borderWidth: 1,
    borderColor: COLORS.status.error,
    padding: SIZES.sm,
    marginBottom: SIZES.md,
  },
  errorText: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.subheadline.fontSize,
    color: COLORS.text.primary,
  },
  errorHint: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.micro.fontSize,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
});
