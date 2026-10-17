import React from 'react';
import { StyleSheet, Text, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { COLORS, SIZES, FONTS, TYPE, GLASS } from '../../constants/theme';

interface PillProps {
  label: string;
  isActive?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  /** Compact variant for secondary chip rows (e.g. sort controls). */
  small?: boolean;
}

/** Filter chip: quiet when idle, accent-understated when selected. */
export const Pill: React.FC<PillProps> = ({ label, isActive, onPress, style, small = false }) => {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.container,
        small && styles.containerSmall,
        isActive ? styles.activeContainer : styles.inactiveContainer,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Filter: ${label}`}
      accessibilityState={{ selected: !!isActive }}
      aria-pressed={!!isActive}
    >
      <Text style={[
        styles.label,
        small && styles.labelSmall,
        isActive ? styles.activeLabel : styles.inactiveLabel
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: SIZES.radius.pill,
    marginRight: SIZES.sm,
    minHeight: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeContainer: {
    backgroundColor: COLORS.accent.primary,
  },
  inactiveContainer: {
    // CLEAR glass chip: a thin translucent tint with a fine light edge —
    // the canvas breathes through instead of an opaque card blocking it.
    backgroundColor: GLASS.fill.thin,
    borderWidth: 1,
    borderColor: GLASS.border.hairline,
  },
  label: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    letterSpacing: 0.2,
  },
  activeLabel: {
    color: COLORS.text.dark,
    fontWeight: '600',
  },
  inactiveLabel: {
    // Reference chips read bright on the dark surface, not greyed out.
    color: COLORS.text.soft,
  },
  containerSmall: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    minHeight: 30,
    marginRight: SIZES.xs + 2,
  },
  labelSmall: {
    fontSize: 12,
  },
});
