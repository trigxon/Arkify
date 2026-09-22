import React, { memo, useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import { Music } from 'lucide-react-native';
import { COLORS, SIZES } from '../../constants/theme';

type ArtworkProps = {
  uri?: string;
  /** Rendered size in px (square). */
  size: number;
  /** Corner radius; defaults to a size-proportional rounding. */
  radius?: number;
  /** Circle for artist imagery. */
  round?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Album/artist artwork with a branded placeholder while loading or on error.
 *
 * One component everywhere so every image in the app shares identical corner
 * radii, background and fallback treatment. `recyclingKey`-free: RN's Image
 * keeps the last frame on URI change, which is exactly the crossfade-friendly
 * behaviour we want.
 */
export const Artwork = memo(function Artwork({
  uri,
  size,
  radius,
  round = false,
  style,
}: ArtworkProps) {
  const resolvedRadius = round ? size / 2 : (radius ?? Math.max(8, Math.round(size * 0.12)));

  // Track load error so a broken URL shows the fallback instead of a blank
  // box, and reset when the URI changes.
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);

  const showImage = !!uri && !failed;

  return (
    <View
      style={[styles.wrap, { width: size, height: size, borderRadius: resolvedRadius }, style]}
    >
      {showImage ? (
        <Image
          source={{ uri }}
          style={[StyleSheet.absoluteFill, { borderRadius: resolvedRadius }]}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.placeholder, { borderRadius: resolvedRadius }]}>
          <Music color={COLORS.text.muted} size={Math.max(14, Math.round(size * 0.3))} />
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.surfaceElevated,
    overflow: 'hidden',
  },
  placeholder: {
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
