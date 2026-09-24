import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
  const barHeight = 62 + bottomInset;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: [styles.tabBar, { height: barHeight, paddingBottom: bottomInset }],
        tabBarBackground: () => (
          <View style={styles.tabBarBackground}>
            {/* Blends the bar into the page's ambient light instead of
                sitting on it as a separate grey band, per the reference. */}
            <LinearGradient
              colors={['rgba(12, 15, 15, 0.55)', 'rgba(12, 15, 15, 0.97)']}
              locations={[0, 0.65]}
              style={StyleSheet.absoluteFill}
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
              <Home color={color} size={SIZES.icon.md} strokeWidth={focused ? 2.4 : 1.7} fill={focused ? 'rgba(53,214,198,0.14)' : 'transparent'} />
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
        name="HistoryTab"
        component={HistoryScreen}
        options={{
          tabBarLabel: 'History',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} label="History">
              <Clock color={color} size={SIZES.icon.md} strokeWidth={focused ? 2.4 : 1.7} />
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
              <Library color={color} size={SIZES.icon.md} strokeWidth={focused ? 2.4 : 1.7} fill={focused ? 'rgba(53,214,198,0.14)' : 'transparent'} />
            </TabIcon>
          ),
        }}
      />
    </Tab.Navigator>
  );
};

/**
 * Active treatment, per the reference: the selected tab reads through the
 * accent colour on both icon and label, and a heavier stroke weight. Inactive
 * tabs stay quiet — muted colour, lighter stroke — so the selection reads
 * without an extra indicator chrome.
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
