const path = require('path');
const fs = require('fs');
const { withAppBuildGradle, withDangerousMod } = require('expo/config-plugins');

/**
 * Signs release builds with Audia's own keystore instead of the debug key.
 *
 * The Expo template points the release buildType at signingConfigs.debug.
 * A debug-signed APK installs fine, but the debug key is a well-known shared
 * secret, so anyone could publish an "update" over it, and every CI machine
 * would produce a different identity for the same app.
 *
 * Credentials are resolved in this order (first match wins):
 *
 *   1. Environment variables  -- AUDIA_STORE_FILE, AUDIA_STORE_PASSWORD,
 *                                AUDIA_KEY_ALIAS, AUDIA_KEY_PASSWORD
 *      (recommended for CI secrets and for local one-off builds)
 *
 *   2. keystore.properties at the project root -- a gitignored Java
 *      properties file:
 *
 *        storeFile=/absolute/path/to/audia-release.keystore
 *        storePassword=...
 *        keyAlias=audia
 *        keyPassword=...
 *
 *   3. credentials/keystore.json -- the mechanism CI uses (see
 *      .github/workflows/build-apk.yml, which generates the keystore into
 *      the repo-scoped Actions cache):
 *
 *        { "keystorePath": "...", "storePassword": "...",
 *          "keyAlias": "...", "keyPassword": "..." }
 *
 * If no mechanism provides a keystore, the plugin leaves the project
 * untouched so a fresh clone still builds (debug-signed) without setup.
 *
 * Nothing secret is ever committed: the keystore file, keystore.properties
 * and credentials/ are all gitignored. This is a config plugin because
 * android/ is generated -- `npx expo prebuild --clean` would discard a hand
 * edit to build.gradle.
 */

function fromEnv() {
  const { AUDIA_STORE_FILE, AUDIA_STORE_PASSWORD, AUDIA_KEY_ALIAS, AUDIA_KEY_PASSWORD } = process.env;
  if (AUDIA_STORE_FILE && AUDIA_STORE_PASSWORD && AUDIA_KEY_ALIAS && AUDIA_KEY_PASSWORD) {
    return {
      keystorePath: AUDIA_STORE_FILE,
      storePassword: AUDIA_STORE_PASSWORD,
      keyAlias: AUDIA_KEY_ALIAS,
      keyPassword: AUDIA_KEY_PASSWORD,
      source: 'environment',
    };
  }
  return null;
}

function fromProperties(projectRoot) {
  const file = path.join(projectRoot, 'keystore.properties');
  if (!fs.existsSync(file)) return null;

  try {
    const parsed = Object.fromEntries(
      fs
        .readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => {
          const eq = line.indexOf('=');
          return [line.slice(0, eq).trim(), line.slice(eq + 1).trim()];
        })
    );
    if (parsed.storeFile && parsed.storePassword && parsed.keyAlias && parsed.keyPassword) {
      return { ...parsed, source: 'keystore.properties' };
    }
  } catch {
    /* fall through to the next mechanism */
  }
  return null;
}

function fromJson(projectRoot) {
  const file = path.join(projectRoot, 'credentials', 'keystore.json');
  if (!fs.existsSync(file)) return null;

  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (parsed.keystorePath && parsed.storePassword && parsed.keyAlias && parsed.keyPassword) {
      return { ...parsed, source: 'credentials/keystore.json' };
    }
  } catch {
    /* fall through */
  }
  return null;
}

function readCredentials(projectRoot) {
  return fromEnv() || fromProperties(projectRoot) || fromJson(projectRoot);
}

/** Copy the keystore next to build.gradle, where Gradle's file() resolves it. */
function withKeystoreCopied(config, credentials) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const from = path.isAbsolute(credentials.keystorePath)
        ? credentials.keystorePath
        : path.join(cfg.modRequest.projectRoot, credentials.keystorePath);
      const to = path.join(cfg.modRequest.platformProjectRoot, 'app', 'release.keystore');

      if (fs.existsSync(from)) {
        fs.copyFileSync(from, to);
      } else {
        throw new Error(
          `withReleaseSigning (${credentials.source}): keystore not found at ${credentials.keystorePath}`
        );
      }
      return cfg;
    },
  ]);
}

function withSigningConfig(config, credentials) {
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;

    if (contents.includes('release.keystore')) return cfg; // already applied

    // Add a release signing config beside the template's debug one.
    const debugBlock = [
      '        debug {',
      "            storeFile file('debug.keystore')",
      "            storePassword 'android'",
      "            keyAlias 'androiddebugkey'",
      "            keyPassword 'android'",
      '        }',
    ].join('\n');

    if (!contents.includes(debugBlock)) {
      throw new Error('withReleaseSigning: could not find the debug signingConfig');
    }

    contents = contents.replace(
      debugBlock,
      [
        debugBlock,
        '        release {',
        "            storeFile file('release.keystore')",
        `            storePassword '${credentials.storePassword}'`,
        `            keyAlias '${credentials.keyAlias}'`,
        `            keyPassword '${credentials.keyPassword}'`,
        '        }',
      ].join('\n')
    );

    // Point the release buildType at it.
    //
    // Anchored on the template's own caution comment rather than on
    // `release {`, because that phrase also opens the signingConfigs block
    // added just above -- matching it there silently re-signs the DEBUG build
    // with the release key and leaves release on the debug key.
    const releaseAnchor = [
      '            // Caution! In production, you need to generate your own keystore file.',
      '            // see https://reactnative.dev/docs/signed-apk-android.',
      '            signingConfig signingConfigs.debug',
    ].join('\n');

    if (!contents.includes(releaseAnchor)) {
      throw new Error('withReleaseSigning: could not find the release buildType');
    }

    contents = contents.replace(
      releaseAnchor,
      [
        `            // Signed with Audia's own keystore (via ${credentials.source}).`,
        '            signingConfig signingConfigs.release',
      ].join('\n')
    );

    cfg.modResults.contents = contents;
    return cfg;
  });
}

module.exports = function withReleaseSigning(config) {
  // Config plugins run from the project root.
  const credentials = readCredentials(process.cwd());

  // No credentials configured -> leave the debug signing in place rather than
  // failing the build for anyone who just cloned the repo.
  if (!credentials) return config;

  let next = withKeystoreCopied(config, credentials);
  next = withSigningConfig(next, credentials);
  return next;
};
