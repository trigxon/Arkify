import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { COLORS, SIZES, FONTS, TYPE } from '../../constants/theme';

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Omitted for sheets that go straight to content (e.g. the action sheet). */
  title?: string;
  subtitle?: string;
  /** 'center' parks the title in the middle of the bar with close at the left. */
  titleAlign?: 'left' | 'center';
  children: React.ReactNode;
  /** Extra bottom padding when the keyboard is open (sheets with inputs). */
  keyboardHeight?: number;
  /** The sheet's grabber. Off for sheets that read as full screens (queue). */
  showGrabber?: boolean;
  /** Fills the screen height instead of hugging its content. */
  tall?: boolean;
};

/**
 * Shared bottom-sheet chrome for the app's modals.
 *
 * One backdrop, one grabber, one header treatment — the two feature sheets
 * (AddToPlaylist, PlaybackSource) provide only their content. Animation stays
 * the platform Modal 'slide' so it remains interruptible and familiar.
 */
export const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  titleAlign = 'left',
  children,
  keyboardHeight = 0,
  showGrabber = true,
  tall = false,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />

        <View
          style={[
            styles.sheet,
            tall && { height: Dimensions.get('window').height - insets.top - SIZES.md },
            {
              paddingBottom:
                keyboardHeight > 0 ? SIZES.md : Math.max(insets.bottom, SIZES.sm) + SIZES.sm,
              bottom: keyboardHeight,
            },
          ]}
        >
          {showGrabber ? <View style={styles.grabber} /> : null}

          {title ? (
            titleAlign === 'center' ? (
              /* Close at the left, title optically centred in the bar. */
              <View style={styles.centeredHeader}>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.centeredClose}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <X color={COLORS.text.primary} size={SIZES.icon.lg} />
                </TouchableOpacity>
                <Text style={styles.centeredTitle} numberOfLines={1}>
                  {title}
                </Text>
                <View style={styles.centeredClose} />
              </View>
            ) : (
              <View style={styles.header}>
                <View style={styles.headerText}>
                  <Text style={styles.title}>{title}</Text>
                  {subtitle ? (
                    <Text style={styles.subtitle} numberOfLines={1}>
                      {subtitle}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <X color={COLORS.text.secondary} size={SIZES.icon.md} />
                </TouchableOpacity>
              </View>
            )
          ) : null}

          {children}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: COLORS.scrim,
    // The panel floats clear of the screen edges, per the reference.
    paddingHorizontal: SIZES.sm + 2,
    paddingBottom: SIZES.sm,
  },
  sheet: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: SIZES.radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(53, 214, 198, 0.20)',
    paddingTop: SIZES.sm + 2,
    paddingHorizontal: SIZES.gutter,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    marginBottom: SIZES.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: SIZES.md,
  },
  centeredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SIZES.md,
  },
  centeredClose: {
    width: SIZES.touchTarget,
    height: SIZES.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centeredTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FONTS.medium,
    fontSize: TYPE.title3.fontSize,
    color: COLORS.text.primary,
  },
  headerText: {
    flex: 1,
    marginRight: SIZES.md,
  },
  title: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.title3.fontSize,
    color: COLORS.text.primary,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.subheadline.fontSize,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
});
