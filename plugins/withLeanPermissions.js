const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

/**
 * Strips permissions Arkify does not need from the final merged APK.
 *
 * Two layers are handled, because permissions reach the APK two ways:
 *
 *   1. The Expo config: expo-file-system's own plugin injects legacy
 *      READ_/WRITE_EXTERNAL_STORAGE into config.android.permissions. Arkify
 *      never reads shared storage -- its downloads go to the app-private
 *      documents directory, which needs no permission. Filtered at plugin
 *      registration time so they never reach the manifest template.
 *
 *   2. Gradle manifest merging: any library manifest can contribute
 *      uses-permission entries at merge time (React Native's debug variant
 *      adds SYSTEM_ALERT_WINDOW + VIBRATE for dev overlays). For those,
 *      <uses-permission tools:node="remove"> directives are emitted, which
 *      the manifest merger honours regardless of which library adds the
 *      permission or in what order.
 *
 * The same lean set applies to debug builds: React Native's dev overlay is
 * not part of this app's development workflow (the dev menu is reached from
 * the notification/terminal), so what you test is what you ship.
 */

const BLOCKED_PERMISSIONS = [
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.VIBRATE',
];

module.exports = function withLeanPermissions(config) {
  // Layer 1: keep the config-level permission list clean.
  if (Array.isArray(config.android?.permissions)) {
    config.android.permissions = config.android.permissions.filter(
      (p) => !BLOCKED_PERMISSIONS.includes(p)
    );
  }

  // Layer 2: manifest template + merger-level removal directives.
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    // Strip anything already in the template.
    AndroidConfig.Permissions.removePermissions(cfg.modResults, BLOCKED_PERMISSIONS);

    // And tell the Gradle manifest merger to drop these even if a library
    // manifest re-adds them. tools:remove needs the tools namespace, which
    // Expo's template declares; ensure it defensively.
    manifest.$ = manifest.$ ?? {};
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    manifest['uses-permission'] = manifest['uses-permission'] ?? [];
    for (const name of BLOCKED_PERMISSIONS) {
      manifest['uses-permission'].push({
        $: { 'android:name': name, 'tools:node': 'remove' },
      });
    }

    return cfg;
  });
};

module.exports.BLOCKED_PERMISSIONS = BLOCKED_PERMISSIONS;
