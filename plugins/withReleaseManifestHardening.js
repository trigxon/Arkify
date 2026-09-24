const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Release-manifest hardening gate.
 *
 * Runs at prebuild time and FAILS the build if the merged manifest carries
 * settings a distributed APK must not have:
 *
 *   - android:debuggable on <application> (debug builds inject it; a
 *     release APK with debuggable=true is trivially reversible)
 *   - android:usesCleartextTraffic=true (cleartext HTTP is dev-only; the
 *     app's endpoints are all https)
 *
 * This turns "check the manifest before every release" from a checklist
 * item into a build invariant. It deliberately does NOT touch allowBackup
 * or any other behaviour -- smallest safe change.
 */

module.exports = function withReleaseManifestHardening(config) {
  return withAndroidManifest(config, (cfg) => {
    const application = cfg.modResults.manifest.application?.[0];
    const attrs = application?.$ ?? {};

    if (attrs['android:debuggable'] === 'true' || attrs['android:debuggable'] === true) {
      throw new Error(
        'withReleaseManifestHardening: android:debuggable is set on <application>. ' +
          'A distributed APK must never be debuggable.'
      );
    }

    if (attrs['android:usesCleartextTraffic'] === 'true' || attrs['android:usesCleartextTraffic'] === true) {
      throw new Error(
        'withReleaseManifestHardening: android:usesCleartextTraffic=true is set. ' +
          'All Arkify endpoints are https; cleartext must stay dev-only.'
      );
    }

    return cfg;
  });
};
