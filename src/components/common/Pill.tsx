import React from 'react';
import { StyleSheet, Text, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { COLORS, SIZES, FONTS, TYPE } from '../../constants/theme';

interface PillProps {
  label: string;
  isActive?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Filter chip: quiet when idle, accent-understated when selected. */
export const Pill: React.FC<PillProps> = ({ label, isActive, onPress, style }) => {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.container,
        isActive ? styles.activeContainer : styles.inactiveContainer,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Filter: ${label}`}
      accessibilityState={{ selected: !!isActive }}
    >
      <Text style={[
        styles.label,
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
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    color: COLORS.text.secondary,
  },
});
