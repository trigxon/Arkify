import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * Ambient light behind a screen's content.
 *
 * The reference screens are lit rather than flat: a teal bloom falls from the
 * top edge, and a softer counter-glow rises from under the navigation. Purely
 * decorative and pointer-transparent, so it never affects layout or touches.
 *
 * Tuning lives here alone — lowering the two alphas softens the whole app.
 */
export const AmbientGlow: React.FC = () => (
  <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <LinearGradient
      colors={['rgba(53, 214, 198, 0.10)', 'rgba(53, 214, 198, 0.03)', 'rgba(12, 15, 15, 0)']}
      locations={[0, 0.45, 1]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 0.85 }}
      style={styles.top}
    />
    <LinearGradient
      colors={['rgba(53, 214, 198, 0.07)', 'rgba(12, 15, 15, 0)']}
      start={{ x: 0.5, y: 1 }}
      end={{ x: 0.5, y: 0 }}
      style={styles.bottom}
    />
  </View>
);

const styles = StyleSheet.create({
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '42%',
  },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '26%',
  },
});
