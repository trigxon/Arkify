import React, { useCallback, useEffect, useState } from 'react';
import {
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Home, Search, Library, User } from 'lucide-react-native';
import { COLORS, SIZES, FONTS, TYPE, SPRINGS } from '../constants/theme';
import { useAppearance } from '../hooks/useAppearance';
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

  // The liquid pill: one shared value per property, spring-driven.
  const pillX = useSharedValue(0);
  const squish = useSharedValue(1);
  const pillOpacity = useSharedValue(0);
  const { motionReduced } = useAppearance();

  useEffect(() => {
    if (tabW <= 0) return;
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
  }, [state.index, tabW, pillX, squish, pillOpacity, motionReduced]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }, { scaleX: squish.value }],
    opacity: pillOpacity.value,
  }));

  const pressTab = (routeName: string, routeKey: string, isFocused: boolean) => {
    const event = navigation.emit({
      type: 'tabPress',
      target: routeKey,
      canPreventDefault: true,
    });
    if (!isFocused && !event.defaultPrevented) {
      if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => undefined);
      navigation.navigate(routeName);
    }
  };

  const longPressTab = (routeKey: string) => {
    navigation.emit({
      type: 'tabLongPress',
      target: routeKey,
    });
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.barFloat, { marginHorizontal: BAR_MARGIN_H, marginBottom: BAR_MARGIN_B + Math.max(insets.bottom - 8, 0) }]}
    >
      {/* Aqua ambience bleeding out from under the slab — the "wet" read. */}
      <View pointerEvents="none" style={styles.underGlow} />

      <View style={[styles.bar, { height: BAR_HEIGHT }]} onLayout={onBarLayout}>
        {/* Material: real blur on native, layered translucency everywhere. */}
        {Platform.OS !== 'web' ? (
          <BlurView intensity={56} tint="dark" style={StyleSheet.absoluteFill} />
        ) : null}
        <LinearGradient
          colors={['rgba(14, 26, 27, 0.72)', 'rgba(4, 10, 11, 0.92)']}
          style={StyleSheet.absoluteFill}
        />
        {/* Light from above: the specular wash across the top edge. */}
        <LinearGradient
          colors={['rgba(255,255,255,0.26)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0)']}
          locations={[0, 0.14, 0.44]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Depth: the lower glass thickens and darkens, like a real lens. */}
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.10)', 'rgba(0,0,0,0.34)']}
          locations={[0.52, 0.76, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Luminous rim */}
        <View style={styles.rim} pointerEvents="none" />

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

        {/* Tabs */}
        <View style={[styles.tabRow, { paddingHorizontal: BAR_INNER_PAD }]}>
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
                onPress={() => pressTab(route.name, route.key, focused)}
                onLongPress={() => longPressTab(route.key)}
              >
                <View style={focused ? styles.glyphGlow : null}>
                  <Icon
                    color={focused ? COLORS.accent.bright : COLORS.text.muted}
                    size={SIZES.icon.md}
                    strokeWidth={focused ? 2.4 : 1.8}
                    fill={focused ? COLORS.accent.soft : 'transparent'}
                  />
                </View>
              </AnimatedTab>
            );
          })}
        </View>
      </View>
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
 */
const AnimatedTab: React.FC<{
  focused: boolean;
  label: string;
  width: number;
  onPress: () => void;
  onLongPress: () => void;
  children: React.ReactNode;
}> = ({ focused, label, width, onPress, onLongPress, children }) => {
  const pop = useSharedValue(1);
  const { motionReduced } = useAppearance();

  useEffect(() => {
    if (motionReduced) {
      pop.value = 1;
      return;
    }
    pop.value = withSpring(focused ? 1.14 : 1, {
      damping: focused ? 13 : 16,
      stiffness: 380,
      mass: 0.7,
    });
  }, [focused, pop, motionReduced]);

  const glyphStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
  }));

  return (
    <Animated.View style={[styles.tabSlot, width > 0 ? { width } : null]}>
      <AnimatedPressable
        onPress={onPress}
        onLongPress={onLongPress}
        style={styles.tabPress}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: focused }}
      >
        <Animated.View style={[styles.tabGlyph, glyphStyle]}>{children}</Animated.View>
        <Text
          style={[styles.tabLabel, focused ? styles.tabLabelActive : null]}
          numberOfLines={1}
        >
          {label}
        </Text>
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
    backgroundColor: 'rgba(59, 240, 223, 0.20)',
    shadowColor: '#3BF0DF',
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  bar: {
    borderRadius: 31,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(159, 244, 235, 0.16)',
    backgroundColor: 'rgba(12, 22, 24, 0.84)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.5,
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
