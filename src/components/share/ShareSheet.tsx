import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { ShareCard, ShareCardKind } from './ShareCard';
import { BottomSheet } from '../common/BottomSheet';
import { GlassView, SpringPressable } from '../common/Glass';
import { COLORS, SIZES, FONTS, TYPE } from '../../constants/theme';

/**
 * ShareSheet — renders a ShareCard off-screen, captures it as PNG and hands
 * it to the system share sheet. One entry point the whole app uses.
 */

export type ShareRequest = {
  kind: ShareCardKind;
  title?: string;
  artist?: string;
  artworkUri?: string;
  contextLabel?: string;
  streak?: number;
  minutesToday?: number;
  level?: number;
  levelTitle?: string;
  monthLabel?: string;
  topTrack?: { title: string; artist: string; image?: string };
  minutesTotal?: string;
  personality?: string;
  /** Text accompanying the shared image. */
  message?: string;
};

export const ShareSheet: React.FC<{
  request: ShareRequest | null;
  onClose: () => void;
}> = ({ request, onClose }) => {
  const shotRef = useRef<ViewShot>(null);
  const [busy, setBusy] = useState(false);

  const share = useCallback(async () => {
    if (!request) return;
    setBusy(true);
    try {
      const uri = await new Promise<string>((resolve, reject) => {
        const ref = shotRef.current;
        if (!ref) {
          reject(new Error('card not ready'));
          return;
        }
        // capture immediately — the card renders hidden but mounted.
        ref.capture?.()
          .then((u) => (u ? resolve(u) : reject(new Error('no uri'))))
          .catch(reject);
        // Safety net: some platforms resolve via the onCapture callback.
        setTimeout(() => reject(new Error('capture timeout')), 6000);
      });

      if (Platform.OS === 'web') {
        // Web: download the PNG.
        const a = document.createElement('a');
        a.href = uri;
        a.download = 'arkify-share.png';
        a.click();
      } else if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Share via Arkify',
        });
      }
      onClose();
    } catch {
      // Capture failed — still close; sharing is never a hard failure.
      onClose();
    } finally {
      setBusy(false);
    }
  }, [request, onClose]);

  if (!request) return null;

  return (
    <BottomSheet visible onClose={onClose} title="Share" subtitle="Send a card, not just a link">
      {/* Hidden, off-card render used for capture. */}
      <View style={styles.offscreen} pointerEvents="none">
        <ShareCard ref={shotRef} {...request} />
      </View>

      <GlassView weight="thin" style={styles.previewWrap}>
        <ShareCard {...request} />
      </GlassView>

      <SpringPressable
        style={styles.shareButton}
        glow
        onPress={() => void share()}
        accessibilityRole="button"
        accessibilityLabel="Share card"
      >
        {busy ? (
          <ActivityIndicator color={COLORS.text.dark} />
        ) : (
          <Text style={styles.shareLabel}>Share card</Text>
        )}
      </SpringPressable>

      {request.message ? <Text style={styles.messageHint}>{request.message}</Text> : null}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  offscreen: {
    position: 'absolute',
    top: -1000,
    left: 0,
    width: 320,
    height: 420,
    opacity: 0.01,
  },
  previewWrap: {
    alignItems: 'center',
    paddingVertical: SIZES.md,
    marginBottom: SIZES.md,
  },
  shareButton: {
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SIZES.sm,
  },
  shareLabel: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.headline.fontSize,
    color: COLORS.text.dark,
  },
  messageHint: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.muted,
    textAlign: 'center',
    paddingBottom: SIZES.xs,
  },
});
