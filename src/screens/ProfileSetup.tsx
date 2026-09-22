import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, FONTS, SIZES, TYPE } from '../constants/theme';
import { Gender } from '../services/LibraryService';
import { useLibrary } from '../hooks/useLibrary';

type RootStackParamList = { Main: undefined };

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'unspecified', label: 'Prefer not to say' },
];

/**
 * One-time profile capture, shown after Get Started.
 *
 * Deliberately minimal and entirely local: a name to personalise the greeting
 * and an optional gender. Neither is required -- an empty name simply falls
 * back to the generic greeting, and gender defaults to 'Prefer not to say'.
 */
export default function ProfileSetupScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { saveProfile } = useLibrary();

  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('unspecified');
  const [nameFocused, setNameFocused] = useState(false);

  const finish = () => {
    Keyboard.dismiss();
    saveProfile({ name: name.trim(), gender, completed: true });
    navigation.replace('Main');
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={[styles.container, { paddingTop: insets.top + SIZES.xxl }]}>
        <View style={styles.header}>
          <Text style={styles.kicker}>ONE LAST THING</Text>
          <Text style={styles.title}>Who's listening?</Text>
          <Text style={styles.subtitle}>
            Stays on this device. You can leave anything blank.
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>NAME</Text>
          <TextInput
            style={[styles.input, nameFocused && styles.inputFocused]}
            value={name}
            onChangeText={setName}
            onFocus={() => setNameFocused(true)}
            onBlur={() => setNameFocused(false)}
            placeholder="Your name"
            placeholderTextColor={COLORS.text.muted}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={finish}
            maxLength={40}
            accessibilityLabel="Your name"
          />

          <Text style={[styles.label, styles.labelSpaced]}>GENDER</Text>
          <View style={styles.genderRow}>
            {GENDERS.map((option) => {
              const active = gender === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.genderPill, active && styles.genderPillActive]}
                  activeOpacity={0.8}
                  onPress={() => setGender(option.value)}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.genderText, active && styles.genderTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + SIZES.xl }]}>
          <TouchableOpacity
            style={styles.button}
            activeOpacity={0.85}
            onPress={finish}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Text style={styles.buttonText}>
              {name.trim() ? `Continue as ${name.trim()}` : 'Continue'}
            </Text>
            <View style={styles.iconCircle}>
              <ArrowRight color="#04211D" size={SIZES.icon.sm + 2} />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: SIZES.lg,
  },
  header: {
    marginBottom: SIZES.xxl,
  },
  kicker: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.overline.fontSize,
    letterSpacing: 3,
    color: COLORS.text.muted,
    marginBottom: SIZES.md,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.title1.fontSize + 4,
    lineHeight: TYPE.title1.lineHeight + 6,
    color: COLORS.text.primary,
    marginBottom: SIZES.sm,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.secondary,
    lineHeight: 20,
  },
  form: {
    flex: 1,
  },
  label: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.micro.fontSize,
    letterSpacing: 2,
    color: COLORS.text.muted,
    marginBottom: SIZES.sm,
  },
  labelSpaced: {
    marginTop: SIZES.xl,
  },
  input: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.title3.fontSize,
    color: COLORS.text.primary,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(24, 229, 213, 0.18)',
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.md,
  },
  inputFocused: {
    borderColor: COLORS.accent.primary,
    shadowColor: COLORS.accent.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  genderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SIZES.sm,
  },
  genderPill: {
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm + 2,
    borderRadius: SIZES.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: COLORS.surfaceElevated,
    minHeight: SIZES.touchTarget - 6,
    justifyContent: 'center',
  },
  genderPillActive: {
    backgroundColor: COLORS.accent.primary,
    borderColor: COLORS.accent.primary,
    shadowColor: COLORS.accent.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  genderText: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.secondary,
  },
  genderTextActive: {
    color: COLORS.text.dark,
    fontWeight: '600',
  },
  footer: {
    paddingTop: SIZES.lg,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.accent.primary,
    borderRadius: SIZES.radius.pill,
    paddingVertical: SIZES.md,
    paddingHorizontal: SIZES.lg,
    minHeight: SIZES.touchTarget + 8,
    shadowColor: COLORS.accent.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonText: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.headline.fontSize,
    color: COLORS.text.dark,
    fontWeight: '700',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(4, 16, 20, 0.16)',
  },
});
