import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, StyleProp, ViewStyle } from 'react-native';
import { ReactNode } from 'react';
import { Menu } from 'lucide-react-native';
import { COLORS, SIZES, FONTS, TYPE } from '../../constants/theme';
import { SpringPressable } from './Glass';
import { useDrawer } from './SideDrawer';

/**
 * Hamburger — opens the iOS-style sliding sidebar. One tap, every destination.
 */
export const MenuButton: React.FC<{ style?: StyleProp<ViewStyle> }> = ({ style }) => {
  const { openDrawer } = useDrawer();
  return (
    <SpringPressable
      style={[styles.menuBtn, style]}
      pressScale={0.88}
      onPress={openDrawer}
      accessibilityRole="button"
      accessibilityLabel="Open menu"
    >
      <Menu color={COLORS.text.primary} size={20} strokeWidth={2.2} />
    </SpringPressable>
  );
};

type ScreenHeaderProps = {
  title: string;
  /** Small line above the title, e.g. a greeting. */
  kicker?: string;
  /** Leading element (sidebar hamburger on tab screens). */
  left?: ReactNode;
  /** Trailing element (icon button, avatar). */
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Screen-level header: optional leading hamburger, kicker + large title +
 * optional trailing action. Padding and type come from the design system, so
 * every tab screen starts identically.
 */
export const ScreenHeader: React.FC<ScreenHeaderProps> = ({ title, kicker, left, right, style }) => (
  <View style={[styles.wrap, style]}>
    <View style={styles.row}>
      {left}
      <View style={styles.textWrap}>
        {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      {right}
    </View>
  </View>
);


const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: SIZES.gutter,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SIZES.md,
  },
  textWrap: {
    flex: 1,
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  kicker: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.body.fontSize,
    color: COLORS.text.secondary,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.title1.fontSize,
    lineHeight: TYPE.title1.lineHeight,
    color: COLORS.text.primary,
    marginTop: 2,
  },
});
