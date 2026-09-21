import React, { useCallback, useState } from 'react';
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
const LaunchGate = ({ onDone }: { onDone: (profileComplete: boolean) => void }) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { profile } = useLibrary();

  const handleDone = useCallback(() => {
    onDone(profile.completed);
    navigation.replace(profile.completed ? 'Main' : 'ProfileSetup');
  }, [onDone, profile.completed, navigation]);

  return <LaunchScreen onDone={handleDone} />;
};

/**
 * Launch flow, per the brand reference:
 *
 *   profile incomplete: Launch (brand reveal) -> ProfileSetup -> Main
 *   returning user:     Main directly — no gate between them and their music
 *
 * The native splash already showed the logo on a matching background, so
 * returning users still get the brand moment at every cold start without a
 * second full animation blocking their way.
 */
export const RootNavigator = () => {
  const { profile, isLoaded } = useLibrary();
  /** True while the brand reveal is still the entry route (every cold start). */
  const [showLaunch, setShowLaunch] = useState(true);

  // Wait for persistence before choosing a route, otherwise a returning
  // user is flashed the onboarding screen for a frame.
  if (!isLoaded) return null;

  const initialRoute = 'Launch';

  return (
    <NavigationContainer theme={AudiaTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
        <Stack.Screen name="Launch">
          {() => <LaunchGate onDone={() => setShowLaunch(false)} />}
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
