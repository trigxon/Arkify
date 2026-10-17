import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { COLORS, GLASS, SPRINGS } from '../../constants/theme';
import { useAppearance } from '../../hooks/useAppearance';
import { GlassView } from './Glass';
import { WebModal } from './WebModal';

/**
 * In-app confirmation dialogs.
 *
 * WHY THIS EXISTS (§4 dialogs + §11 broken functionality):
 * react-native-web ships `Alert.alert()` as an empty no-op, so every
 * destructive action confirmed through Alert was silently unreachable on
 * web — clear history, delete playlist, reset personalisation, reset
 * appearance and remove-all-downloads could never be confirmed. The three
 * call sites that branched to `window.confirm` worked but surfaced the
 * browser's native chrome, breaking the design language.
 *
 * `confirmAlert()` mirrors the Alert.alert signature. Native passes
 * straight through to the platform Alert. Web routes the request to a
 * single <ConfirmHost/> mounted at the app root, which renders the same
 * choice inside an Arkify glass dialog (modal material, spring scale-in,
 * Escape/scrim cancel, full ARIA dialog semantics).
 */

export type ConfirmButton = {
  text: string;
  style?: 'cancel' | 'destructive' | 'default';
  onPress?: () => void;
};

type ConfirmRequest = {
  id: number;
  title: string;
  message?: string;
  buttons: ConfirmButton[];
};

let nextRequestId = 1;
let activeListener: ((request: ConfirmRequest | null) => void) | null = null;

export function confirmAlert(
  title: string,
  message?: string,
  buttons: ConfirmButton[] = [{ text: 'OK' }]
): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons as Parameters<typeof Alert.alert>[2]);
    return;
  }
  const request: ConfirmRequest = { id: nextRequestId++, title, message, buttons };
  activeListener?.(request);
}

/** Closes the visible web dialog, running the pressed button's handler. */
function settleDialog(request: ConfirmRequest, buttonIndex: number | null): void {
  activeListener?.(null);
  if (buttonIndex !== null) {
    const button = request.buttons[buttonIndex];
    button?.onPress?.();
  }
}

/**
 * Mount once, inside providers, next to the navigation root. Renders
 * nothing on native and nothing on web until a request arrives.
 */
export const ConfirmHost: React.FC = () => {
  const { motionReduced, glass } = useAppearance();
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    activeListener = setRequest;
    return () => {
      activeListener = null;
    };
  }, []);

  // Panel arrives with a small spring settle — skipped entirely under
  // reduced motion (the modal fade still communicates the appearance).
  useEffect(() => {
    if (!request) return;
    if (motionReduced) {
      scale.setValue(1);
      return;
    }
    scale.setValue(0.92);
    const animation = Animated.spring(scale, {
      toValue: 1,
      ...SPRINGS.gentle,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [request, motionReduced, scale]);

  const cancelIndex = request
    ? request.buttons.findIndex((b) => b.style === 'cancel')
    : -1;

  const settle = useCallback(
    (index: number | null) => {
      if (request) settleDialog(request, index);
    },
    [request]
  );

  if (!request) return null;

  return (
    <WebModal
      visible
      animationType="fade"
      onRequestClose={() => settle(cancelIndex >= 0 ? cancelIndex : null)}
    >
      <View style={styles.root}>
        {/* Scrim tap = the dialog's cancel path, matching platform Alert. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityLabel="Dismiss dialog"
          accessibilityRole="button"
          onPress={() => settle(cancelIndex >= 0 ? cancelIndex : null)}
        />
        <Animated.View style={[styles.panelWrap, { transform: [{ scale }] }]}>
          <GlassView material="modal" style={styles.panel}>
            <View
              accessibilityRole="alert"
              aria-modal
              accessibilityLabel={request.title}
            >
            <Text style={styles.title}>{request.title}</Text>
            {request.message ? (
              <Text style={styles.message}>{request.message}</Text>
            ) : null}
            <View style={styles.buttonRow}>
              {request.buttons.map((button, index) => {
                const isCancel = button.style === 'cancel';
                const isDestructive = button.style === 'destructive';
                return (
                  <React.Fragment key={`${request.id}-${index}`}>
                    {index > 0 ? <View style={styles.separator} /> : null}
                    <Pressable
                      style={({ pressed }) => [
                        styles.button,
                        pressed && !motionReduced && styles.buttonPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={button.text}
                      onPress={() => settle(index)}
                    >
                      <Text
                        style={[
                          styles.buttonText,
                          isCancel && styles.cancelText,
                          isDestructive && styles.destructiveText,
                        ]}
                      >
                        {button.text}
                      </Text>
                    </Pressable>
                  </React.Fragment>
                );
              })}
            </View>
            </View>
          </GlassView>
        </Animated.View>
      </View>
    </WebModal>
  );
};

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  panelWrap: {
    width: '100%',
    maxWidth: 340,
  },
  panel: {
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 6,
    overflow: 'hidden',
  },
  title: {
    color: COLORS.text.primary,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  message: {
    color: COLORS.text.secondary,
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: 18,
  },
  separator: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: GLASS.border.hairline,
  },
  button: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  buttonPressed: {
    backgroundColor: COLORS.accent.soft,
  },
  buttonText: {
    color: COLORS.accent.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  cancelText: {
    color: COLORS.text.soft,
    fontWeight: '500',
  },
  destructiveText: {
    color: COLORS.accent.red,
  },
});
