import React, { useEffect } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Home, Search, Library, User } from 'lucide-react-native';
import { COLORS, SIZES, FONTS, TYPE, SPRINGS } from '../constants/theme';
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
 * iOS-style floating tab bar.
 *
 * One glass slab hovers over the content with a liquid accent pill that
 * *slides* between tabs on a spring (never jumps), icons pop as they take
 * focus, and every switch ticks a selection haptic. This is the custom
 * `tabBar` of the bottom-tab navigator, so gestures/props stay stock.
 */
const GlassTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const tabCount = state.routes.length;
  const tabW = (width - BAR_MARGIN_H * 2 - BAR_INNER_PAD * 2) / tabCount;

  // The liquid pill: one shared value, interpolated per slot, spring-driven.
  const pillX = useSharedValue(state.index * tabW);
  // Liquid squish: the pill stretches wide on switch, then springs back —
  // the same fluid overshoot iOS uses on segmented controls.
  const squish = useSharedValue(1);
  useEffect(() => {
    pillX.value = withSpring(state.index * tabW, {
      damping: 20,
      stiffness: 320,
      mass: 0.9,
    });
    squish.value = 1.09;
    squish.value = withSpring(1, SPRINGS.release);
  }, [state.index, tabW, pillX, squish]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }, { scaleX: squish.value }],
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
      <View style={[styles.bar, { height: BAR_HEIGHT }]}>
        {/* Material: real blur on native, layered translucency everywhere. */}
        {Platform.OS !== 'web' ? (
          <BlurView intensity={52} tint="dark" style={StyleSheet.absoluteFill} />
        ) : null}
        <LinearGradient
          colors={['rgba(16, 21, 21, 0.78)', 'rgba(4, 10, 11, 0.94)']}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.03)', 'rgba(255,255,255,0)']}
          locations={[0, 0.12, 0.42]}
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
            { width: tabW, left: BAR_INNER_PAD },
            pillStyle,
          ]}
        >
          <View style={styles.pillInner} />
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
                <Icon
                  color={focused ? COLORS.accent.primary : COLORS.text.muted}
                  size={SIZES.icon.md}
                  strokeWidth={focused ? 2.4 : 1.8}
                  fill={focused ? 'rgba(53,214,198,0.16)' : 'transparent'}
                />
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

  useEffect(() => {
    pop.value = withSpring(focused ? 1.14 : 1, {
      damping: focused ? 13 : 16,
      stiffness: 380,
      mass: 0.7,
    });
  }, [focused, pop]);

  const glyphStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
  }));

  return (
    <Animated.View style={[styles.tabSlot, { width }]}>
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
  bar: {
    borderRadius: 31,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(14, 18, 18, 0.86)',
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
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  pill: {
    position: 'absolute',
    top: (BAR_HEIGHT - 48) / 2,
    height: 48,
  },
  pillInner: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 24,
    backgroundColor: 'rgba(59, 240, 223, 0.13)',
    borderWidth: 1,
    borderColor: 'rgba(59, 240, 223, 0.30)',
    shadowColor: COLORS.accent.primary,
    shadowOpacity: 0.35,
    shadowRadius: 14,
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
  },
});
