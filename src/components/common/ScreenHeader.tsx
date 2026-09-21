import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, StyleProp, ViewStyle } from 'react-native';
import { ReactNode } from 'react';
import { COLORS, SIZES, FONTS, TYPE } from '../../constants/theme';

type ScreenHeaderProps = {
  title: string;
  /** Small line above the title, e.g. a greeting. */
  kicker?: string;
  /** Trailing element (icon button, avatar). */
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Screen-level header: kicker + large title + optional trailing action.
 * Padding and type come from the design system, so every tab screen starts
 * identically.
 */
export const ScreenHeader: React.FC<ScreenHeaderProps> = ({ title, kicker, right, style }) => (
  <View style={[styles.wrap, style]}>
    <View style={styles.row}>
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
    justifyContent: 'space-between',
  },
  textWrap: {
    flex: 1,
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
