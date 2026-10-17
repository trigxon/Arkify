import React, { useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { X } from 'lucide-react-native';
import { COLORS, SIZES, FONTS, TYPE } from '../../constants/theme';
import { useAppearance } from '../../hooks/useAppearance';
import { glassMaterial } from './Glass';
import { WebModal } from './WebModal';

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
  /**
   * Long menus: cap the sheet at the visible height and scroll the body.
   * Opt-in so pinned-header sheets (Queue) keep their own scroll contract.
   */
  scrollBody?: boolean;
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
  scrollBody = false,
}) => {
  const insets = useSafeAreaInsets();
  // The sheet uses the named `sheet` material — resolved against the user's
  // glass-intensity setting so Display preferences reach every surface.
  const { glass } = useAppearance();
  const sheetMaterial = glassMaterial(glass, 'sheet');
  // BUG FIX: sheet heights were derived from Dimensions.get('window') — the
  // BROWSER viewport on web. Inside the 420x900 app frame a desktop viewport
  // made `tall` sheets (Queue, Equalizer) ~160px taller than the frame they
  // live in, clipping grabber + title above the top edge (bottom-anchored).
  // Measure the overlay the sheet actually occupies; window dims are only
  // the first-frame fallback (identical on native).
  const [hostH, setHostH] = useState(0);
  const frameH = hostH > 0 ? hostH : Dimensions.get('window').height;
  const maxSheetHeight = Math.round(frameH * 0.88);

  return (
    // WebModal keeps the sheet inside the app frame on web (RN Modal portals
    // to document.body and spans the whole browser window there).
    <WebModal visible={visible} onRequestClose={onClose} animationType="slide">
      <View
        style={styles.root}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (Math.abs(h - hostH) > 1) setHostH(h);
        }}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: sheetMaterial.fill,
              borderColor: sheetMaterial.border,
            },
            tall && { height: Math.max(frameH - insets.top - SIZES.md, 0) },
            scrollBody && { maxHeight: maxSheetHeight },
            {
              paddingBottom:
                keyboardHeight > 0 ? SIZES.md : Math.max(insets.bottom, SIZES.sm) + SIZES.sm,
              bottom: keyboardHeight,
            },
          ]}
        >
          {/* Material: backdrop sampling on web (blur is native-only above). */}
          {Platform.OS === 'web' ? (
            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { backdropFilter: `blur(${Math.round(sheetMaterial.blur * 1.4)}px) saturate(130%)` } as unknown as ViewStyle]}
            />
          ) : null}
          {/* Liquid glass material: light from above, whisper of lens below. */}
          <LinearGradient
            colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.03)', 'rgba(255,255,255,0)']}
            locations={[0, 0.09, 0.26]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.08)']}
            locations={[0.78, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
          />

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

          {scrollBody ? (
            <ScrollView
              style={styles.bodyScroll}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          ) : (
            children
          )}
        </View>
      </View>
    </WebModal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    // Softened from 0.62 — a clear-glass sheet lets the content behind stay
    // present; the scrim only calms the backdrop for text contrast.
    backgroundColor: 'rgba(0, 0, 0, 0.46)',
    // The panel floats clear of the screen edges, per the reference.
    paddingHorizontal: SIZES.sm + 2,
    paddingBottom: SIZES.sm,
  },
  sheet: {
    // Fill/border arrive from the `sheet` material at render time (inline).
    // The stale near-opaque base that used to live here is gone — it made
    // every sheet read as a foggy panel regardless of the glass setting.
    borderRadius: SIZES.radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.42,
    shadowRadius: 30,
    elevation: 18,
    paddingTop: SIZES.sm + 2,
    paddingHorizontal: SIZES.gutter,
  },
  grabber: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(210, 255, 250, 0.34)',
    marginBottom: SIZES.md,
  },
  bodyScroll: {
    flexGrow: 0,
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
