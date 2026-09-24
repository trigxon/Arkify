import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Check, Trash2, Server } from 'lucide-react-native';
import { COLORS, SIZES, FONTS, TYPE } from '../../constants/theme';
import { probe } from '../../core/http';
import { useLibrary } from '../../hooks/useLibrary';

type EndpointKind = 'invidious' | 'piped' | 'custom';

const KINDS: EndpointKind[] = ['invidious', 'piped', 'custom'];

/**
 * Playback source settings, opened from the existing output-device button.
 *
 * Discovery (search, playlists, metadata) works out of the box. Actually
 * streaming audio goes through whichever authorized endpoint the user points
 * Arkify at -- their own, or one they are permitted to use -- which is why this
 * is configured here rather than shipped with a hard-coded server.
 */
export const PlaybackSourceSheet: React.FC<{ visible: boolean; onClose: () => void }> = ({
  visible,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const { settings, updateSettings } = useLibrary();

  const [url, setUrl] = useState('');
  const [kind, setKind] = useState<EndpointKind>('invidious');
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const endpoints = settings.resolverEndpoints;

  const add = async () => {
    const trimmed = url.trim().replace(/\/+$/, '');
    if (!trimmed) return;

    if (!/^https?:\/\//.test(trimmed)) {
      setStatus('Enter a full URL starting with https://');
      return;
    }
    if (endpoints.some((e) => e.url === trimmed)) {
      setStatus('That source is already added.');
      return;
    }

    setChecking(true);
    setStatus(null);

    // Probe with a known video id so an unreachable host is caught here
    // rather than in the middle of playback.
    const testPath =
      kind === 'invidious'
        ? '/api/v1/videos/dQw4w9WgXcQ'
        : kind === 'piped'
          ? '/streams/dQw4w9WgXcQ'
          : '';

    const reachable = await probe(`${trimmed}${testPath}`);
    setChecking(false);

    updateSettings({ resolverEndpoints: [...endpoints, { url: trimmed, kind }] });
    setUrl('');
    setStatus(
      reachable
        ? 'Added and reachable.'
        : "Added, but it didn't respond. Playback may fail."
    );
  };

  const remove = (target: string) => {
    updateSettings({
      resolverEndpoints: endpoints.filter((e) => e.url !== target),
    });
    setStatus(null);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />

        <View style={[styles.sheet, { paddingBottom: insets.bottom + SIZES.lg }]}>
          <View style={styles.grabber} />

          <View style={styles.header}>
            <Text style={styles.title}>Playback source</Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X color={COLORS.text.secondary} size={SIZES.icon.md} />
            </TouchableOpacity>
          </View>

          <Text style={styles.explainer}>
            Search and playlists work already. To stream audio, point Arkify at a
            playback service you're authorized to use.
          </Text>

          <View style={styles.kindRow}>
            {KINDS.map((k) => (
              <TouchableOpacity
                key={k}
                style={[styles.kindChip, kind === k && styles.kindChipActive]}
                onPress={() => setKind(k)}
                accessibilityRole="button"
                accessibilityLabel={`Source type ${k}`}
                accessibilityState={{ selected: kind === k }}
              >
                <Text style={[styles.kindText, kind === k && styles.kindTextActive]}>{k}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="https://your-instance.example"
              placeholderTextColor={COLORS.text.muted}
              value={url}
              onChangeText={setUrl}
              onSubmitEditing={add}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              accessibilityLabel="Playback source URL"
            />
            <TouchableOpacity
              style={styles.addButton}
              onPress={add}
              disabled={checking}
              accessibilityRole="button"
              accessibilityLabel="Add source"
            >
              {checking ? (
                <ActivityIndicator size="small" color="COLORS.text.dark" />
              ) : (
                <Check color="COLORS.text.dark" size={SIZES.icon.sm + 2} />
              )}
            </TouchableOpacity>
          </View>

          {status && <Text style={styles.status}>{status}</Text>}

          <ScrollView style={styles.list}>
            {endpoints.length === 0 ? (
              <Text style={styles.empty}>No playback source configured yet.</Text>
            ) : (
              endpoints.map((e) => (
                <View key={e.url} style={styles.row}>
                  <View style={styles.rowIcon}>
                    <Server color={COLORS.text.secondary} size={SIZES.icon.sm} />
                  </View>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowUrl} numberOfLines={1}>{e.url}</Text>
                    <Text style={styles.rowKind}>{e.kind}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => remove(e.url)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${e.url}`}
                  >
                    <Trash2 color={COLORS.text.muted} size={SIZES.icon.sm} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: COLORS.scrim,
  },
  sheet: {
    backgroundColor: COLORS.surfaceRaised,
    borderTopLeftRadius: SIZES.radius.xl,
    borderTopRightRadius: SIZES.radius.xl,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    padding: SIZES.lg,
    paddingTop: SIZES.sm,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.glassBorder,
    marginBottom: SIZES.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.xs,
  },
  title: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.title3.fontSize,
    color: COLORS.text.primary,
  },
  explainer: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.subheadline.fontSize,
    lineHeight: 19,
    color: COLORS.text.secondary,
    marginBottom: SIZES.md,
  },
  kindRow: {
    flexDirection: 'row',
    marginBottom: SIZES.sm,
    gap: SIZES.sm,
  },
  kindChip: {
    paddingHorizontal: SIZES.md,
    paddingVertical: 8,
    borderRadius: SIZES.radius.pill,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.hairline,
  },
  kindChipActive: {
    backgroundColor: COLORS.accent.primary,
    borderColor: COLORS.accent.primary,
  },
  kindText: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.secondary,
  },
  kindTextActive: {
    color: 'COLORS.text.dark',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 46,
    fontFamily: FONTS.regular,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.primary,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: SIZES.radius.sm,
    paddingHorizontal: SIZES.sm,
  },
  addButton: {
    marginLeft: SIZES.sm,
    width: 46,
    height: 46,
    borderRadius: SIZES.radius.sm,
    backgroundColor: COLORS.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.secondary,
    marginTop: SIZES.sm,
  },
  list: {
    marginTop: SIZES.md,
    maxHeight: 160,
  },
  empty: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.subheadline.fontSize,
    color: COLORS.text.muted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SIZES.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SIZES.md,
  },
  rowInfo: {
    flex: 1,
    paddingRight: SIZES.sm,
  },
  rowUrl: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.subheadline.fontSize,
    color: COLORS.text.primary,
  },
  rowKind: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.micro.fontSize,
    color: COLORS.text.muted,
    marginTop: 2,
  },
});
