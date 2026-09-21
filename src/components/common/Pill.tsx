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
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderRadius: SIZES.radius.pill,
    marginRight: SIZES.sm,
    minHeight: SIZES.touchTarget - 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeContainer: {
    backgroundColor: COLORS.accent.primary,
  },
  inactiveContainer: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.hairline,
  },
  label: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.subheadline.fontSize,
  },
  activeLabel: {
    color: '#04211D',
  },
  inactiveLabel: {
    color: COLORS.text.primary,
  },
});
