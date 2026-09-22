import React, { useCallback } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TabNavigator } from './TabNavigator';
import { COLORS } from '../constants/theme';
import { useLibrary } from '../hooks/useLibrary';
import LaunchScreen from '../screens/Launch';
import ProfileSetupScreen from '../screens/ProfileSetup';
import PlaylistDetailScreen from '../screens/PlaylistDetail';
import SettingsScreen from '../screens/Settings';
import NowPlayingScreen from '../screens/NowPlaying';

type RootStackParamList = {
  Launch: undefined;
  ProfileSetup: undefined;
  Main: undefined;
  Playlist: { playlistId: string };
  Settings: undefined;
  NowPlaying: undefined;
};

const Stack = createNativeStackNavigator();

const AudiaTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: COLORS.background,
    text: COLORS.text.primary,
    primary: COLORS.accent.primary,
    border: COLORS.hairline,
    card: COLORS.background,
  },
};

/**
 * Brand reveal gate: after the launch animation the screen replaces itself
 * with the user's next destination. Defined at module level so RootNavigator
 * re-renders (library updates, etc.) never remount it mid-animation.
 */
const LaunchGate = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { profile } = useLibrary();

  const handleDone = useCallback(() => {
    navigation.replace(profile.completed ? 'Main' : 'ProfileSetup');
  }, [profile.completed, navigation]);

  return <LaunchScreen onDone={handleDone} />;
};

/**
 * Launch flow, per the brand reference:
 *
 *   profile incomplete: Launch (brand reveal) -> ProfileSetup -> Main
 *   returning user:     Launch (brand reveal, tap to skip) -> Main
 *
 * The native splash already draws the logo on a matching background, so the
 * brand reveal continues seamlessly from it and hands off to Main with a
 * cross-fade. The reveal is short and skippable, so it never stands between
 * the user and their music.
 */
export const RootNavigator = () => {
  const { isLoaded } = useLibrary();

  // Wait for persistence before choosing a route, otherwise a returning
  // user is flashed the onboarding screen for a frame.
  if (!isLoaded) return null;

  return (
    <NavigationContainer theme={AudiaTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Launch">
        <Stack.Screen name="Launch" options={{ animation: 'fade' }}>
          {() => <LaunchGate />}
        </Stack.Screen>
        <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
        <Stack.Screen name="Main" component={TabNavigator} />
        <Stack.Screen name="Playlist" component={PlaylistDetailScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen
          name="NowPlaying"
          component={NowPlayingScreen}
          options={{ presentation: 'fullScreenModal' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
