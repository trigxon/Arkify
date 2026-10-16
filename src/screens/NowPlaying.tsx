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
  useWindowDimensions,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronDown,
  EllipsisVertical,
  Heart,
  MoreHorizontal,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
  Shuffle,
  Share,
  Sparkles,
  AudioLines,
  Timer,
  ListMusic,
  Mic2,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SIZES, FONTS, TYPE, SHADOWS } from '../constants/theme';
import { SeekBar } from '../components/player/SeekBar';
import { QueueSheet } from '../components/player/QueueSheet';
import { TrackActionsSheet } from '../components/lists/TrackActionsSheet';
import { KaraokeLyrics } from '../components/player/KaraokeLyrics';
import { ShareSheet, ShareRequest } from '../components/share/ShareSheet';
import { Artwork } from '../components/common/Artwork';
import { DownloadService } from '../services/DownloadService';
import { LyricsService, Lyrics } from '../services/LyricsService';
import { SleepTimer } from '../services/SleepTimerService';
import { Track } from '../core/types';
import { usePlayer, useProgress } from '../hooks/usePlayer';
import { useLibrary } from '../hooks/useLibrary';
import { useNavigation } from '@react-navigation/native';

/** Tactile press: quick scale-down, spring back. Short and interruptible. */
function usePressScale() {
  const value = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.spring(value, { toValue: 0.92, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
  const onPressOut = () => Animated.spring(value, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  return { animatedStyle: { transform: [{ scale: value }] }, onPressIn, onPressOut };
}

// ---------------------------------------------------------------------------
// Lyrics view — Roman English lines, with a KARAOKE mode when the track is
// synced: line-by-line highlight, spring activations, tap-to-seek.
// ---------------------------------------------------------------------------

const LyricsView: React.FC<{
  track: Track;
  lyrics: Lyrics | null;
  loading: boolean;
  onSeek?: (seconds: number) => void;
  onRetry?: () => void;
  /** Opens the track's action sheet, per the reference's ⋮ affordance. */
  onMore?: () => void;
}> = ({ track, lyrics, loading, onSeek, onRetry, onMore }) => {
  const { position } = useProgress();
  const scrollRef = useRef<ScrollView>(null);
  const activeIndexRef = useRef(-1);
  const [karaoke, setKaraoke] = useState(true);

  const activeIndex = useMemo(
    () => (lyrics?.synced ? LyricsService.activeLineIndex(lyrics, position) : -1),
    [lyrics, Math.floor(position * 2)]
  );

  // Keep the active line centred (plain mode only; karaoke scrolls itself).
  useEffect(() => {
    if (karaoke) return;
    if (activeIndex < 0 || activeIndex === activeIndexRef.current) return;
    activeIndexRef.current = activeIndex;
    scrollRef.current?.scrollTo({ y: Math.max(0, activeIndex * 48 - 130), animated: true });
  }, [activeIndex, karaoke]);

  return (
    <View style={styles.lyricsWrap}>
      {/* Track header: small artwork + title/artist + Roman English pill */}
      <View style={styles.lyricsHeader}>
        <Artwork uri={track.albumImageUrl} size={44} radius={10} />
        <View style={styles.lyricsHeaderText}>
          <Text style={styles.lyricsTitle} numberOfLines={1}>{track.title}</Text>
          <Text style={styles.lyricsArtist} numberOfLines={1}>{track.artist.name}</Text>
        </View>
        {lyrics?.synced ? (
          <TouchableOpacity
            style={[styles.karaokeToggle, karaoke && styles.karaokeToggleOn]}
            onPress={() => setKaraoke((v) => !v)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={karaoke ? 'Switch to plain lyrics' : 'Switch to karaoke'}
          >
            <Mic2 color={karaoke ? COLORS.text.dark : COLORS.accent.primary} size={13} />
            <Text style={[styles.karaokeToggleText, karaoke && styles.karaokeToggleTextOn]}>
              KARAOKE
            </Text>
          </TouchableOpacity>
        ) : null}
        {onMore ? (
          <TouchableOpacity
            style={styles.lyricsMore}
            onPress={onMore}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Track actions"
          >
            <EllipsisVertical color={COLORS.text.primary} size={SIZES.icon.md} />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.lyricsLoading}>
          <ActivityIndicator color={COLORS.accent.primary} size="large" />
          <Text style={styles.lyricsLoadingText}>Loading Roman English lyrics...</Text>
        </View>
      ) : !lyrics || lyrics.lines.length === 0 ? (
        <View style={styles.lyricsEmpty}>
          <AudioLines color={COLORS.text.muted} size={SIZES.icon.lg} />
          <Text style={styles.lyricsEmptyTitle}>Lyrics unavailable</Text>
          <Text style={styles.lyricsEmptyHint}>
            Could not fetch Roman English lyrics for this track right now.
          </Text>
          {onRetry && (
            <TouchableOpacity style={styles.retryLyricsButton} onPress={onRetry}>
              <Text style={styles.retryLyricsText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : lyrics.synced && karaoke ? (
        <KaraokeLyrics lyrics={lyrics} position={position} onSeek={(s) => onSeek?.(s)} />
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.lyricsScroll}
          contentContainerStyle={styles.lyricsContent}
          showsVerticalScrollIndicator={false}
        >
          {lyrics.lines.map((line, i) => {
            const isActive = lyrics.synced && i === activeIndex;
            return (
              <TouchableOpacity
                key={i}
                activeOpacity={0.75}
                disabled={!lyrics.synced || line.time === undefined || !onSeek}
                onPress={() => {
                  if (line.time !== undefined && onSeek) {
                    onSeek(line.time);
                  }
                }}
                style={styles.lyricLineRow}
              >
                <Text
                  style={[
                    styles.lyricLine,
                    isActive && styles.lyricLineActive,
                    lyrics.synced && !isActive && styles.lyricLineDim,
                  ]}
                >
                  {line.text || ' '}
                </Text>
              </TouchableOpacity>
            );
          })}
          <View style={styles.lyricsFooter}>
            <Text style={styles.lyricsSource}>
              {lyrics.source}
              {lyrics.synced ? ' · Live Synced' : ''} · Roman English
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

// ---------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------

export default function NowPlayingScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const {
    currentTrack,
    isPlaying,
    togglePlayPause,
    pauseIfPlaying,
    isLoading,
    isBuffering,
    error,
    retry,
    seekTo,
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
  } = usePlayer();

  const { isLiked, toggleLike } = useLibrary();
  const [view, setView] = useState<'player' | 'lyrics' | 'about'>('player');
  const [showQueue, setShowQueue] = useState(false);
  const [actionsTrack, setActionsTrack] = useState<Track | null>(null);
  // Timer shortcuts land straight in the sleep picker, not the generic menu.
  const [actionsInitial, setActionsInitial] = useState<'actions' | 'sleep'>('actions');
  const [shareRequest, setShareRequest] = useState<ShareRequest | null>(null);

  // Responsive artwork sizing so all controls stay comfortably on-screen
  const isCompact = height < 740;
  const isUltraCompact = height < 640;

  const artworkSize = useMemo(() => {
    const reservedVertical = isUltraCompact ? 280 : isCompact ? 330 : 380;
    const verticalMax = Math.max(140, height - (insets.top + insets.bottom + reservedVertical));
    const horizontalMax = Math.max(140, width - SIZES.lg * 2);
    return Math.min(horizontalMax, verticalMax, isUltraCompact ? 220 : isCompact ? 270 : 330);
  }, [width, height, insets.top, insets.bottom, isCompact, isUltraCompact]);

  // Lyrics: fetched for the current track in Roman English
  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);

  const loadLyrics = useCallback(() => {
    if (!currentTrack) return;
    // Guard: a fast track switch must never land an older track's lyrics.
    let cancelled = false;
    setLyrics(null);
    setLyricsLoading(true);
    LyricsService.get(currentTrack)
      .then((result) => {
        if (!cancelled) setLyrics(result);
      })
      .catch(() => {
        if (!cancelled) setLyrics(null);
      })
      .finally(() => {
        if (!cancelled) setLyricsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentTrack]);

  useEffect(() => loadLyrics(), [loadLyrics]);

  // Sleep timer: wired here so the action sheet's picker controls real
  // playback pause through the app's own play/pause path. pauseIfPlaying is
  // ref-stable, so the timer always does the right thing no matter how often
  // the user pauses/resumes while it runs.
  const handleSleepTimer = useCallback(
    (minutes: number | null) => {
      if (minutes === null) {
        SleepTimer.cancel();
        return;
      }
      SleepTimer.start(minutes, pauseIfPlaying);
      Alert.alert('Sleep timer', `Playback will pause in ${minutes} minutes.`);
    },
    [pauseIfPlaying]
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
    // SearchTab picks up browseQuery params from other screens; one
    // synchronous navigate lands on the right tab with the query attached —
    // no timer, no unmount race.
    (navigation.navigate as (name: string, params?: object) => void)('SearchTab', {
      browseQuery: q,
    });
  };

  return (
    <View style={styles.container}>
      {/* Background artwork blur — the track colours the room. */}
      <Image
        source={{ uri: currentTrack.albumImageUrl }}
        style={StyleSheet.absoluteFill}
        blurRadius={24}
      />
      <LinearGradient
        colors={['rgba(4, 10, 11, 0.55)', COLORS.background]}
        locations={[0, 0.72]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + (isCompact ? 4 : SIZES.xs),
            paddingBottom: insets.bottom + (isCompact ? SIZES.xs : SIZES.md),
          },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Header: collapse · Playing from · actions */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerIcon}
            accessibilityRole="button"
            accessibilityLabel="Close player"
          >
            <ChevronDown color={COLORS.text.primary} size={SIZES.icon.lg} />
          </TouchableOpacity>

          {view === 'player' ? (
            <>
              {/* Full player: one line of context, share at the right. */}
              <Text style={styles.headerContext} numberOfLines={1}>
                Playing from {queueContext || 'Arkify'}
              </Text>
              <TouchableOpacity
                style={styles.headerIcon}
                onPress={() =>
                  setShareRequest({
                    kind: 'track',
                    title: currentTrack.title,
                    artist: currentTrack.artist.name,
                    artworkUri: currentTrack.albumImageUrl,
                    contextLabel: queueContext || 'Now playing',
                    message: `${currentTrack.title} — ${currentTrack.artist.name}`,
                  })
                }
                accessibilityRole="button"
                accessibilityLabel="Share as card"
              >
                <Share color={COLORS.text.primary} size={SIZES.icon.md} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Lyrics view, per the reference: ••• returns to the artwork,
                  ⋮ opens the track's actions. */}
              <TouchableOpacity
                style={styles.headerIcon}
                onPress={() => setView('player')}
                accessibilityRole="button"
                accessibilityLabel="Show artwork"
              >
                <MoreHorizontal color={COLORS.text.primary} size={SIZES.icon.md} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerIcon}
                onPress={() => setActionsTrack(currentTrack)}
                accessibilityRole="button"
                accessibilityLabel="Track actions"
              >
                <EllipsisVertical color={COLORS.text.primary} size={SIZES.icon.md} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {view === 'player' ? (
          <>
            {/* Artwork hero */}
            <View style={[styles.artworkGlowWrap, isCompact && { marginTop: 4 }]}>
              <View
                style={[
                  styles.artworkGlow,
                  {
                    width: artworkSize + 36,
                    height: artworkSize + 36,
                    borderRadius: (artworkSize + 36) / 2,
                  },
                ]}
              />
              <View
                style={[
                  styles.artworkContainer,
                  { width: artworkSize, height: artworkSize },
                  SHADOWS.artwork,
                ]}
              >
                <Artwork
                  uri={currentTrack.albumImageUrl}
                  size={artworkSize}
                  radius={SIZES.radius.xl}
                />
              </View>
            </View>

            {/* Track Info */}
            <View
              style={[
                styles.infoContainer,
                isCompact && { marginTop: SIZES.md, marginBottom: SIZES.sm },
              ]}
            >
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

            {/* Main Controls */}
            <View
              style={[
                styles.controlsContainer,
                isCompact && { marginBottom: SIZES.md },
              ]}
            >
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
                <View style={styles.playRing}>
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
                      <ActivityIndicator color={COLORS.accent.primary} />
                    ) : isPlaying ? (
                      <Pause
                        color={COLORS.accent.primary}
                        size={SIZES.icon.play}
                        fill={COLORS.accent.primary}
                      />
                    ) : (
                      <Play
                        color={COLORS.accent.primary}
                        size={SIZES.icon.play}
                        fill={COLORS.accent.primary}
                      />
                    )}
                  </TouchableOpacity>
                </View>
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

            {/* Bottom row, per the reference: timer · Lyrics pill · queue. */}
            <View style={styles.bottomActions}>
              <TouchableOpacity
                style={styles.bottomIcon}
                onPress={() => {
                  setActionsInitial('sleep');
                  setActionsTrack(currentTrack);
                }}
                accessibilityRole="button"
                accessibilityLabel="Sleep timer"
              >
                <Timer color={COLORS.text.primary} size={SIZES.icon.md} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.lyricsPill}
                onPress={() => setView('lyrics')}
                accessibilityRole="button"
                accessibilityLabel="Open lyrics"
              >
                <Sparkles color={COLORS.accent.primary} size={SIZES.icon.sm + 2} />
                <Text style={styles.lyricsPillText}>Lyrics</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.bottomIcon}
                onPress={() => setShowQueue(true)}
                accessibilityRole="button"
                accessibilityLabel="Show queue"
              >
                <ListMusic color={COLORS.text.primary} size={SIZES.icon.md} />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            {/* Lyrics / About tabs, per the reference. */}
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
              <LyricsView
                track={currentTrack}
                lyrics={lyrics}
                loading={lyricsLoading}
                onSeek={seekTo}
                onRetry={loadLyrics}
                onMore={() => setActionsTrack(currentTrack)}
              />
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
            {/* The full transport stays live under the lyrics, per the
                reference — reading lyrics never strands playback. */}
            <View style={styles.controlsContainer}>
              <TouchableOpacity
                onPress={toggleShuffle}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={shuffle ? 'Shuffle on' : 'Shuffle off'}
                accessibilityState={{ selected: shuffle }}
              >
                <Shuffle
                  color={shuffle ? COLORS.accent.primary : COLORS.text.secondary}
                  size={SIZES.icon.md + 2}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={previous} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button" accessibilityLabel="Previous track">
                <SkipBack color={COLORS.text.primary} size={SIZES.icon.xl} />
              </TouchableOpacity>
              <Animated.View style={[play.animatedStyle, styles.playButtonWrap]}>
                <View style={styles.playRing}>
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
                      <ActivityIndicator color={COLORS.accent.primary} />
                    ) : isPlaying ? (
                      <Pause
                        color={COLORS.accent.primary}
                        size={SIZES.icon.play}
                        fill={COLORS.accent.primary}
                      />
                    ) : (
                      <Play
                        color={COLORS.accent.primary}
                        size={SIZES.icon.play}
                        fill={COLORS.accent.primary}
                      />
                    )}
                  </TouchableOpacity>
                </View>
              </Animated.View>
              <TouchableOpacity onPress={next} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button" accessibilityLabel="Next track">
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

            {/* Same timer / queue pair as the artwork view. */}
            <View style={styles.bottomActions}>
              <TouchableOpacity
                style={styles.bottomIcon}
                onPress={() => {
                  setActionsInitial('sleep');
                  setActionsTrack(currentTrack);
                }}
                accessibilityRole="button"
                accessibilityLabel="Sleep timer"
              >
                <Timer color={COLORS.text.primary} size={SIZES.icon.md} />
              </TouchableOpacity>
              <View style={styles.bottomSpacer} />
              <TouchableOpacity
                style={styles.bottomIcon}
                onPress={() => setShowQueue(true)}
                accessibilityRole="button"
                accessibilityLabel="Show queue"
              >
                <ListMusic color={COLORS.text.primary} size={SIZES.icon.md} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

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
        shuffle={shuffle}
        onShuffle={toggleShuffle}
      />

      {/* Action sheet (reference composition) */}
      <TrackActionsSheet
        track={actionsTrack}
        initial={actionsInitial}
        onClose={() => setActionsTrack(null)}
        onGoToArtist={(t) => goToString(t.artist.name)}
        onViewAlbum={(t) => goToString([t.album, t.artist?.name].filter(Boolean).join(" "))}
        onSleepTimer={handleSleepTimer}
      />

      {/* Share card */}
      <ShareSheet request={shareRequest} onClose={() => setShareRequest(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
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
  /** "Playing from …" — one line, centred between the two header actions. */
  headerContext: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FONTS.regular,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.secondary,
    paddingHorizontal: SIZES.sm,
  },
  artworkGlowWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SIZES.md,
  },
  artworkGlow: {
    position: 'absolute',
    backgroundColor: COLORS.accent.glow,
  },
  artworkContainer: {
    borderRadius: 22,
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
    fontFamily: FONTS.bold,
    fontSize: 26,
    lineHeight: 32,
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  trackArtist: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.body.fontSize,
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
  /**
   * Outlined transport, per the reference: one accent ring around an accent
   * glyph on a near-transparent fill, with an ambient glow.
   */
  playRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1.5,
    borderColor: COLORS.accent.ring,
    backgroundColor: COLORS.accent.soft,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.accent.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
  playButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.sm,
  },
  bottomIcon: {
    width: SIZES.touchTarget,
    height: SIZES.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSpacer: {
    height: SIZES.touchTarget,
  },
  lyricsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm + 2,
    paddingHorizontal: SIZES.lg,
    height: 44,
    borderRadius: SIZES.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(59, 240, 223, 0.35)',
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
  /** Selected tab fills with the accent, per the reference. */
  tabChipActive: {
    borderColor: COLORS.accent.primary,
    backgroundColor: COLORS.accent.primary,
  },
  tabText: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.soft,
  },
  tabTextActive: {
    color: COLORS.text.dark,
    fontFamily: FONTS.semibold,
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
  /** The ⋮ affordance on the lyrics header, per the reference. */
  lyricsMore: {
    width: SIZES.touchTarget,
    height: SIZES.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** KARAOKE mode pill on the lyrics header. */
  karaokeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 15,
    backgroundColor: 'rgba(59, 240, 223, 0.10)',
    borderWidth: 1,
    borderColor: COLORS.accent.border,
  },
  karaokeToggleOn: {
    backgroundColor: COLORS.accent.primary,
    borderColor: COLORS.accent.primary,
  },
  karaokeToggleText: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: COLORS.accent.primary,
  },
  karaokeToggleTextOn: {
    color: COLORS.text.dark,
  },
  lyricsScroll: {
    flex: 1,
  },
  lyricsContent: {
    paddingBottom: SIZES.xl,
    paddingTop: SIZES.xs,
  },
  lyricLineRow: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: SIZES.radius.sm,
  },
  lyricLine: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.title3.fontSize,
    lineHeight: 38,
    color: COLORS.text.primary,
    letterSpacing: 0.2,
  },
  /** The sung line reads brightest; the rest recede, per the reference. */
  lyricLineActive: {
    color: COLORS.text.primary,
    fontFamily: FONTS.bold,
  },
  lyricLineDim: {
    color: 'rgba(244, 244, 242, 0.42)',
  },
  lyricsFooter: {
    marginTop: SIZES.lg,
  },
  lyricsSource: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.micro.fontSize,
    color: COLORS.text.muted,
  },
  lyricsLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SIZES.sm,
    paddingVertical: SIZES.xxl,
  },
  lyricsLoadingText: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.subheadline.fontSize,
    color: COLORS.text.secondary,
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
  retryLyricsButton: {
    marginTop: SIZES.md,
    paddingHorizontal: SIZES.lg,
    paddingVertical: SIZES.xs + 2,
    borderRadius: SIZES.radius.pill,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.hairline,
  },
  retryLyricsText: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.accent.primary,
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
