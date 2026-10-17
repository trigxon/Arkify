import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Home, Search, Library, User } from 'lucide-react-native';
import { COLORS, SIZES, FONTS, TYPE, SPRINGS } from '../constants/theme';
import { useAppearance } from '../hooks/useAppearance';
import { glassMaterial } from '../components/common/Glass';
import { hapticLight, hapticMedium, hapticSelection } from '../utils/haptics';
// Screens
import HomeScreen from '../screens/Home';
import SearchScreen from '../screens/Search';
import LibraryScreen from '../screens/Library';
import YouScreen from '../screens/You';

const Tab = createBottomTabNavigator();

// ---------------------------------------------------------------------------
// Geometry of the floating glass bar
// ---------------------------------------------------------------------------

const BAR_MARGIN_H = 16;
const BAR_MARGIN_B = 10;
const BAR_HEIGHT = 62;
const BAR_INNER_PAD = 10;
/** Hold duration before navigation-selection mode arms. */
const HOLD_TO_SELECT_MS = 380;

/**
 * iOS-style floating tab bar — the liquid glass slab.
 *
 * · The bar measures ITSELF with onLayout. (The old version trusted the
 *   window width, which on web is the whole browser viewport while the app
 *   renders inside a ~420pt phone frame — so the four tab slots overflowed
 *   and every tab after Home was clipped out of existence.)
 * · One liquid pill slides between slots on an under-damped spring, stretches
 *   while it travels (squish) and settles back — the iOS segmented-control
 *   feel. It carries its own specular sheen and aqua bloom.
 * · SIGNATURE GESTURE — hold-and-slide navigation:
 *     1. Tapping a tab navigates normally (taps never enter the gesture).
 *     2. Holding any tab (~380 ms) arms selection mode with a medium haptic.
 *     3. Keeping the finger down and sliding across the bar continuously
 *        updates the candidate destination — the glass pill tracks the finger
 *        on a tight spring, candidate glyphs pop, the rest of the bar dims.
 *     4. Releasing over a valid slot commits the navigation; releasing over
 *        an invalid region (or cancelling) retains the current destination.
 *     5. The bar restores to rest on a spring.
 *   The row only captures the responder AFTER the long-press fires, so
 *   scrolling systems, system edge gestures and plain taps are untouched.
 * · Every switch ticks a selection haptic; focused glyphs pop and glow.
 */
const GlassTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();

  // Real measured width of the bar (works inside any frame, any rotation).
  const [barW, setBarW] = useState(0);
  const onBarLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setBarW((prev) => (Math.abs(prev - w) > 0.5 ? w : prev));
  }, []);

  const tabCount = state.routes.length;
  const tabW = barW > 0 ? (barW - BAR_INNER_PAD * 2) / tabCount : 0;

  // --- hold-and-slide selection state --------------------------------------
  const [selecting, setSelecting] = useState(false);
  const [candidate, setCandidate] = useState(-1);
  // Mirrors for responder callbacks, which must read fresh values without
  // waiting for a React commit.
  const selectingRef = useRef(false);
  const candidateRef = useRef(-1);
  // True once the row has captured the touch from the tab (a move happened
  // after the long-press); guards the release path against double commits.
  const capturedRef = useRef(false);
  // Safety net: if the touch that armed selection vanishes without ever
  // releasing (responder oddities, alt-tab mid-hold), selection mode must
  // not stick. Auto-restores shortly after arming.
  const armSafetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Row origin in window coordinates — `locationX` is unreliable for mouse
  // events on web, so slide tracking is computed from pageX/pageY.
  const rowRef = useRef<View | null>(null);
  const rowOriginRef = useRef({ x: 0, y: 0 });
  const originReadyRef = useRef(false);

  // The liquid pill: one shared value per property, spring-driven.
  const pillX = useSharedValue(0);
  const squish = useSharedValue(1);
  const pillOpacity = useSharedValue(0);
  // Selection-mode chrome: the slab leans forward and its rim lights up.
  const barScale = useSharedValue(1);
  const selectionGlow = useSharedValue(0);
  const { motionReduced, glass } = useAppearance();
  // The floating slab uses the named `nav` material (§ material family),
  // resolved against the user's glass-intensity setting.
  const navMaterial = glassMaterial(glass, 'nav');

  // One effect owns the pill in every state: selection tracking, first
  // measure, reduced-motion glide and the ordinary liquid travel.
  useEffect(() => {
    if (tabW <= 0) return;
    if (selecting) {
      // Tight tracking while the finger is down — direct manipulation with a
      // whisper of spring so it never teleports between slots. An invalid
      // finger position (candidate -1) eases the pill home instead of
      // freezing it somewhere meaningless.
      const target = candidate >= 0 ? candidate : state.index;
      pillX.value = withSpring(target * tabW, { damping: 26, stiffness: 520, mass: 0.85 });
      pillOpacity.value = withTiming(1, { duration: 80 });
      return;
    }
    if (pillOpacity.value === 0) {
      // First layout: land directly on the active slot — no fly-in.
      pillX.value = state.index * tabW;
      pillOpacity.value = withTiming(1, { duration: motionReduced ? 0 : 200 });
      return;
    }
    // Liquid travel: stretch while moving, spring back on arrival. Reduced
    // motion keeps the slide (it is wayfinding, not decoration) but drops the
    // squish and glides on a fixed timing instead of an overshooting spring.
    if (motionReduced) {
      pillX.value = withTiming(state.index * tabW, { duration: 180 });
      squish.value = 1;
      return;
    }
    pillX.value = withSpring(state.index * tabW, {
      damping: 17,
      stiffness: 280,
      mass: 1,
    });
    squish.value = 1.16;
    squish.value = withSpring(1, SPRINGS.release);
  }, [state.index, tabW, selecting, candidate, pillX, squish, pillOpacity, motionReduced]);

  useEffect(() => {
    barScale.value = withSpring(selecting ? 1.03 : 1, SPRINGS.gentle);
    selectionGlow.value = withTiming(selecting ? 1 : 0, { duration: motionReduced ? 0 : 180 });
  }, [selecting, barScale, selectionGlow, motionReduced]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }, { scaleX: squish.value }],
    opacity: pillOpacity.value,
  }));
  const barAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: barScale.value }],
  }));
  const selectionGlowStyle = useAnimatedStyle(() => ({
    opacity: selectionGlow.value,
  }));

  const pressTab = (routeName: string, routeKey: string, isFocused: boolean) => {
    const event = navigation.emit({
      type: 'tabPress',
      target: routeKey,
      canPreventDefault: true,
    });
    if (!isFocused && !event.defaultPrevented) {
      hapticSelection();
      navigation.navigate(routeName);
    }
  };

  // --- hold-and-slide machinery ---------------------------------------------

  /** Long-press landed on a tab: arm selection mode with that tab as seed. */
  const beginSelection = useCallback(
    (index: number) => {
      if (tabW <= 0 || selectingRef.current) return;
      selectingRef.current = true;
      capturedRef.current = false;
      candidateRef.current = index;
      setSelecting(true);
      setCandidate(index);
      hapticMedium();
      // Safety: a vanished touch must never leave the bar stuck in
      // selection mode — restore to rest on our own shortly after arming.
      if (armSafetyRef.current) clearTimeout(armSafetyRef.current);
      armSafetyRef.current = setTimeout(() => {
        armSafetyRef.current = null;
        commitSelection(false);
      }, 2200);
      // Measure the row's window origin for slide tracking (async, usually
      // back before the finger's first move; see onRowMove fallback).
      originReadyRef.current = false;
      rowRef.current?.measureInWindow((x, y) => {
        rowOriginRef.current = { x, y };
        originReadyRef.current = true;
      });
      // Web: own the gesture at the document level for its whole lifetime.
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        detachWindowTracking();
        const move = (e: PointerEvent) => {
          capturedRef.current = true;
          if (!originReadyRef.current) return;
          updateCandidateLocal(e.clientX - rowOriginRef.current.x, e.clientY - rowOriginRef.current.y);
        };
        const up = () => commitSelection(true);
        const cancel = () => commitSelection(false);
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up);
        document.addEventListener('pointercancel', cancel);
        trackingRef.current = { move, up, cancel };
      }
      navigation.emit({
        type: 'tabLongPress',
        target: state.routes[index].key,
      });
    },
    [tabW, navigation, state.routes]
  );

  /** Map a row-local point to a slot index, or -1 when outside the bar. */
  const candidateFromLocation = useCallback(
    (x: number, y: number): number => {
      if (tabW <= 0) return -1;
      // Generous vertical/horizontal slack so releasing "just outside" the
      // slab still counts — only a deliberate exit invalidates the gesture.
      if (y < -28 || y > BAR_HEIGHT + 28) return -1;
      if (x < -20 || x > barW + 20) return -1;
      const idx = Math.floor((x - BAR_INNER_PAD) / tabW);
      return Math.max(0, Math.min(tabCount - 1, idx));
    },
    [tabW, barW, tabCount]
  );

  const commitSelection = useCallback(
    (allowNavigate: boolean) => {
      if (!selectingRef.current) return;
      selectingRef.current = false;
      capturedRef.current = false;
      if (armSafetyRef.current) {
        clearTimeout(armSafetyRef.current);
        armSafetyRef.current = null;
      }
      detachWindowTracking();
      const chosen = candidateRef.current;
      candidateRef.current = -1;
      setSelecting(false);
      setCandidate(-1);
      // Release over a valid, different destination commits; releasing over
      // an invalid region or cancelling retains the current tab silently.
      if (allowNavigate && chosen >= 0 && chosen !== state.index) {
        hapticLight();
        const route = state.routes[chosen];
        pressTab(route.name, route.key, false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state]
  );

  // --- web slide tracking ----------------------------------------------------
  // RNW's responder capture does not reliably re-route move events away from
  // the pressed Touchable, so on web the slide is tracked with document-level
  // pointer listeners armed for exactly the lifetime of the gesture. Native
  // keeps the responder-capture path below (where it is dependable).
  const trackingRef = useRef<{ move: (e: PointerEvent) => void; up: () => void; cancel: () => void } | null>(null);

  const detachWindowTracking = useCallback(() => {
    const t = trackingRef.current;
    if (t && typeof document !== 'undefined') {
      document.removeEventListener('pointermove', t.move);
      document.removeEventListener('pointerup', t.up);
      document.removeEventListener('pointercancel', t.cancel);
    }
    trackingRef.current = null;
  }, []);

  const updateCandidateLocal = useCallback(
    (localX: number, localY: number) => {
      if (!selectingRef.current) return;
      if (!Number.isFinite(localX) || !Number.isFinite(localY)) return;
      const idx = candidateFromLocation(localX, localY);
      if (idx === candidateRef.current) return;
      candidateRef.current = idx;
      setCandidate(idx);
      if (idx >= 0) hapticSelection();
    },
    [candidateFromLocation]
  );

  const onRowMove = (e: GestureResponderEvent) => {
    capturedRef.current = true;
    if (!selectingRef.current) return;

    // Row-local point. locationX is the primary source on native touch; on
    // web mouse events it can be missing, so derive the origin from the
    // measured window rect (pageX/pageY) instead.
    const ne = e.nativeEvent as GestureResponderEvent['nativeEvent'] & {
      locationX?: number;
      locationY?: number;
    };
    const pageX = ne.pageX;
    const pageY = ne.pageY;
    if (!Number.isFinite(pageX) || !Number.isFinite(pageY)) return;

    if (!originReadyRef.current && Number.isFinite(ne.locationX) && Number.isFinite(ne.locationY)) {
      rowOriginRef.current = { x: pageX - (ne.locationX as number), y: pageY - (ne.locationY as number) };
      originReadyRef.current = true;
    }
    if (!originReadyRef.current) return;

    updateCandidateLocal(pageX - rowOriginRef.current.x, pageY - rowOriginRef.current.y);
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.barFloat, { marginHorizontal: BAR_MARGIN_H, marginBottom: BAR_MARGIN_B + Math.max(insets.bottom - 8, 0) }]}
    >
      {/* Aqua ambience bleeding out from under the slab — the "wet" read. */}
      <View pointerEvents="none" style={styles.underGlow} />

      <Animated.View
        style={[
          styles.bar,
          { height: BAR_HEIGHT, backgroundColor: navMaterial.fill, borderColor: navMaterial.border },
          barAnimatedStyle,
        ]}
        onLayout={onBarLayout}
      >
        {/* Material: real blur on native, backdrop-filter sampling on web.
         *  CLEAR glass — the fill is a thin tint, not a dark slab; the
         *  content behind stays legibly present through the bar. */}
        {Platform.OS !== 'web' ? (
          <BlurView intensity={Math.round(navMaterial.blur * 1.5)} tint="dark" style={StyleSheet.absoluteFill} />
        ) : (
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backdropFilter: `blur(${Math.round(navMaterial.blur * 1.5)}px) saturate(135%)` } as unknown as ViewStyle]}
          />
        )}
        {/* Light from above: the specular wash across the top edge. */}
        <LinearGradient
          colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0)']}
          locations={[0, 0.12, 0.4]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Depth: a whisper of lens shading at the bottom edge. */}
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.04)', 'rgba(0,0,0,0.14)']}
          locations={[0.55, 0.8, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Luminous rim */}
        <View style={styles.rim} pointerEvents="none" />
        {/* Selection-mode rim: the bar lights up while the finger decides. */}
        <Animated.View style={[styles.rim, styles.selectionRim, selectionGlowStyle]} pointerEvents="none" />

        {/* The sliding liquid pill */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pill,
            { width: tabW > 0 ? tabW : 1, left: BAR_INNER_PAD },
            pillStyle,
          ]}
        >
          <View style={styles.pillLens}>
            {/* Aqua body tint, brighter at the top like lit fluid. */}
            <LinearGradient
              colors={['rgba(59, 240, 223, 0.30)', 'rgba(59, 240, 223, 0.08)', 'rgba(59, 240, 223, 0.16)']}
              locations={[0, 0.55, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            {/* travelling specular streak */}
            <LinearGradient
              colors={['rgba(220, 255, 251, 0.34)', 'rgba(220, 255, 251, 0.04)', 'rgba(220, 255, 251, 0)']}
              locations={[0, 0.22, 0.55]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
        </Animated.View>

        {/* Tabs. The row only claims the responder during an active hold-and-
            slide (capture gate below) — plain taps flow to the tabs untouched,
            and system gestures are unaffected because selection mode is armed
            strictly by the long-press. */}
        <View
          ref={rowRef}
          style={[styles.tabRow, { paddingHorizontal: BAR_INNER_PAD }]}
          onMoveShouldSetResponderCapture={() => selectingRef.current}
          onResponderMove={onRowMove}
          onResponderRelease={() => commitSelection(true)}
          onResponderTerminate={() => commitSelection(false)}
        >
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const focused = state.index === index;
            const label = (options.tabBarLabel ?? route.name) as string;
            const Icon = TAB_ICONS[route.name] ?? Home;

            return (
              <AnimatedTab
                key={route.key}
                focused={focused}
                label={label}
                width={tabW}
                selecting={selecting}
                isCandidate={selecting && candidate === index}
                onPress={() => pressTab(route.name, route.key, focused)}
                onHold={() => beginSelection(index)}
                onPressOut={() => {
                  // A release without any move never reaches the row (the tab
                  // still owns the touch) — commit here. When the row HAS
                  // captured (a slide is in progress), the Touchable's press
                  // ends via termination and must NOT commit; the row's own
                  // release handles it.
                  if (!capturedRef.current) commitSelection(true);
                }}
              >
                <View style={focused || (selecting && candidate === index) ? styles.glyphGlow : null}>
                  <Icon
                    color={focused || (selecting && candidate === index) ? COLORS.accent.bright : COLORS.text.muted}
                    size={SIZES.icon.md}
                    strokeWidth={focused || (selecting && candidate === index) ? 2.4 : 1.8}
                    fill={focused || (selecting && candidate === index) ? COLORS.accent.soft : 'transparent'}
                  />
                </View>
              </AnimatedTab>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
};

const TAB_ICONS: Record<string, typeof Home> = {
  HomeTab: Home,
  SearchTab: Search,
  LibraryTab: Library,
  YouTab: User,
};

  /**
   * One tab slot. Spring-pops its glyph when focus lands on it, so every
   * switch has a physical beat — the iOS "app icon jiggle" energy, tamed.
   * During hold-and-slide the candidate slot pops harder while the rest of
   * the bar dims, previewing the destination before the finger lifts.
   *
   * Hold detection uses an explicit press-in timer rather than Touchable's
   * onLongPress: the timer behaves identically for touch, mouse and pen on
   * every platform, and keeps arming fully under our control.
   */
const AnimatedTab: React.FC<{
  focused: boolean;
  label: string;
  width: number;
  selecting: boolean;
  isCandidate: boolean;
  onPress: () => void;
  onHold: () => void;
  onPressOut: () => void;
  children: React.ReactNode;
}> = ({ focused, label, width, selecting, isCandidate, onPress, onHold, onPressOut, children }) => {
  const pop = useSharedValue(1);
  const dim = useSharedValue(1);
  const { motionReduced } = useAppearance();
  const lit = focused || isCandidate;

  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startHold = useCallback(() => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      onHold();
    }, HOLD_TO_SELECT_MS);
  }, [onHold]);

  const cancelHold = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  useEffect(() => cancelHold, [cancelHold]);

  useEffect(() => {
    const target = isCandidate ? 1.2 : focused ? 1.14 : 1;
    if (motionReduced) {
      pop.value = target;
      return;
    }
    pop.value = withSpring(target, {
      damping: target > 1 ? 13 : 16,
      stiffness: 380,
      mass: 0.7,
    });
  }, [focused, isCandidate, pop, motionReduced]);

  useEffect(() => {
    dim.value = withTiming(selecting && !isCandidate ? 0.55 : 1, {
      duration: motionReduced ? 0 : 140,
    });
  }, [selecting, isCandidate, dim, motionReduced]);

  const glyphStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
  }));
  const dimStyle = useAnimatedStyle(() => ({
    opacity: dim.value,
  }));

  return (
    <Animated.View style={[styles.tabSlot, width > 0 ? { width } : null]}>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={startHold}
        onPressOut={onPressOut}
        style={styles.tabPress}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: focused }}
        aria-selected={focused}
        aria-current={focused ? 'page' : undefined}
      >
        <Animated.View style={dimStyle}>
          <Animated.View style={[styles.tabGlyph, glyphStyle]}>{children}</Animated.View>
          <Text
            style={[styles.tabLabel, lit ? styles.tabLabelActive : null]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </Animated.View>
      </AnimatedPressable>
    </Animated.View>
  );
};

// TouchableOpacity wrapped by reanimated so the pop transform applies.
const AnimatedPressable = Animated.createAnimatedComponent(TouchableOpacity);

export const TabNavigator = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="SearchTab"
        component={SearchScreen}
        options={{ tabBarLabel: 'Search' }}
      />
      <Tab.Screen
        name="LibraryTab"
        component={LibraryScreen}
        options={{ tabBarLabel: 'Library' }}
      />
      <Tab.Screen
        name="YouTab"
        component={YouScreen}
        options={{ tabBarLabel: 'You' }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  barFloat: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  underGlow: {
    position: 'absolute',
    left: 26,
    right: 26,
    bottom: -7,
    height: 30,
    borderRadius: 999,
    backgroundColor: 'rgba(59, 240, 223, 0.13)',
    shadowColor: '#3BF0DF',
    shadowOpacity: 0.4,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
  },
  bar: {
    borderRadius: 31,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(190, 250, 243, 0.22)',
    // Pre-measure fallback only — the `nav` material fill wins at runtime.
    backgroundColor: 'rgba(8, 21, 23, 0.36)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.42,
    shadowRadius: 28,
    elevation: 16,
  },
  rim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 31,
    borderWidth: 1,
    borderColor: 'rgba(59, 240, 223, 0.10)',
  },
  selectionRim: {
    borderColor: 'rgba(59, 240, 223, 0.45)',
    shadowColor: '#3BF0DF',
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  pill: {
    position: 'absolute',
    top: (BAR_HEIGHT - 48) / 2,
    height: 48,
  },
  pillLens: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 23,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(59, 240, 223, 0.38)',
    backgroundColor: 'rgba(59, 240, 223, 0.10)',
    shadowColor: '#3BF0DF',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  tabRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPress: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  glyphGlow: {
    shadowColor: '#3BF0DF',
    shadowOpacity: 0.9,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  tabGlyph: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.micro.fontSize,
    letterSpacing: 0.2,
    color: COLORS.text.muted,
  },
  tabLabelActive: {
    color: COLORS.accent.primary,
    textShadowColor: 'rgba(59, 240, 223, 0.55)',
    textShadowRadius: 8,
  },
});
