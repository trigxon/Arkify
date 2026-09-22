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
  EllipsisVertical,
  Heart,
  Play,
  Pause,
  Repeat,
  Repeat1,
  Shuffle,
  Share,
  SkipBack,
  SkipForward,
  Timer,
  Mic,
  MoreHorizontal,
  ListMusic,
  AudioLines,
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

type PlayerState = ReturnType<typeof usePlayer>;

/** Tactile press: quick scale-down, spring back. Short and interruptible. */
function usePressScale() {
  const value = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.spring(value, { toValue: 0.92, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
  const onPressOut = () =>
    Animated.spring(value, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  return { animatedStyle: { transform: [{ scale: value }] }, onPressIn, onPressOut };
}

// ---------------------------------------------------------------------------
// Transport controls — one row, shared by the player and lyrics views
// ---------------------------------------------------------------------------

type ControlsProps = Pick<
  PlayerState,
  'shuffle' | 'repeat' | 'previous' | 'next' | 'toggleShuffle' | 'cycleRepeat' | 'togglePlayPause'
> & { isPlaying: boolean; busy: boolean };

const PlayerControls: React.FC<ControlsProps> = ({
  isPlaying,
  busy,
  shuffle,
  repeat,
  previous,
  next,
  toggleShuffle,
  cycleRepeat,
  togglePlayPause,
}) => {
  const press = usePressScale();

  return (
    <View style={styles.controls}>
      <TouchableOpacity
        onPress={toggleShuffle}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel={shuffle ? 'Shuffle on' : 'Shuffle off'}
        accessibilityState={{ selected: shuffle }}
      >
        <Shuffle
          color={shuffle ? COLORS.accent.primary : COLORS.text.secondary}
          size={SIZES.icon.lg - 2}
          strokeWidth={2}
        />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={previous}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel="Previous track"
      >
        <SkipBack color={COLORS.text.primary} size={SIZES.icon.xl} fill={COLORS.text.primary} />
      </TouchableOpacity>

      <Animated.View style={press.animatedStyle}>
        <View style={styles.playRing}>
          <TouchableOpacity
            style={styles.playButton}
            onPress={togglePlayPause}
            onPressIn={press.onPressIn}
            onPressOut={press.onPressOut}
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
        </View>
      </Animated.View>

      <TouchableOpacity
        onPress={next}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel="Next track"
      >
        <SkipForward color={COLORS.text.primary} size={SIZES.icon.xl} fill={COLORS.text.primary} />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={cycleRepeat}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel={`Repeat mode: ${
          repeat === 'off' ? 'off' : repeat === 'all' ? 'repeat all' : 'repeat one'
        }`}
        accessibilityState={{ selected: repeat !== 'off' }}
      >
        {repeat === 'one' ? (
          <Repeat1 color={COLORS.accent.primary} size={SIZES.icon.lg - 2} strokeWidth={2} />
        ) : (
          <Repeat
            color={repeat === 'all' ? COLORS.accent.primary : COLORS.text.secondary}
            size={SIZES.icon.lg - 2}
            strokeWidth={2}
          />
        )}
      </TouchableOpacity>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Lyrics — the reference's focused reading layout
// ---------------------------------------------------------------------------

const LyricsView: React.FC<{ lyrics: Lyrics | null; loading: boolean }> = ({ lyrics, loading }) => {
  const { position } = useProgress();
  const scrollRef = useRef<ScrollView>(null);
  const activeIndexRef = useRef(-1);

  const activeIndex = useMemo(
    () => (lyrics?.synced ? LyricsService.activeLineIndex(lyrics, position) : -1),
    // Twice a second is plenty for a line highlight.
    [lyrics, Math.floor(position * 2)]
  );

  // Keep the active line in view. Runs only when the line actually changes.
  useEffect(() => {
    if (activeIndex < 0 || activeIndex === activeIndexRef.current) return;
    activeIndexRef.current = activeIndex;
    scrollRef.current?.scrollTo({ y: Math.max(0, activeIndex * 46 - 120), animated: true });
  }, [activeIndex]);

  if (loading) {
    return (
      <View style={styles.lyricsCenter}>
        <ActivityIndicator color={COLORS.text.muted} />
      </View>
    );
  }

  if (!lyrics || lyrics.lines.length === 0) {
    return (
      <View style={styles.lyricsCenter}>
        <AudioLines color={COLORS.text.muted} size={SIZES.icon.xl} />
        <Text style={styles.lyricsEmptyTitle}>No lyrics available</Text>
        <Text style={styles.lyricsEmptyHint}>
          Lyrics aren't set up for this track. Playback is unaffected.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.lyricsScroll}
      contentContainerStyle={styles.lyricsContent}
      showsVerticalScrollIndicator={false}
    >
      {lyrics.lines.map((line, i) => {
        const isActive = lyrics.synced && i === activeIndex;
        return (
          <Text
            key={i}
            style={[
              styles.lyricLine,
              isActive && styles.lyricLineActive,
              lyrics.synced && !isActive && styles.lyricLineDim,
            ]}
          >
            {line.text || ' '}
          </Text>
        );
      })}
      <Text style={styles.lyricsSource}>
        {lyrics.source}
        {lyrics.synced ? ' · synced' : ''}
      </Text>
    </ScrollView>
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
  /** Which sheet face the timer shortcut opens. */
  const [actionFace, setActionFace] = useState<'actions' | 'sleep'>('actions');

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

  // Sleep timer: wired here so the picker controls real playback pause
  // through the app's own play/pause path.
  const handleSleepTimer = useCallback(
    (minutes: number | null) => {
      if (minutes === null) {
        SleepTimer.cancel();
        return;
      }
      SleepTimer.start(minutes, () => {
        if (isPlaying) togglePlayPause();
      });
      Alert.alert('Sleep timer', `Playback will pause in ${minutes} minutes.`);
    },
    [isPlaying, togglePlayPause]
  );

  const openSheet = useCallback((track: Track, face: 'actions' | 'sleep') => {
    setActionFace(face);
    setActionsTrack(track);
  }, []);

  /** Artist/album lookup: real search navigation, same as Library rows. */
  const goToString = (q: string) => {
    setShowQueue(false);
    setActionsTrack(null);
    navigation.goBack();
    navigation.navigate('Main' as never);
    setTimeout(() => {
      (navigation.navigate as (name: string, params?: object) => void)('SearchTab', {
        browseQuery: q,
      });
    }, 80);
  };

  if (!currentTrack) return null;

  const liked = isLiked(currentTrack.id);
  const busy = isLoading || isBuffering;
  const inLyrics = view !== 'player';

  /** The taller timer/queue shortcuts under the transport. */
  const utilityRow = (withLyrics: boolean) => (
    <View style={styles.utilityRow}>
      <TouchableOpacity
        style={styles.utilityButton}
        onPress={() => openSheet(currentTrack, 'sleep')}
        accessibilityRole="button"
        accessibilityLabel="Sleep timer"
      >
        <Timer color={COLORS.text.secondary} size={SIZES.icon.md} strokeWidth={1.9} />
      </TouchableOpacity>

      {withLyrics ? (
        <TouchableOpacity
          style={styles.lyricsPill}
          activeOpacity={0.85}
          onPress={() => setView('lyrics')}
          accessibilityRole="button"
          accessibilityLabel="Show lyrics"
        >
          <Mic color={COLORS.accent.primary} size={SIZES.icon.sm + 2} strokeWidth={1.9} />
          <Text style={styles.lyricsPillText}>Lyrics</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.utilitySpacer} />
      )}

      <TouchableOpacity
        style={styles.utilityButton}
        onPress={() => setShowQueue(true)}
        accessibilityRole="button"
        accessibilityLabel="Show queue"
      >
        <ListMusic color={COLORS.text.secondary} size={SIZES.icon.md} strokeWidth={1.9} />
      </TouchableOpacity>
    </View>
  );

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

      <View
        style={[
          styles.content,
          { paddingTop: insets.top, paddingBottom: insets.bottom + SIZES.sm },
        ]}
      >
        {/* Header — per the references: collapse on the left, context in the
            middle, share / actions on the right. */}
        {inLyrics ? (
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.headerIcon}
              accessibilityRole="button"
              accessibilityLabel="Close player"
            >
              <ChevronDown color={COLORS.text.primary} size={SIZES.icon.lg} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setView('player')}
              style={styles.headerIcon}
              accessibilityRole="button"
              accessibilityLabel="Show artwork"
            >
              <MoreHorizontal color={COLORS.text.primary} size={SIZES.icon.md} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIcon}
              onPress={() => openSheet(currentTrack, 'actions')}
              accessibilityRole="button"
              accessibilityLabel="Track actions"
            >
              <EllipsisVertical color={COLORS.text.primary} size={SIZES.icon.md} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.headerIcon}
              accessibilityRole="button"
              accessibilityLabel="Close player"
            >
              <ChevronDown color={COLORS.text.primary} size={SIZES.icon.lg} />
            </TouchableOpacity>
            <Text style={styles.headerContext} numberOfLines={1}>
              Playing from {queueContext || 'Audia'}
            </Text>
            <TouchableOpacity
              style={styles.headerIcon}
              onPress={() => {
                void DownloadService.shareTrack(currentTrack);
              }}
              accessibilityRole="button"
              accessibilityLabel="Share track"
            >
              <Share color={COLORS.text.primary} size={SIZES.icon.md} strokeWidth={1.9} />
            </TouchableOpacity>
          </View>
        )}

        {view === 'player' ? (
          <>
            {/* Artwork hero */}
            <View style={styles.artworkSection}>
              <View style={styles.artworkGlow} />
              <View style={[styles.artworkContainer, SHADOWS.artwork]}>
                <Artwork
                  uri={currentTrack.albumImageUrl}
                  size={width - SIZES.lg * 2}
                  radius={22}
                />
              </View>
            </View>

            <View style={styles.bottomSection}>
              {/* Track info + like */}
              <View style={styles.infoContainer}>
                <View style={styles.textInfo}>
                  <Text style={styles.trackTitle} numberOfLines={1}>
                    {currentTrack.title}
                  </Text>
                  <Text style={styles.trackArtist} numberOfLines={1}>
                    {currentTrack.artist.name}
                  </Text>
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
                    strokeWidth={1.9}
                  />
                </TouchableOpacity>
              </View>

              {/* SeekBar owns its own measurement, gesture handling and position
                  subscription, so this screen never re-renders on a tick. */}
              <SeekBar onSeek={seekTo} />

              {/* Error state — never leaves the player stuck */}
              {error && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={retry}
                  style={styles.errorBanner}
                  accessibilityRole="button"
                  accessibilityLabel={`Playback error: ${error}. Tap to retry.`}
                >
                  <Text style={styles.errorText} numberOfLines={2}>
                    {error}
                  </Text>
                  <Text style={styles.errorHint}>Tap to retry</Text>
                </TouchableOpacity>
              )}

              <PlayerControls
                isPlaying={isPlaying}
                busy={busy}
                shuffle={shuffle}
                repeat={repeat}
                previous={previous}
                next={next}
                toggleShuffle={toggleShuffle}
                cycleRepeat={cycleRepeat}
                togglePlayPause={togglePlayPause}
              />

              {utilityRow(true)}
            </View>
          </>
        ) : (
          <>
            {/* Track row, per the lyrics reference */}
            <View style={styles.lyricsTrackRow}>
              <Artwork uri={currentTrack.albumImageUrl} size={46} radius={8} />
              <View style={styles.lyricsTrackText}>
                <Text style={styles.lyricsTrackTitle} numberOfLines={1}>
                  {currentTrack.title}
                </Text>
                <Text style={styles.lyricsTrackArtist} numberOfLines={1}>
                  {currentTrack.artist.name}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => openSheet(currentTrack, 'actions')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Track actions"
              >
                <EllipsisVertical color={COLORS.text.secondary} size={SIZES.icon.sm + 2} />
              </TouchableOpacity>
            </View>

            {/* Lyrics / About tabs */}
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tabChip, view === 'lyrics' && styles.tabChipActive]}
                activeOpacity={0.85}
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
                activeOpacity={0.85}
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
              <LyricsView lyrics={lyrics} loading={lyricsLoading} />
            ) : (
              <ScrollView
                style={styles.aboutScroll}
                contentContainerStyle={styles.aboutContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.aboutArtwork}>
                  <Artwork uri={currentTrack.albumImageUrl} size={148} radius={SIZES.radius.lg} />
                </View>
                <Text style={styles.aboutTitle} numberOfLines={2}>
                  {currentTrack.title}
                </Text>
                <Text style={styles.aboutArtist} numberOfLines={1}>
                  {currentTrack.artist.name}
                </Text>
                {currentTrack.album ? (
                  <View style={styles.aboutRow}>
                    <Text style={styles.aboutLabel}>ALBUM</Text>
                    <Text style={styles.aboutValue} numberOfLines={1}>
                      {currentTrack.album}
                    </Text>
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
              </ScrollView>
            )}

            {/* Progress + transport stay available beneath the lyrics, per the
                reference: lyrics never trap the player. */}
            <SeekBar onSeek={seekTo} />
            <PlayerControls
              isPlaying={isPlaying}
              busy={busy}
              shuffle={shuffle}
              repeat={repeat}
              previous={previous}
              next={next}
              toggleShuffle={toggleShuffle}
              cycleRepeat={cycleRepeat}
              togglePlayPause={togglePlayPause}
            />
            {utilityRow(false)}
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
        shuffle={shuffle}
        onShuffle={toggleShuffle}
      />

      {/* Action sheet — the player's timer shortcut opens it on the picker. */}
      <TrackActionsSheet
        track={actionsTrack}
        initial={actionFace}
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

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: SIZES.touchTarget,
  },
  headerIcon: {
    width: SIZES.touchTarget,
    height: SIZES.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContext: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FONTS.regular,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.secondary,
    paddingHorizontal: SIZES.sm,
  },

  // Artwork
  artworkSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  artworkGlow: {
    position: 'absolute',
    width: width - SIZES.lg * 2 + 60,
    height: width - SIZES.lg * 2 + 60,
    borderRadius: (width - SIZES.lg * 2 + 60) / 2,
    backgroundColor: COLORS.accent.glow,
  },
  artworkContainer: {
    width: width - SIZES.lg * 2,
    height: width - SIZES.lg * 2,
    borderRadius: 22,
    overflow: 'hidden',
    alignSelf: 'center',
  },

  // Track info
  bottomSection: {
    justifyContent: 'flex-end',
  },
  infoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.md,
  },
  textInfo: {
    flex: 1,
    paddingRight: SIZES.md,
  },
  trackTitle: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.title2.fontSize + 2,
    lineHeight: TYPE.title2.lineHeight + 2,
    color: COLORS.text.primary,
  },
  trackArtist: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.body.fontSize,
    color: COLORS.text.secondary,
    marginTop: 3,
  },

  // Transport
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.lg,
  },
  /** Thin accent halo around the play button, per the reference. */
  playRing: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 1,
    borderColor: 'rgba(61, 214, 195, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: COLORS.accent.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Bottom shortcuts
  utilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SIZES.sm,
  },
  utilityButton: {
    width: SIZES.touchTarget,
    height: SIZES.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  utilitySpacer: {
    height: SIZES.touchTarget,
  },
  lyricsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm + 2,
    paddingHorizontal: SIZES.xl,
    height: 46,
    borderRadius: SIZES.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(61, 214, 195, 0.40)',
    backgroundColor: COLORS.accent.soft,
  },
  lyricsPillText: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.body.fontSize,
    color: COLORS.accent.primary,
  },

  // Lyrics view
  lyricsTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.md,
    marginTop: SIZES.sm,
    marginBottom: SIZES.md,
  },
  lyricsTrackText: {
    flex: 1,
  },
  lyricsTrackTitle: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.headline.fontSize,
    color: COLORS.text.primary,
  },
  lyricsTrackArtist: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.subheadline.fontSize,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  tabRow: {
    flexDirection: 'row',
    gap: SIZES.sm,
    marginBottom: SIZES.lg,
  },
  tabChip: {
    flex: 1,
    height: 46,
    borderRadius: SIZES.radius.pill,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabChipActive: {
    borderColor: 'rgba(61, 214, 195, 0.45)',
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
  lyricsScroll: {
    flex: 1,
  },
  lyricsContent: {
    paddingBottom: SIZES.lg,
  },
  lyricLine: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.title3.fontSize,
    lineHeight: 46,
    color: 'rgba(244, 244, 242, 0.82)',
  },
  lyricLineActive: {
    fontFamily: FONTS.semibold,
    color: COLORS.text.primary,
  },
  lyricLineDim: {
    color: 'rgba(244, 244, 242, 0.34)',
  },
  lyricsSource: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.micro.fontSize,
    color: COLORS.text.muted,
    marginTop: SIZES.md,
  },
  lyricsCenter: {
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

  // About tab
  aboutScroll: {
    flex: 1,
  },
  aboutContent: {
    alignItems: 'center',
    paddingBottom: SIZES.lg,
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

  // Error
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
