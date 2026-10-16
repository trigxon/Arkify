import React, { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View, ScrollView } from 'react-native';
import { BottomSheet } from '../common/BottomSheet';
import { GlassView, SpringPressable } from '../common/Glass';
import { COLORS, SIZES, FONTS, TYPE } from '../../constants/theme';
import { IOSToggle } from '../common/Glass';
import { AudioFX, EQ_PRESETS } from '../../services/AudioFX';

/**
 * EqualizerSheet — the sound-shaping surface.
 *
 * Device EQ bands + bass boost + crossfade, all live-applied. Sliders move
 * the real hardware bands (via the native module); presets are one tap.
 * Gracefully degrades to a clear "not supported" note where the device
 * refuses output-session effects.
 */

const BAND_LABELS_5 = ['60', '230', '910', '3.6k', '14k'];
const freqLabel = (milliHz: number) => {
  const hz = milliHz / 1000;
  if (hz >= 1000) return `${(hz / 1000).toFixed(1)}k`;
  return `${Math.round(hz)}`;
};

export const EqualizerSheet: React.FC<{
  visible: boolean;
  onClose: () => void;
}> = ({ visible, onClose }) => {
  const [state, setState] = useState(AudioFX.getState());
  const [info, setInfo] = useState(AudioFX.deviceInfo);
  const [crossfade, setCrossfadeState] = useState(0);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void AudioFX.load().then(() => {
      setState(AudioFX.getState());
      setInfo(AudioFX.deviceInfo);
      setCrossfadeState(AudioFX.getState().crossfade);
    });
    const unsub = AudioFX.subscribe(() => setState(AudioFX.getState()));
    return () => {
      unsub();
      if (debounce.current) clearTimeout(debounce.current); // no leak past unmount
    };
  }, []);

  const applyCrossfade = (seconds: number) => {
    setCrossfadeState(seconds);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => AudioFX.setCrossfade(seconds), 250);
  };

  const bandCount = info.bandCount ?? 5;
  const bandFreqs =
    info.centerFreqs && info.centerFreqs.length === bandCount
      ? info.centerFreqs.map(freqLabel)
      : bandCount <= BAND_LABELS_5.length
        ? BAND_LABELS_5.slice(0, bandCount)
        : // Devices with more bands than our labels: synthesise octave labels
          // (31 Hz · 4^i) so every slider keeps a real frequency caption.
          Array.from({ length: bandCount }, (_, i) => freqLabel(Math.round(31 * 4 ** i)));

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Sound" subtitle="Equalizer · Bass · Crossfade" tall>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {!info.supported ? (
          <GlassView weight="thin" style={styles.unsupported}>
            <Text style={styles.unsupportedTitle}>Equalizer not available on this device</Text>
            <Text style={styles.unsupportedBody}>
              Your device declined the system audio effects session. Crossfade still works everywhere.
            </Text>
          </GlassView>
        ) : (
          <>
            {/* Presets */}
            <Text style={styles.sectionLabel}>Presets</Text>
            <View style={styles.presetWrap}>
              {EQ_PRESETS.map((preset) => {
                const active = state.presetId === preset.id && state.enabled;
                return (
                  <SpringPressable
                    key={preset.id}
                    style={[styles.presetChip, active && styles.presetChipActive]}
                    pressScale={0.93}
                    onPress={() => AudioFX.setPreset(preset.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${preset.name} preset`}
                  >
                    <Text style={[styles.presetText, active && styles.presetTextActive]}>
                      {preset.name}
                    </Text>
                  </SpringPressable>
                );
              })}
            </View>

            {/* Power toggle */}
            <View style={styles.rowBetween}>
              <Text style={styles.sectionLabel}>Equalizer {state.enabled ? 'on' : 'off'}</Text>
              <IOSToggle
                value={state.enabled}
                onValueChange={(v) => AudioFX.setEnabled(v)}
                accessibilityLabel="Toggle equalizer"
              />
            </View>

            {/* Band sliders */}
            {state.enabled ? (
              <View style={styles.bandsWrap}>
                {Array.from({ length: bandCount }).map((_, i) => (
                  <View key={i} style={styles.bandCol}>
                    <VerticalBand
                      value={state.bands[i] ?? 0.5}
                      onChange={(v) => AudioFX.setBand(i, v)}
                    />
                    <Text style={styles.bandLabel}>{bandFreqs[i]}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Bass */}
            <Text style={styles.sectionLabel}>
              Bass boost — {Math.round((state.bass / 1000) * 100)}%
            </Text>
            <HSlider
              value={state.bass / 1000}
              onChange={(v) => AudioFX.setBass(v * 1000)}
            />
          </>
        )}

        {/* Crossfade (always available) */}
        <Text style={styles.sectionLabel}>
          Crossfade {crossfade > 0 ? `— ${crossfade}s` : '— off'}
        </Text>
        <HSlider
          value={crossfade / 12}
          onChange={(v) => applyCrossfade(Math.round(v * 12))}
        />
        <Text style={styles.hint}>
          Smooth volume glide between tracks — no more dead-air silences.
        </Text>
      </ScrollView>
    </BottomSheet>
  );
};

// ---------------------------------------------------------------------------
// HSlider — drag slider (0..1). Width measured once; drags are absolute.
// ---------------------------------------------------------------------------

const HSlider: React.FC<{ value: number; onChange: (v: number) => void }> = ({ value, onChange }) => {
  const [local, setLocal] = useState(value);
  const [width, setWidth] = useState(0);
  const dragging = useRef(false);

  useEffect(() => {
    if (!dragging.current) setLocal(value);
  }, [value]);

  const fromX = (x: number) => {
    if (width <= 0) return;
    const pct = Math.max(0, Math.min(1, x / width));
    setLocal(pct);
    onChange(pct);
  };

  return (
    <View
      style={styles.sliderTrack}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => fromX(e.nativeEvent.locationX)}
      onResponderMove={(e) => fromX(e.nativeEvent.locationX)}
      onResponderRelease={() => undefined}
      onResponderTerminate={() => undefined}
    >
      <View style={[styles.sliderFill, { width: `${Math.round(local * 100)}%` }]} />
      <View style={[styles.sliderThumb, { left: `${Math.round(local * 100)}%` }]} />
    </View>
  );
};

// ---------------------------------------------------------------------------
// VerticalBand — one EQ column. Drag up/down within a 130px track.
// ---------------------------------------------------------------------------

const BAND_TRACK_H = 130;

const VerticalBand: React.FC<{ value: number; onChange: (v: number) => void }> = ({ value, onChange }) => {
  const [local, setLocal] = useState(value);
  const dragging = useRef(false);

  useEffect(() => {
    if (!dragging.current) setLocal(value);
  }, [value]);

  // Bands are ± around the middle: 0.5 maps to the vertical centre.
  const pctFromBottom = local * 100;
  /** Symmetric fill around the centre line: above when boosted, below when cut. */
  const upFill = Math.max(0, (local - 0.5) * 100);
  const downFill = Math.max(0, (0.5 - local) * 100);

  const fromY = (y: number) => {
    const pct = 1 - Math.max(0, Math.min(1, y / BAND_TRACK_H));
    setLocal(pct);
    onChange(pct);
  };

  const endDrag = () => {
    dragging.current = false;
  };

  return (
    <View
      style={[styles.bandTrack]}
      onStartShouldSetResponder={() => {
        dragging.current = true;
        return true;
      }}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => fromY(e.nativeEvent.locationY)}
      onResponderMove={(e) => fromY(e.nativeEvent.locationY)}
      onResponderRelease={endDrag}
      onResponderTerminate={endDrag}
    >
      <View style={styles.bandMid} />
      {/* Boost: rises from the centre line. */}
      <View
        style={[
          styles.bandFill,
          { height: `${Math.round(upFill)}%`, bottom: '50%', top: undefined },
        ]}
      />
      {/* Cut: hangs below the centre line. */}
      <View
        style={[
          styles.bandFill,
          styles.bandFillCut,
          { height: `${Math.round(downFill)}%`, top: '50%', bottom: undefined },
        ]}
      />
      <View style={[styles.bandThumb, { bottom: `${Math.round(Math.max(2, Math.min(94, pctFromBottom - 3)))}%` }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: SIZES.md,
  },
  unsupported: {
    padding: SIZES.lg,
    alignItems: 'center',
    marginBottom: SIZES.lg,
  },
  unsupportedTitle: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  unsupportedBody: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginTop: 6,
  },
  sectionLabel: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.subheadline.fontSize,
    color: COLORS.text.primary,
    marginBottom: SIZES.sm + 2,
    marginTop: SIZES.md,
  },
  presetWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  presetChipActive: {
    backgroundColor: COLORS.accent.primary,
    borderColor: COLORS.accent.primary,
  },
  presetText: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.soft,
  },
  presetTextActive: {
    color: COLORS.text.dark,
    fontFamily: FONTS.semibold,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SIZES.sm,
  },
  powerBtn: {
    width: 52,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    padding: 3,
  },
  powerBtnOn: {
    backgroundColor: COLORS.accent.primary,
    borderColor: COLORS.accent.primary,
  },
  powerKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.text.secondary,
  },
  powerKnobOn: {
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-end',
  },
  bandsWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingVertical: SIZES.md,
  },
  bandCol: {
    alignItems: 'center',
    flex: 1,
  },
  bandTrack: {
    width: 26,
    height: BAND_TRACK_H,
    borderRadius: 13,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  bandMid: {
    position: 'absolute',
    top: '50%',
    left: 4,
    right: 4,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  bandFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    width: '100%',
    backgroundColor: 'rgba(59, 240, 223, 0.35)',
  },
  /** The "cut" half of the band: quieter, cooler tone below centre. */
  bandFillCut: {
    backgroundColor: 'rgba(127, 148, 149, 0.30)',
  },
  bandThumb: {
    position: 'absolute',
    alignSelf: 'center',
    width: 22,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent.primary,
  },
  bandLabel: {
    fontFamily: FONTS.medium,
    fontSize: 10,
    color: COLORS.text.muted,
    marginTop: 6,
  },
  sliderTrack: {
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: COLORS.accent.soft,
  },
  sliderThumb: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    width: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent.primary,
    marginLeft: -4,
  },
  hint: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.muted,
    marginTop: 6,
  },
});
