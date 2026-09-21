import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight } from 'lucide-react-native';
import { COLORS, FONTS, SIZES, TYPE } from '../constants/theme';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

const { width, height } = Dimensions.get('window');

type RootStackParamList = {
  Main: undefined;
  ProfileSetup: undefined;
};

export default function OnboardingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View style={styles.container}>
      {/* Quiet cinematic backdrop: one soft accent bloom, deep falloff. */}
      <LinearGradient
        colors={['rgba(61, 214, 195, 0.10)', 'rgba(6, 8, 8, 0)']}
        locations={[0, 0.6]}
        start={{ x: 0.2, y: 0.1 }}
        end={{ x: 0.8, y: 0.9 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['transparent', COLORS.background]}
        locations={[0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.subtitleTop}>MUSIC</Text>
          <Text style={styles.subtitleTop}>BEYOND</Text>
          <Text style={styles.subtitleTop}>NOISE</Text>
        </View>

        <View style={styles.centerContent}>
          <View style={styles.accentRule} />
          <Text style={styles.title}>A U D I A</Text>
          <Text style={styles.tagline}>YOUR MUSIC. YOUR WAY.</Text>
        </View>

        <View style={styles.bottomContent}>
          <TouchableOpacity
            style={styles.button}
            activeOpacity={0.85}
            onPress={() => navigation.replace('ProfileSetup')}
            accessibilityRole="button"
            accessibilityLabel="Get started"
          >
            <Text style={styles.buttonText}>Get Started</Text>
            <View style={styles.iconCircle}>
              <ArrowRight color="#04211D" size={SIZES.icon.sm + 2} />
            </View>
          </TouchableOpacity>

          <Text style={styles.footerText}>LISTEN FREELY.</Text>
          <Text style={styles.footerText}>LIVE FULLY.</Text>
          <Text style={styles.madeBy}>MADE BY ARK DURRANI (PATHAN)</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    padding: SIZES.xl,
    justifyContent: 'space-between',
    paddingTop: 80,
    paddingBottom: 60,
  },
  header: {
    alignItems: 'flex-start',
  },
  subtitleTop: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.overline.fontSize,
    letterSpacing: 3,
    color: COLORS.text.secondary,
    lineHeight: 18,
  },
  centerContent: {
    alignItems: 'center',
  },
  accentRule: {
    width: 28,
    height: 2,
    borderRadius: 1,
    backgroundColor: COLORS.accent.primary,
    marginBottom: SIZES.lg,
  },
  title: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.display.fontSize,
    letterSpacing: TYPE.display.letterSpacing,
    color: COLORS.text.primary,
    marginBottom: SIZES.md,
  },
  tagline: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.overline.fontSize,
    letterSpacing: 3,
    color: COLORS.text.secondary,
  },
  bottomContent: {
    alignItems: 'center',
    width: '100%',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.accent.primary,
    borderRadius: SIZES.radius.pill,
    paddingVertical: SIZES.md,
    paddingHorizontal: SIZES.lg,
    width: '100%',
    minHeight: SIZES.touchTarget + 8,
    marginBottom: SIZES.xl,
  },
  buttonText: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.headline.fontSize,
    color: '#04211D',
    flex: 1,
    textAlign: 'center',
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(4, 33, 29, 0.14)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  madeBy: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.overline.fontSize,
    letterSpacing: 3,
    color: COLORS.text.muted,
    marginTop: SIZES.md,
    opacity: 0.8,
  },
  footerText: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.overline.fontSize,
    letterSpacing: 2,
    color: COLORS.text.muted,
    lineHeight: 18,
  },
});
