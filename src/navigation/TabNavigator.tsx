import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Search, Library, User } from 'lucide-react-native';
import { COLORS, SIZES, FONTS, TYPE } from '../constants/theme';

// Screens
import HomeScreen from '../screens/Home';
import SearchScreen from '../screens/Search';
import LibraryScreen from '../screens/Library';
import YouScreen from '../screens/You';

const Tab = createBottomTabNavigator();

/**
 * Tab bar — 4 tabs: Home, Search, Library, You.
 * The bar is a floating glass sheet: translucent fill, luminous top hairline,
 * and an active treatment where the icon glows through the accent.
 */
export const TabNavigator = () => {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);
  const barHeight = 62 + bottomInset;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: [styles.tabBar, { height: barHeight, paddingBottom: bottomInset }],
        tabBarBackground: () => (
          <View style={styles.tabBarBackground}>
            {/* Liquid glass: translucent + gradient light from above. */}
            <LinearGradient
              colors={['rgba(12, 15, 15, 0.52)', 'rgba(12, 15, 15, 0.96)']}
              locations={[0, 0.62]}
              style={StyleSheet.absoluteFill}
            />
            {/* Specular top edge */}
            <LinearGradient
              colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0)']}
              locations={[0, 0.12, 0.4]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.tabSpecular}
            />
            <View style={styles.tabBarHairline} />
          </View>
        ),
        tabBarActiveTintColor: COLORS.accent.primary,
        tabBarInactiveTintColor: COLORS.text.muted,
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} label="Home">
              <Home
                color={color}
                size={SIZES.icon.md}
                strokeWidth={focused ? 2.4 : 1.7}
                fill={focused ? 'rgba(53,214,198,0.14)' : 'transparent'}
              />
            </TabIcon>
          ),
        }}
      />
      <Tab.Screen
        name="SearchTab"
        component={SearchScreen}
        options={{
          tabBarLabel: 'Search',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} label="Search">
              <Search color={color} size={SIZES.icon.md} strokeWidth={focused ? 2.4 : 1.7} />
            </TabIcon>
          ),
        }}
      />
      <Tab.Screen
        name="LibraryTab"
        component={LibraryScreen}
        options={{
          tabBarLabel: 'Library',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} label="Library">
              <Library
                color={color}
                size={SIZES.icon.md}
                strokeWidth={focused ? 2.4 : 1.7}
                fill={focused ? 'rgba(53,214,198,0.14)' : 'transparent'}
              />
            </TabIcon>
          ),
        }}
      />
      <Tab.Screen
        name="YouTab"
        component={YouScreen}
        options={{
          tabBarLabel: 'You',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} label="You">
              <User
                color={color}
                size={SIZES.icon.md}
                strokeWidth={focused ? 2.4 : 1.7}
                fill={focused ? 'rgba(53,214,198,0.14)' : 'transparent'}
              />
            </TabIcon>
          ),
        }}
      />
    </Tab.Navigator>
  );
};

/**
 * Active treatment: the selected tab reads through the accent colour on both
 * icon and label, with a soft glow halo behind the glyph.
 */
const TabIcon: React.FC<{ focused: boolean; label: string; children: React.ReactNode }> = ({
  focused,
  label,
  children,
}) => (
  <View
    style={styles.tabIconWrap}
    accessibilityRole="tab"
    accessibilityLabel={label}
    accessibilityState={{ selected: focused }}
  >
    {focused ? <View style={styles.tabGlow} /> : null}
    <View style={styles.tabIconGlyph}>{children}</View>
  </View>
);

const styles = StyleSheet.create({
  tabBarBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  tabSpecular: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 18,
  },
  tabBarHairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: COLORS.accent.border,
  },
  tabBar: {
    position: 'absolute',
    borderTopWidth: 0,
    elevation: 0,
    backgroundColor: 'transparent',
    paddingTop: 6,
  },
  tabIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 48,
  },
  tabGlow: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(53, 214, 198, 0.14)',
    shadowColor: COLORS.accent.primary,
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  tabIconGlyph: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBarLabel: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.micro.fontSize,
    marginTop: 3,
    letterSpacing: 0.2,
  },
});
