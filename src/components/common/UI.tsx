import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { COLORS, SIZES, FONTS, TYPE } from '../../constants/theme';

// ---------------------------------------------------------------------------
// Buttons — one tactile language
// ---------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  Icon?: LucideIcon;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** accessibilityLabel overrides the visible label for screen readers. */
  accessibilityLabel?: string;
};

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  Icon,
  disabled = false,
  style,
  accessibilityLabel,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        styles[variant],
        disabled && styles.disabled,
        style,
      ]}
      activeOpacity={0.75}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
    >
      {Icon ? <Icon color={variant === 'primary' ? '#04211D' : COLORS.text.primary} size={SIZES.icon.sm} /> : null}
      <Text style={[styles.label, styles[`${variant}Label`]]}>{label}</Text>
    </TouchableOpacity>
  );
};

type IconButtonProps = {
  Icon: LucideIcon;
  onPress: () => void;
  /** 22 (default) matches the app's standard icon size. */
  size?: number;
  color?: string;
  /** Hit area is always ≥44pt regardless of the icon's visual size. */
  hit?: number;
  accessibilityLabel: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export const IconButton: React.FC<IconButtonProps> = ({
  Icon,
  onPress,
  size = SIZES.icon.md,
  color = COLORS.text.primary,
  hit = SIZES.touchTarget,
  accessibilityLabel,
  disabled = false,
  style,
}) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    style={[styles.iconButton, { width: hit, height: hit, alignItems: 'center', justifyContent: 'center' }, style]}
    activeOpacity={0.7}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    accessibilityState={{ disabled }}
  >
    <Icon color={color} size={size} />
  </TouchableOpacity>
);

// ---------------------------------------------------------------------------
// Section header — eyebrow-style, quiet
// ---------------------------------------------------------------------------

type SectionHeaderProps = {
  title: string;
  /** Optional trailing action, e.g. "See all". */
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
};

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  actionLabel,
  onAction,
  style,
}) => (
  <View style={[styles.sectionHeader, style]}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {actionLabel && onAction ? (
      <TouchableOpacity
        onPress={onAction}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
      >
        <Text style={styles.sectionAction}>{actionLabel}</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

// ---------------------------------------------------------------------------
// States — skeleton, empty, error
// ---------------------------------------------------------------------------

export const Skeleton: React.FC<{ width: number | `${number}%`; height: number; radius?: number; style?: StyleProp<ViewStyle> }> = ({
  width,
  height,
  radius = 10,
  style,
}) => <View style={[styles.skeleton, { width, height, borderRadius: radius }, style]} />;

/** Shimmer-free skeleton track row: cheap to render, unmistakable in shape. */
export const SkeletonTrackRow: React.FC = () => (
  <View style={styles.skeletonRow}>
    <Skeleton width={48} height={48} radius={10} />
    <View style={styles.skeletonLines}>
      <Skeleton width="72%" height={13} style={{ marginBottom: 8 }} />
      <Skeleton width="46%" height={11} />
    </View>
  </View>
);

export const SkeletonList: React.FC<{ rows?: number }> = ({ rows = 4 }) => (
  <View>
    {Array.from({ length: rows }).map((_, i) => (
      <SkeletonTrackRow key={i} />
    ))}
  </View>
);

type EmptyStateProps = {
  Icon?: LucideIcon;
  title: string;
  hint?: string;
  /** Optional retry affordance. */
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  Icon,
  title,
  hint,
  actionLabel,
  onAction,
  style,
}) => (
  <View style={[styles.stateCard, style]}>
    {Icon ? (
      <View style={styles.stateIconWrap}>
        <Icon color={COLORS.text.muted} size={SIZES.icon.md} />
      </View>
    ) : null}
    <Text style={styles.stateTitle}>{title}</Text>
    {hint ? <Text style={styles.stateHint}>{hint}</Text> : null}
    {actionLabel && onAction ? (
      <TouchableOpacity
        style={styles.stateAction}
        onPress={onAction}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
      >
        <Text style={styles.stateActionLabel}>{actionLabel}</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

export const ErrorState: React.FC<{
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  Icon?: LucideIcon;
  style?: StyleProp<ViewStyle>;
}> = ({ message, onRetry, retryLabel = 'Try again', Icon, style }) => (
  <View style={[styles.stateCard, styles.stateCardError, style]}>
    {Icon ? (
      <View style={styles.stateIconWrap}>
        <Icon color={COLORS.status.error} size={SIZES.icon.sm} />
      </View>
    ) : null}
    <Text style={styles.stateTitle}>{message}</Text>
    {onRetry ? (
      <TouchableOpacity
        style={styles.stateAction}
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={retryLabel}
      >
        <Text style={[styles.stateActionLabel, { color: COLORS.accent.primary }]}>{retryLabel}</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

export const InlineSpinner: React.FC<{ color?: string }> = ({ color = COLORS.text.secondary }) => (
  <ActivityIndicator color={color} size="small" />
);

// ---------------------------------------------------------------------------
// Settings row — structured, consistent
// ---------------------------------------------------------------------------

export const SettingsRow: React.FC<{
  label: string;
  value?: string;
  Icon?: LucideIcon;
  onPress?: () => void;
  /** Trailing chevron when onPress is provided. */
  chevron?: boolean;
}> = ({ label, value, Icon, onPress, chevron = false }) => {
  const content = (
    <>
      {Icon ? (
        <View style={styles.settingsRowIcon}>
          <Icon color={COLORS.text.secondary} size={SIZES.icon.sm} />
        </View>
      ) : null}
      <Text style={styles.settingsRowLabel}>{label}</Text>
      {value ? <Text style={styles.settingsRowValue}>{value}</Text> : null}
      {chevron ? <Text style={styles.settingsRowChevron}>›</Text> : null}
    </>
  );

  if (!onPress) return <View style={styles.settingsRow}>{content}</View>;
  return (
    <TouchableOpacity
      style={styles.settingsRow}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {content}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // Buttons
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SIZES.sm,
    height: 52,
    borderRadius: SIZES.radius.pill,
    paddingHorizontal: SIZES.lg,
  },
  primary: {
    backgroundColor: COLORS.accent.primary,
  },
  secondary: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  label: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.callout.fontSize,
  },
  primaryLabel: {
    color: '#04211D',
  },
  secondaryLabel: {
    color: COLORS.text.primary,
  },
  ghostLabel: {
    color: COLORS.text.secondary,
  },
  disabled: {
    opacity: 0.4,
  },
  iconButton: {
    borderRadius: SIZES.radius.pill,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SIZES.md,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.title3.fontSize,
    color: COLORS.text.primary,
  },
  sectionAction: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.secondary,
  },

  // Skeletons
  skeleton: {
    backgroundColor: COLORS.surfaceElevated,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SIZES.sm + 2,
    paddingHorizontal: 2,
  },
  skeletonLines: {
    flex: 1,
    marginLeft: SIZES.md,
  },

  // States
  stateCard: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius.lg,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    padding: SIZES.lg,
    alignItems: 'center',
  },
  stateCardError: {
    borderColor: COLORS.status.errorGlow,
  },
  stateIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SIZES.md,
  },
  stateTitle: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  stateHint: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginTop: SIZES.xs,
  },
  stateAction: {
    marginTop: SIZES.md,
    height: SIZES.touchTarget,
    paddingHorizontal: SIZES.lg,
    borderRadius: SIZES.radius.pill,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateActionLabel: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.primary,
  },

  // Settings rows
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    minHeight: SIZES.touchTarget,
  },
  settingsRowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SIZES.md,
  },
  settingsRowLabel: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: TYPE.body.fontSize,
    color: COLORS.text.primary,
  },
  settingsRowValue: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.subheadline.fontSize,
    color: COLORS.text.secondary,
    marginRight: SIZES.xs,
  },
  settingsRowChevron: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.title3.fontSize,
    color: COLORS.text.muted,
  },
});
