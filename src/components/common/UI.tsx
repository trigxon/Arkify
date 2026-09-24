import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { ChevronRight, LucideIcon } from 'lucide-react-native';
import { COLORS, SIZES, FONTS, TYPE } from '../../constants/theme';

// ---------------------------------------------------------------------------
// Section header — one treatment for every section title in the app
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
        style={styles.sectionActionRow}
        onPress={onAction}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
      >
        <Text style={styles.sectionAction}>{actionLabel}</Text>
        <ChevronRight color={COLORS.text.muted} size={SIZES.icon.xs + 2} />
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
  /** Outlined accent action (e.g. Explore Music) instead of the quiet default. */
  accentAction?: boolean;
  style?: StyleProp<ViewStyle>;
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  Icon,
  title,
  hint,
  actionLabel,
  onAction,
  accentAction = false,
  style,
}) => (
  <View style={[styles.stateCard, style]}>
    {Icon ? (
      <View style={accentAction ? styles.stateIconWrapLg : styles.stateIconWrap}>
        <Icon
          color={accentAction ? COLORS.accent.primary : COLORS.text.muted}
          size={accentAction ? SIZES.icon.lg : SIZES.icon.md}
        />
      </View>
    ) : null}
    <Text style={styles.stateTitle}>{title}</Text>
    {hint ? <Text style={styles.stateHint}>{hint}</Text> : null}
    {actionLabel && onAction ? (
      <TouchableOpacity
        style={[styles.stateAction, accentAction && styles.stateActionAccent]}
        onPress={onAction}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
      >
        <Text
          style={[
            styles.stateActionLabel,
            accentAction ? { color: COLORS.accent.primary } : null,
          ]}
        >
          {actionLabel}
        </Text>
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

const styles = StyleSheet.create({
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
  sectionActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  sectionAction: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.callout.fontSize,
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
  /** Large accent ring for the premium empty states (History, first playlist). */
  stateIconWrapLg: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: 'rgba(53, 214, 198, 0.40)',
    backgroundColor: 'rgba(53, 214, 198, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SIZES.md + 2,
  },
  stateTitle: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.title3.fontSize,
    fontWeight: '700',
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  stateHint: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.subheadline.fontSize,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginTop: SIZES.xs,
    paddingHorizontal: SIZES.md,
  },
  stateAction: {
    marginTop: SIZES.lg,
    height: 44,
    paddingHorizontal: 28,
    borderRadius: SIZES.radius.pill,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Outlined accent pill, per the reference empty states (Explore Music). */
  stateActionAccent: {
    backgroundColor: COLORS.accent.soft,
    borderWidth: 1,
    borderColor: COLORS.accent.border,
  },
  stateActionLabel: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.primary,
  },
});
