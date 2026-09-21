import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Search, Library, Clock } from 'lucide-react-native';
import { COLORS, SIZES, FONTS, TYPE } from '../constants/theme';

// Placeholder screens
import HomeScreen from '../screens/Home';
import SearchScreen from '../screens/Search';
import LibraryScreen from '../screens/Library';
import HistoryScreen from '../screens/History';

const Tab = createBottomTabNavigator();

export const TabNavigator = () => {
  const insets = useSafeAreaInsets();
  // Use the real bottom inset so the bar never sits under the gesture bar or 3-button nav.
  // Fallback 8 keeps spacing on devices that report 0 before the first layout pass.
  const bottomInset = Math.max(insets.bottom, 8);
  const barHeight = 56 + bottomInset;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: [styles.tabBar, { height: barHeight, paddingBottom: bottomInset }],
        tabBarBackground: () => <View style={styles.tabBarBackground} />,
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
            <Home color={color} size={SIZES.icon.md} strokeWidth={focused ? 2.4 : 1.8} fill={focused ? 'rgba(61,214,195,0.12)' : 'transparent'} />
          ),
        }}
      />
      <Tab.Screen
        name="SearchTab"
        component={SearchScreen}
        options={{
          tabBarLabel: 'Search',
          tabBarIcon: ({ color, focused }) => (
            <Search color={color} size={SIZES.icon.md} strokeWidth={focused ? 2.4 : 1.8} />
          ),
        }}
      />
      <Tab.Screen
        name="HistoryTab"
        component={HistoryScreen}
        options={{
          tabBarLabel: 'History',
          tabBarIcon: ({ color, focused }) => (
            <Clock color={color} size={SIZES.icon.md} strokeWidth={focused ? 2.4 : 1.8} />
          ),
        }}
      />
      <Tab.Screen
        name="LibraryTab"
        component={LibraryScreen}
        options={{
          tabBarLabel: 'Library',
          tabBarIcon: ({ color, focused }) => (
            <Library color={color} size={SIZES.icon.md} strokeWidth={focused ? 2.4 : 1.8} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBarBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Opaque: blur does not reliably hide content behind it on Android.
    backgroundColor: COLORS.surfaceRaised,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.hairline,
  },
  tabBar: {
    position: 'absolute',
    borderTopWidth: 0,
    elevation: 0,
    backgroundColor: 'transparent',
    paddingTop: 10,
  },
  tabBarLabel: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.micro.fontSize,
    marginTop: 2,
    letterSpacing: 0.2,
  },
});
