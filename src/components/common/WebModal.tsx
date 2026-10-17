import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Platform,
  StyleSheet,
  View,
} from 'react-native';

type WebModalProps = {
  visible: boolean;
  onRequestClose?: () => void;
  animationType?: 'slide' | 'fade' | 'none';
  children: React.ReactNode;
};

/**
 * Modal parity across platforms.
 *
 * RN-web's Modal portals to document.body, which escapes the app's phone
 * frame on desktop viewports — sheets stretched across the whole browser
 * window, scrims over empty black gutters. On web this component renders the
 * same overlay INSIDE the React tree instead: the nearest positioned ancestor
 * is the app frame, so the sheet and its scrim stay exactly where the app is,
 * with matching enter/exit motion. Native keeps the platform Modal untouched.
 */
export const WebModal: React.FC<WebModalProps> = ({
  visible,
  onRequestClose,
  animationType = 'slide',
  children,
}) => {
  // Stays mounted through the exit animation, then drops from the tree.
  const [rendered, setRendered] = useState(visible);
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const [hostHeight, setHostHeight] = useState(0);
  // Slide animations measure the host overlay first; if layout never reports
  // back (paranoia — RNW dispatches onLayout every mount), start anyway.
  const [forceStart, setForceStart] = useState(false);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      return;
    }
    Animated.timing(progress, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.quad),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) setRendered(false);
    });
  }, [visible, progress]);

  // BUG FIX (§9 layout jump): the web slide previously started from
  // Dimensions.get('window').height — the BROWSER viewport — while the
  // overlay actually spans the app frame, which is shorter on desktop
  // viewports. The sheet therefore launched from below its real start
  // position and corrected mid-flight. The enter animation now waits for
  // the measured host height, with a safety timeout so a lost layout
  // event can never leave a sheet unanimated.
  const slideNeedsMeasure = Platform.OS === 'web' && animationType === 'slide';
  const slideReady = !slideNeedsMeasure || hostHeight > 0 || forceStart;

  useEffect(() => {
    if (!slideNeedsMeasure || !rendered || !visible) return;
    if (forceStart) return;
    const t = setTimeout(() => setForceStart(true), 300);
    return () => clearTimeout(t);
  }, [slideNeedsMeasure, rendered, visible, forceStart]);

  useEffect(() => {
    if (!rendered || !visible || !slideReady) return;
    if (animationType === 'none') return;
    Animated.timing(progress, {
      toValue: 1,
      duration: animationType === 'fade' ? 200 : 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [rendered, visible, animationType, progress, slideReady]);

  // Escape closes the sheet, matching native Modal's onRequestClose contract.
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible || !onRequestClose) return;
    if (typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onRequestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, onRequestClose]);

  if (Platform.OS !== 'web') {
    return (
      <Modal
        visible={visible}
        transparent
        animationType={animationType}
        onRequestClose={onRequestClose}
      >
        {children}
      </Modal>
    );
  }

  if (!rendered) return null;

  // Web slides use the MEASURED host height (the app frame). The window
  // dimension is only a last-resort fallback for native-style hosts.
  const slideFrom = hostHeight > 0 ? hostHeight : Dimensions.get('window').height;

  const animatedStyle: {
    opacity?: Animated.AnimatedInterpolation<number>;
    transform?: { translateY: Animated.AnimatedInterpolation<number> }[];
  } = {};

  if (animationType === 'fade') {
    animatedStyle.opacity = progress;
  } else if (animationType === 'slide') {
    animatedStyle.transform = [
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [slideFrom, 0] }) },
    ];
    // BUG FIX (§9 black flash): the dimming scrim previously appeared at
    // full opacity in the first frame — a hard black cut before the panel
    // had even started moving. The whole overlay now fades in alongside
    // the slide (scrim reaches full strength early, while the panel is
    // still travelling) and fades back out with the exit slide.
    animatedStyle.opacity = progress.interpolate({
      inputRange: [0, 0.72, 1],
      outputRange: [0, 1, 1],
    });
  }

  return (
    <View
      style={styles.overlay}
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (Math.abs(h - hostHeight) > 1) setHostHeight(h);
      }}
    >
      <Animated.View
        pointerEvents="box-none"
        style={[StyleSheet.absoluteFill, animatedStyle]}
      >
        {children}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    elevation: 24,
  },
});
