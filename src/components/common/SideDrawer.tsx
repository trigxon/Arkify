import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing as RNEasing,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import {
  BarChart3,
  CalendarHeart,
  ChevronRight,
  Download,
  History,
  Radio,
  Settings as SettingsIcon,
  Sparkles,
  X,
} from 'lucide-react-native';
import { COLORS, SIZES, FONTS, TYPE } from '../../constants/theme';
import { SpringPressable, GlassView, FadeInUp } from './Glass';
import { useAppearance } from '../../hooks/useAppearance';
import { useLibrary } from '../../hooks/useLibrary';
import { useEngagement } from '../../hooks/useEngagement';

// ---------------------------------------------------------------------------
// SideDrawer — the iOS-style sidebar.
//
// A glass panel slides in from the left edge on a lively spring (with a
// matching scrim fade), can be dragged closed with real physics, and hosts
// the app's destinations so nothing is ever more than one gesture away.
// ---------------------------------------------------------------------------

type DrawerContextValue = { openDrawer: () => void };
const DrawerContext = createContext<DrawerContextValue | undefined>(undefined);

export const useDrawer = (): DrawerContextValue => {
  const ctx = useContext(DrawerContext);
  if (!ctx) throw new Error('useDrawer must be used within DrawerProvider');
  return ctx;
};

const PANEL_W_RATIO = 0.78;
const PANEL_MAX_W = 320;

type DrawerNavItem = {
  icon: typeof Sparkles;
  label: string;
  route: string;
  /** Accent tint for the icon chip. */
  tint?: string;
};

const NAV_ITEMS: DrawerNavItem[] = [
  { icon: Sparkles, label: 'Ask Arkify AI', route: 'AIPlaylist' },
  { icon: Radio, label: 'Mood Radios', route: 'MoodRadios' },
  { icon: CalendarHeart, label: 'Wrapped', route: 'Wrapped', tint: '#FF8A5C' },
  { icon: BarChart3, label: 'Listening Stats', route: 'Stats' },
  { icon: Download, label: 'Downloads', route: 'Downloads' },
  { icon: History, label: 'History', route: 'History' },
];

export const DrawerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const progress = useRef(new Animated.Value(0)).current; // 0 closed → 1 open
  const dragging = useRef(false);
  const alive = useRef(true);
  const { width: screenW } = Dimensions.get('window');
  const panelW = Math.min(PANEL_MAX_W, screenW * PANEL_W_RATIO);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { profile } = useLibrary();
  const { level, levelName, streak } = useEngagement();

  React.useEffect(
    () => () => {
      alive.current = false;
    },
    []
  );

  const animateTo = useCallback(
    (target: 0 | 1, done?: () => void) => {
      Animated.timing(progress, {
        toValue: target,
        // iOS sheets spring, but a timed ease here keeps drag-release honest.
        duration: target ? 320 : 240,
        easing: target ? RNEasing.out(RNEasing.cubic) : RNEasing.in(RNEasing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && done) done();
      });
    },
    [progress]
  );

  const openDrawer = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setOpen(true);
    progress.setValue(0);
    animateTo(1);
  }, [animateTo, progress]);

  const closeDrawer = useCallback(() => {
    animateTo(0, () => {
      if (alive.current) setOpen(false);
    });
  }, [animateTo]);

  // Drag-to-close: real physics on the panel, rubber-band past the edge.
  // Track progress through the documented listener API instead of poking at
  // Animated.Value's private _value.
  const progressValue = useRef(0);
  useEffect(() => {
    const id = progress.addListener(({ value }) => {
      progressValue.current = value;
    });
    return () => progress.removeListener(id);
  }, [progress]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) => dragging.current && g.dx < -6,
        onPanResponderMove: (_e, g) => {
          const next = 1 - Math.max(0, Math.min(1.2, -g.dx / panelW));
          progress.setValue(Math.min(1, next));
        },
        onPanResponderRelease: (_e, g) => {
          dragging.current = false;
          const current = progressValue.current;
          if (current < 0.65 || g.vx < -0.4) closeDrawer();
          else animateTo(1);
        },
        onPanResponderTerminate: () => {
          dragging.current = false;
          animateTo(1);
        },
      }),
    [animateTo, closeDrawer, panelW, progress]
  );

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-panelW - 24, 0],
    extrapolate: 'clamp',
  });
  // iOS drawer parallax: the panel's content trails the panel by a few
  // pixels while sliding, which makes the glass feel like it has depth.
  // Suppressed under reduced motion — the panel still slides, without the
  // internal shift.
  const { motionReduced } = useAppearance();
  const contentShift = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [motionReduced ? 0 : -28, 0],
    extrapolate: 'clamp',
  });
  const scrimOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const go = useCallback(
    (route: string) => {
      closeDrawer();
      // Let the drawer start sliding away before the push lands.
      setTimeout(() => {
        (navigation.navigate as (name: string, params?: object) => void)(route);
      }, 120);
    },
    [closeDrawer, navigation]
  );

  const firstName = profile.name?.trim() || 'Listener';
  const initial = firstName[0]?.toUpperCase() ?? 'A';

  return (
    <DrawerContext.Provider value={{ openDrawer }}>
      {children}

      {open ? (
        <View style={[StyleSheet.absoluteFill, styles.drawerRoot]}>
          {/* Scrim — tap to close, drag to fling away */}
          <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: scrimOpacity }]}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={closeDrawer}
              accessible={false}
              {...panResponder.panHandlers}
            />
          </Animated.View>

          <Animated.View
            style={[
              styles.panel,
              {
                width: panelW,
                paddingTop: insets.top + SIZES.lg,
                paddingBottom: insets.bottom + SIZES.lg,
                transform: [{ translateX }],
              },
            ]}
            {...panResponder.panHandlers}
            onStartShouldSetResponderCapture={() => {
              // Panels own horizontal drags beginning inside them.
              return false;
            }}
          >
            <GlassView weight="thick" blur style={styles.panelGlass}>
              <View
                style={StyleSheet.absoluteFill}
                onTouchStart={() => {
                  dragging.current = true;
                }}
                onTouchEnd={() => {
                  dragging.current = false;
                }}
                pointerEvents="box-none"
              />

              <Animated.View
                style={[styles.panelContent, { transform: [{ translateX: contentShift }] }]}
                pointerEvents="box-none"
              >
                {/* Close affordance */}
                <SpringPressable
                  style={styles.closeBtn}
                  pressScale={0.88}
                  onPress={closeDrawer}
                  accessibilityRole="button"
                  accessibilityLabel="Close menu"
                >
                  <X color={COLORS.text.secondary} size={SIZES.icon.sm + 2} />
                </SpringPressable>

                {/* Profile block */}
                <View style={styles.profileBlock}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initial}</Text>
                  </View>
                  <View style={styles.profileMeta}>
                    <Text style={styles.profileName} numberOfLines={1}>
                      {firstName}
                    </Text>
                    <Text style={styles.profileLevel}>
                      Lvl {level} · {levelName}
                      {streak > 0 ? ` · ${streak}d streak` : ''}
                    </Text>
                  </View>
                </View>

                {/* Nav items — each row lands on its own beat as the panel slides in */}
                <View style={styles.navList}>
                  {NAV_ITEMS.map((item, i) => (
                    <FadeInUp key={item.route} index={i} preset="fast">
                      <SpringPressable
                        style={styles.navRow}
                        pressScale={0.97}
                        onPress={() => go(item.route)}
                        accessibilityRole="button"
                        accessibilityLabel={item.label}
                      >
                        <View style={[styles.navIcon, item.tint ? { backgroundColor: `${item.tint}22`, borderColor: `${item.tint}55` } : null]}>
                          <item.icon color={item.tint ?? COLORS.accent.primary} size={17} />
                        </View>
                        <Text style={styles.navLabel}>{item.label}</Text>
                        <ChevronRight color={COLORS.text.muted} size={15} />
                      </SpringPressable>
                    </FadeInUp>
                  ))}
                </View>

                <View style={styles.divider} />

                {/* Settings row */}
                <SpringPressable
                  style={styles.navRow}
                  pressScale={0.97}
                  onPress={() => go('Settings')}
                  accessibilityRole="button"
                  accessibilityLabel="Settings"
                >
                  <View style={styles.navIcon}>
                    <SettingsIcon color={COLORS.text.secondary} size={17} />
                  </View>
                  <Text style={[styles.navLabel, styles.navLabelMuted]}>Settings</Text>
                  <ChevronRight color={COLORS.text.muted} size={15} />
                </SpringPressable>

                {/* Footer brand */}
                <View style={styles.footer}>
                  <Text style={styles.footerText}>Arkify v2.1 · powered by Arkify AI</Text>
                </View>
              </Animated.View>
            </GlassView>
          </Animated.View>
        </View>
      ) : null}
    </DrawerContext.Provider>
  );
};

const styles = StyleSheet.create({
  drawerRoot: {
    zIndex: 200,
    elevation: 200,
  },
  scrim: {
    backgroundColor: 'rgba(4, 6, 6, 0.62)',
  },
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  panelGlass: {
    flex: 1,
    borderRadius: 0,
    borderTopRightRadius: 34,
    borderBottomRightRadius: 34,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  panelContent: {
    flex: 1,
    paddingHorizontal: SIZES.lg,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SIZES.md,
  },
  profileBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.md,
    marginBottom: SIZES.xl,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(59, 240, 223, 0.10)',
    borderWidth: 1.5,
    borderColor: 'rgba(59, 240, 223, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.title3.fontSize,
    color: COLORS.accent.primary,
  },
  profileMeta: {
    flex: 1,
  },
  profileName: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.title3.fontSize,
    color: COLORS.text.primary,
  },
  profileLevel: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  navList: {
    gap: 2,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.md,
    height: 52,
    borderRadius: SIZES.radius.md,
    paddingHorizontal: SIZES.sm,
  },
  navIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: 'rgba(59, 240, 223, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(59, 240, 223, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: TYPE.body.fontSize,
    color: COLORS.text.primary,
  },
  navLabelMuted: {
    color: COLORS.text.secondary,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.hairline,
    marginVertical: SIZES.md,
  },
  footer: {
    marginTop: 'auto',
    alignItems: 'center',
  },
  footerText: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.micro.fontSize,
    color: COLORS.text.muted,
    letterSpacing: 0.3,
  },
});
