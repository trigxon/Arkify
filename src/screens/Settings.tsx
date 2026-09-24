import React, { useCallback, useRef, useState } from 'react';
import {
  Keyboard,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Headphones,
  Heart,
  Music2,
  PenLine,
  User,
} from 'lucide-react-native';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SIZES, FONTS, TYPE } from '../constants/theme';
import { Gender } from '../services/LibraryService';
import { useLibrary } from '../hooks/useLibrary';
import { PlaybackSourceSheet } from '../components/player/PlaybackSourceSheet';

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'unspecified', label: 'Prefer not to say' },
];

const REPO_URL = 'https://github.com/trigxon/Arkify';
const GPL_URL = 'https://www.gnu.org/licenses/gpl-3.0.en.html';
const NEWPIPE_URL = 'https://github.com/TeamNewPipe/NewPipeExtractor';

/**
 * Settings, profile and the legal notices.
 *
 * Arkify is GPL-3.0-or-later because it links the NewPipe Extractor, and that
 * licence expects the terms and the upstream attribution to be discoverable
 * from the app itself rather than only in the repository. This screen is where
 * they live — the licence card collapses to a summary and expands to the full
 * grant, so the notice is never truncated away.
 */
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { profile, saveProfile, history, playlists, liked } = useLibrary();

  const [name, setName] = useState(profile.name);
  const [showSource, setShowSource] = useState(false);
  const [licenceExpanded, setLicenceExpanded] = useState(false);
  const nameInputRef = useRef<TextInput>(null);

  const version =
    Constants.expoConfig?.version ?? Constants.manifest2?.extra?.expoClient?.version ?? '1.0.0';

  const commitName = useCallback(() => {
    const trimmed = name.trim();
    if (trimmed !== profile.name) saveProfile({ name: trimmed });
    Keyboard.dismiss();
  }, [name, profile.name, saveProfile]);

  const open = useCallback((url: string) => {
    void Linking.openURL(url).catch(() => undefined);
  }, []);

  /** The profile card is the way into editing, so it opens the name field. */
  const editProfile = useCallback(() => {
    nameInputRef.current?.focus();
  }, []);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + SIZES.sm }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft color={COLORS.text.primary} size={SIZES.icon.lg} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + SIZES.xxl }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ---- Profile summary ---- */}
        <Text style={styles.sectionLabel}>PROFILE</Text>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={editProfile}
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
        >
          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              {profile.name?.trim() ? (
                <Text style={styles.avatarInitial}>{profile.name.trim()[0].toUpperCase()}</Text>
              ) : (
                <User color={COLORS.accent.primary} size={SIZES.icon.md + 2} />
              )}
            </View>
            <View style={styles.avatarText}>
              <Text style={styles.avatarName} numberOfLines={1}>
                {profile.name || 'No name set'}
              </Text>
              <Text style={styles.avatarMeta}>
                {GENDERS.find((g) => g.value === profile.gender)?.label}
              </Text>
            </View>
            <ChevronRight color={COLORS.text.muted} size={SIZES.icon.sm} />
          </View>
        </TouchableOpacity>

        {/* ---- Name ---- */}
        <Text style={styles.sectionLabel}>NAME</Text>
        <View style={styles.card}>
          <View style={styles.nameRow}>
            <TextInput
              ref={nameInputRef}
              style={styles.nameInput}
              value={name}
              onChangeText={setName}
              onBlur={commitName}
              onSubmitEditing={commitName}
              placeholder="Your name"
              placeholderTextColor={COLORS.text.muted}
              returnKeyType="done"
              maxLength={40}
              accessibilityLabel="Your name"
            />
            <TouchableOpacity
              onPress={editProfile}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Edit your name"
            >
              <PenLine color={COLORS.text.secondary} size={SIZES.icon.sm + 2} strokeWidth={1.9} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ---- Gender ---- */}
        <Text style={styles.sectionLabel}>GENDER</Text>
        <View style={styles.pillRow}>
          {GENDERS.map((option) => {
            const active = profile.gender === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.pill, active && styles.pillActive]}
                activeOpacity={0.85}
                onPress={() => saveProfile({ gender: option.value })}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ---- Library stats ---- */}
        <Text style={styles.sectionLabel}>YOUR LIBRARY</Text>
        <View style={[styles.card, styles.statsCard]}>
          <Stat Icon={Heart} value={liked.length} label="Liked" />
          <Stat Icon={Music2} value={playlists.length} label="Playlists" />
          <Stat Icon={Headphones} value={history.length} label="Listen" />
        </View>

        {/* ---- About ---- */}
        <Text style={styles.sectionLabel}>ABOUT</Text>
        <View style={styles.card}>
          <Row label="Version" value={`${version}`} />
          <Divider />
          <Row label="Made by" value="ARK DURRANI (PATHAN)" />
          <Divider />
          <LinkRow label="Source code" onPress={() => open(REPO_URL)} />
        </View>

        {/* ---- Licence ---- */}
        <Text style={styles.sectionLabel}>LICENCE</Text>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.85}
          onPress={() => setLicenceExpanded((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={licenceExpanded ? 'Collapse licence' : 'Expand licence'}
          accessibilityState={{ expanded: licenceExpanded }}
        >
          <View style={styles.licenceHeader}>
            <Text style={styles.legalTitle}>Arkify</Text>
            <ChevronDown
              color={COLORS.text.muted}
              size={SIZES.icon.sm}
              style={licenceExpanded ? styles.chevronUp : undefined}
            />
          </View>
          <Text style={styles.legalCopyright}>Copyright © 2026 ARK DURRANI (PATHAN).</Text>
          <Text style={styles.legalBody} numberOfLines={licenceExpanded ? undefined : 3}>
            This program is free software: you can redistribute it and/or modify it under the terms
            of the GNU General Public License as published by the Free Software Foundation, either
            version 3 of the License, or (at your option) any later version. This program is
            distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even
            the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
            General Public License for more details.
          </Text>
          <LinkRow label="Read GPL-3.0" onPress={() => open(GPL_URL)} />
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>THIRD-PARTY</Text>
        <View style={styles.card}>
          <Text style={styles.legalTitle}>NewPipe Extractor</Text>
          <Text style={styles.legalBody}>
            Copyright © Team NewPipe and contributors, licensed GPL-3.0-or-later.{'\n\n'}
            Arkify uses it, unmodified, to resolve playable audio. No NewPipe source is included in
            this app, and linking it is why Arkify carries the same licence.
          </Text>
          <LinkRow label="NewPipeExtractor on GitHub" onPress={() => open(NEWPIPE_URL)} />
        </View>

        {/* ---- Playback source: kept reachable, below the reference's sections ---- */}
        <Text style={styles.sectionLabel}>PLAYBACK</Text>
        <View style={styles.card}>
          <LinkRow label="Playback source" onPress={() => setShowSource(true)} />
        </View>

        <Text style={styles.footer}>MADE BY ARK DURRANI (PATHAN)</Text>
      </ScrollView>

      <PlaybackSourceSheet visible={showSource} onClose={() => setShowSource(false)} />
    </View>
  );
}

const Stat: React.FC<{ Icon: typeof Heart; value: number; label: string }> = ({
  Icon,
  value,
  label,
}) => (
  <View style={styles.stat}>
    <Icon color={COLORS.accent.primary} size={SIZES.icon.md} strokeWidth={1.9} />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value}</Text>
  </View>
);

const LinkRow: React.FC<{ label: string; onPress: () => void }> = ({ label, onPress }) => (
  <TouchableOpacity
    style={styles.row}
    activeOpacity={0.7}
    onPress={onPress}
    accessibilityRole="link"
    accessibilityLabel={label}
  >
    <Text style={styles.rowLink}>{label}</Text>
    <ExternalLink color={COLORS.accent.primary} size={SIZES.icon.sm} strokeWidth={1.9} />
  </TouchableOpacity>
);

const Divider = () => <View style={styles.divider} />;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.xs,
    paddingHorizontal: SIZES.gutter,
    paddingBottom: SIZES.sm,
  },
  backButton: {
    width: SIZES.touchTarget,
    height: SIZES.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.title2.fontSize,
    color: COLORS.text.primary,
  },
  sectionLabel: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.overline.fontSize,
    letterSpacing: 2,
    color: COLORS.text.muted,
    marginTop: SIZES.lg,
    marginBottom: SIZES.sm,
    marginHorizontal: SIZES.gutter,
  },
  card: {
    marginHorizontal: SIZES.gutter,
    padding: SIZES.md,
    borderRadius: SIZES.radius.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.hairline,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(53, 214, 198, 0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(53, 214, 198, 0.55)',
  },
  avatarInitial: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.title2.fontSize,
    color: COLORS.accent.primary,
  },
  avatarText: {
    flex: 1,
  },
  avatarName: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.title3.fontSize,
    color: COLORS.text.primary,
  },
  avatarMeta: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.subheadline.fontSize,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.md,
  },
  nameInput: {
    flex: 1,
    padding: 0,
    fontFamily: FONTS.medium,
    fontSize: TYPE.body.fontSize + 1,
    color: COLORS.text.primary,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SIZES.sm,
    marginHorizontal: SIZES.gutter,
  },
  pill: {
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderRadius: SIZES.radius.pill,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    backgroundColor: COLORS.surface,
    minHeight: SIZES.touchTarget - 8,
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: COLORS.accent.primary,
    borderColor: COLORS.accent.primary,
  },
  pillText: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.subheadline.fontSize,
    color: COLORS.text.primary,
  },
  pillTextActive: {
    color: 'COLORS.text.dark',
  },
  statsCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SIZES.lg,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: SIZES.sm,
  },
  statValue: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.title3.fontSize,
    color: COLORS.text.primary,
  },
  statLabel: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.secondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    minHeight: SIZES.touchTarget - 4,
  },
  rowLabel: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.body.fontSize,
    color: COLORS.text.secondary,
  },
  rowValue: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.body.fontSize,
    color: COLORS.text.primary,
  },
  rowLink: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.body.fontSize,
    color: COLORS.accent.primary,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
  },
  licenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SIZES.sm,
  },
  chevronUp: {
    transform: [{ rotate: '180deg' }],
  },
  legalTitle: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.headline.fontSize,
    color: COLORS.text.primary,
  },
  legalCopyright: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.subheadline.fontSize,
    color: COLORS.text.primary,
    marginBottom: SIZES.sm,
  },
  legalBody: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.subheadline.fontSize,
    lineHeight: 19,
    color: COLORS.text.secondary,
    marginBottom: SIZES.sm,
  },
  footer: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.overline.fontSize,
    letterSpacing: 3,
    color: COLORS.text.muted,
    textAlign: 'center',
    marginTop: SIZES.xxl,
  },
});
