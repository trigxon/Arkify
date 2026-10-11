import React, { useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'react-native';
import ViewShot from 'react-native-view-shot';
import { Artwork } from '../common/Artwork';
import { Play, Sparkles, Flame, Radio } from 'lucide-react-native';
import { GRADIENTS } from '../../constants/theme';

/**
 * ShareCard — a beautiful, postable image.
 *
 * Rendered off-screen at 3x, captured via react-native-view-shot and handed
 * to the system share sheet. Three variants: track, streak and wrapped.
 */

export type ShareCardKind = 'track' | 'streak' | 'wrapped' | 'mix';

type Props = {
  kind: ShareCardKind;
  // track
  title?: string;
  artist?: string;
  artworkUri?: string;
  contextLabel?: string;
  // streak
  streak?: number;
  minutesToday?: number;
  level?: number;
  levelTitle?: string;
  // wrapped
  monthLabel?: string;
  topTrack?: { title: string; artist: string; image?: string };
  minutesTotal?: string;
  personality?: string;
};

export const ShareCard = React.forwardRef<ViewShot, Props>((props, _ref) => {
  const { kind } = props;

  if (kind === 'track') {
    return (
      <ViewShot style={styles.root}>
        <LinearGradient colors={GRADIENTS.aurora} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.canvas}>
          <View style={styles.card}>
            <Artwork uri={props.artworkUri} size={220} radius={20} />
            <Text style={styles.trackTitle} numberOfLines={2}>{props.title}</Text>
            <Text style={styles.trackArtist} numberOfLines={1}>{props.artist}</Text>
            <View style={styles.badgeRow}>
              <Play color="#FFFFFF" size={16} fill="#FFFFFF" />
              <Text style={styles.badgeText}>{props.contextLabel || 'Now playing'}</Text>
            </View>
          </View>
          <Watermark />
        </LinearGradient>
      </ViewShot>
    );
  }

  if (kind === 'streak') {
    return (
      <ViewShot style={styles.root}>
        <LinearGradient colors={GRADIENTS.sunset} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.canvas}>
          <View style={styles.card}>
            <Flame color="#FFFFFF" size={64} fill="rgba(255,255,255,0.25)" />
            <Text style={styles.bigNumber}>{props.streak ?? 0}</Text>
            <Text style={styles.bigLabel}>day streak</Text>
            <View style={styles.statRow}>
              <Stat value={`${props.minutesToday ?? 0}m`} label="today" />
              <Stat value={`Lvl ${props.level ?? 1}`} label={props.levelTitle || 'Listener'} />
            </View>
          </View>
          <Watermark />
        </LinearGradient>
      </ViewShot>
    );
  }

  if (kind === 'wrapped') {
    return (
      <ViewShot style={styles.root}>
        <LinearGradient colors={GRADIENTS.midnight} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.canvas}>
          <View style={styles.card}>
            <Text style={styles.wrappedKicker}>{props.monthLabel}</Text>
            <Text style={styles.wrappedTitle}>{props.personality}</Text>
            <View style={styles.wrappedRow}>
              {props.topTrack?.image ? (
                <Image source={{ uri: props.topTrack.image }} style={styles.wrappedArt} />
              ) : null}
              <View style={styles.wrappedMeta}>
                <Text style={styles.wrappedTopLabel}>Top track</Text>
                <Text style={styles.wrappedTopTrack} numberOfLines={1}>{props.topTrack?.title}</Text>
                <Text style={styles.wrappedTopArtist} numberOfLines={1}>{props.topTrack?.artist}</Text>
              </View>
            </View>
            <View style={styles.statRow}>
              <Stat value={props.minutesTotal || '0m'} label="listened" />
              <Stat value={`${props.streak ?? 0}`} label="day streak" />
            </View>
          </View>
          <Watermark />
        </LinearGradient>
      </ViewShot>
    );
  }

  // mix
  return (
    <ViewShot style={styles.root}>
      <LinearGradient colors={GRADIENTS.aurora} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.canvas}>
        <View style={styles.card}>
          <View style={styles.mixIcon}>
            <Sparkles color="#FFFFFF" size={40} />
          </View>
          <Text style={styles.trackTitle} numberOfLines={2}>{props.title}</Text>
          <Text style={styles.trackArtist} numberOfLines={1}>{props.contextLabel}</Text>
          <View style={styles.badgeRow}>
            <Radio color="#FFFFFF" size={14} />
            <Text style={styles.badgeText}>Made for you by Arkify AI</Text>
          </View>
        </View>
        <Watermark />
      </LinearGradient>
    </ViewShot>
  );
});

ShareCard.displayName = 'ShareCard';

const Stat: React.FC<{ value: string; label: string }> = ({ value, label }) => (
  <View style={styles.statCell}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const Watermark: React.FC = () => (
  <View style={styles.watermark}>
    <Text style={styles.watermarkText}>ARKIFY</Text>
  </View>
);

const styles = StyleSheet.create({
  root: {
    width: 320,
    height: 420,
  },
  canvas: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  trackTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.4,
    marginTop: 6,
  },
  trackArtist: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.82)',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: 'rgba(0,0,0,0.28)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  badgeText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  bigNumber: {
    fontSize: 88,
    lineHeight: 96,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -3,
  },
  bigLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    marginTop: -8,
  },
  statRow: {
    flexDirection: 'row',
    gap: 28,
    marginTop: 14,
  },
  statCell: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  wrappedKicker: {
    fontSize: 13,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  wrappedTitle: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.6,
  },
  wrappedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    marginTop: 8,
  },
  wrappedArt: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  wrappedMeta: {
    flex: 1,
  },
  wrappedTopLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  wrappedTopTrack: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  wrappedTopArtist: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.78)',
  },
  mixIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  watermark: {
    position: 'absolute',
    bottom: 18,
    alignSelf: 'center',
  },
  watermarkText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 6,
    color: 'rgba(255,255,255,0.85)',
  },
});
