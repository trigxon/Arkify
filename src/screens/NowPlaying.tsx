import React, { useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown, Heart, Play, Pause, SkipBack, SkipForward, Repeat, Repeat1, Shuffle, RotateCcw, RotateCw, MonitorSpeaker, Share, ListMusic, ListPlus, X } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SIZES, FONTS, TYPE, SHADOWS } from '../constants/theme';
import { PlaybackSourceSheet } from '../components/player/PlaybackSourceSheet';
import { SeekBar } from '../components/player/SeekBar';
import { AddToPlaylistSheet } from '../components/lists/AddToPlaylistSheet';
import { Artwork } from '../components/common/Artwork';
import { DownloadService } from '../services/DownloadService';
import { Track } from '../core/types';
import { usePlayer } from '../hooks/usePlayer';
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
    upcoming,
    queueContext,
    jumpTo,
    removeFromQueue,
    canPlayCurrent,
  } = usePlayer();

  const { isLiked, toggleLike } = useLibrary();
  const [showQueue, setShowQueue] = useState(false);
  const [showSource, setShowSource] = useState(false);
  /** Track whose "add to playlist" sheet is open. */
  const [addingTrack, setAddingTrack] = useState<Track | null>(null);

  const play = usePressScale();

  if (!currentTrack) return null;

  const liked = isLiked(currentTrack.id);
  const busy = isLoading || isBuffering;

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

        {/* Header */}
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
          {/* Up Next already has its own toggle in the bottom row, so this
              opens "add to playlist" rather than duplicating it. */}
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => setAddingTrack(currentTrack)}
            accessibilityRole="button"
            accessibilityLabel="Add to playlist"
          >
            <ListPlus color={COLORS.text.primary} size={SIZES.icon.md} />
          </TouchableOpacity>
        </View>

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
            <RotateCcw color={COLORS.text.secondary} size={SIZES.icon.sm + 4} />
            <Text style={styles.seekLabel}>10</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.seekButton}
            onPress={() => seekBy(10)}
            accessibilityRole="button"
            accessibilityLabel="Forward 10 seconds"
          >
            <RotateCw color={COLORS.text.secondary} size={SIZES.icon.sm + 4} />
            <Text style={styles.seekLabel}>10</Text>
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

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <TouchableOpacity
            onPress={() => setShowSource(true)}
            accessibilityRole="button"
            accessibilityLabel="Playback source"
          >
            <MonitorSpeaker
              color={canPlayCurrent ? COLORS.text.secondary : COLORS.status.error}
              size={SIZES.icon.md}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => currentTrack && DownloadService.shareTrack(currentTrack)}
            accessibilityRole="button"
            accessibilityLabel="Share track"
          >
            <Share color={COLORS.text.secondary} size={SIZES.icon.md} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowQueue((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={showQueue ? 'Hide queue' : 'Show queue'}
            accessibilityState={{ selected: showQueue }}
          >
            <ListMusic
              color={showQueue ? COLORS.accent.primary : COLORS.text.secondary}
              size={SIZES.icon.md}
            />
          </TouchableOpacity>
        </View>

        {/* Up Next. Lyrics used to render here as a placeholder that only
            ever showed the track title; it was removed rather than left as a
            dead affordance. */}
        {showQueue && (
          <BlurView intensity={20} tint="dark" style={styles.lyricsSnippet}>
            <View style={styles.queueHeader}>
              <Text style={styles.lyricsTitle}>Up Next</Text>
              <TouchableOpacity
                onPress={() => setShowQueue(false)}
                accessibilityRole="button"
                accessibilityLabel="Hide queue"
              >
                <X color={COLORS.text.secondary} size={SIZES.icon.xs + 2} />
              </TouchableOpacity>
            </View>

            {upcoming.length === 0 ? (
              <Text style={styles.lyricsText}>Nothing queued.</Text>
            ) : (
              <ScrollView style={styles.queueScroll} nestedScrollEnabled>
                {upcoming.map((track) => (
                  <View key={track.id} style={styles.queueRow}>
                    <TouchableOpacity
                      style={styles.queueRowMain}
                      onPress={() => jumpTo(track.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Play next up: ${track.title}`}
                    >
                      <Text style={styles.queueTitle} numberOfLines={1}>{track.title}</Text>
                      <Text style={styles.queueArtist} numberOfLines={1}>
                        {track.artist.name}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => removeFromQueue(track.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${track.title} from queue`}
                    >
                      <X color={COLORS.text.muted} size={SIZES.icon.xs + 2} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </BlurView>
        )}

      </View>

      <AddToPlaylistSheet track={addingTrack} onClose={() => setAddingTrack(null)} />

      <PlaybackSourceSheet visible={showSource} onClose={() => setShowSource(false)} />
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
  artwork: {
    width: '100%',
    height: '100%',
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
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.xl,
    marginBottom: SIZES.lg,
  },
  lyricsSnippet: {
    borderRadius: SIZES.radius.lg,
    padding: SIZES.md,
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    overflow: 'hidden',
  },
  lyricsTitle: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.primary,
    marginBottom: SIZES.xs,
  },
  lyricsText: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.body.fontSize,
    color: COLORS.text.secondary,
    lineHeight: 24,
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
  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.xs,
  },
  queueScroll: {
    maxHeight: 120,
  },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  queueRowMain: {
    flex: 1,
    paddingRight: SIZES.sm,
  },
  queueTitle: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.primary,
  },
  queueArtist: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.secondary,
    marginTop: 1,
  },
});
