const { withGradleProperties } = require('expo/config-plugins');

/**
 * Pins the Android ABI list for Gradle builds.
 *
 * Expo's default template leaves reactNativeArchitectures unset, which makes
 * the ABI set depend on whatever the machine/plugin chain defaults to. Arkify
 * ships a universal APK, so the ABI list is pinned explicitly here:
 *
 *   - arm64-v8a     : every modern device (and the emulator on ARM hosts)
 *   - armeabi-v7a   : older 32-bit hardware still in circulation
 *
 * x86/x86_64 are intentionally omitted: the native NewPipe Extractor + audio
 * DSP paths are only exercised on real hardware, and the smaller ABI set
 * keeps the universal APK lean.
 */

const TARGET_ABIS = ['armeabi-v7a', 'arm64-v8a'];

module.exports = function withAndroidAbis(config) {
  return withGradleProperties(config, (cfg) => {
    // Drop any existing reactNativeArchitectures entries, then re-pin ours.
    cfg.modResults = cfg.modResults.filter(
      (item) => !(item.type === 'property' && item.key === 'reactNativeArchitectures')
    );
    cfg.modResults.push({
      type: 'property',
      key: 'reactNativeArchitectures',
      value: TARGET_ABIS.join(','),
    });
    return cfg;
  });
};

module.exports.TARGET_ABIS = TARGET_ABIS;
