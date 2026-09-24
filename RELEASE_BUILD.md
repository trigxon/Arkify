# Arkify — Release Build Guide

How to produce, sign, verify and publish a production Arkify APK.

**Golden rules**

- The signing key is the app's *identity*. Whoever holds it can publish
  updates that install over the app. Treat it like a root password.
- **Never** commit the keystore, its passwords, or `keystore.properties`.
- A signing key has no "undo": if it is lost, the app can never be updated
  under the same package id again (new key ⇒ new app as far as Android is
  concerned). Keep a backup of the keystore **and** its passwords somewhere
  safe that is not this repository.
- Signing an APK does **not** make Google Play Protect treat it as trusted.
  See [Signing vs Google's systems](#signing-vs-googles-systems).

---

## 1. The signing system

`android/` is generated (`npx expo prebuild`), so signing is wired by
**config plugins**, never by hand-editing Gradle files:

| File | Role |
|---|---|
| `plugins/withReleaseSigning.js` | Reads keystore credentials and points the `release` buildType at them |
| `plugins/withLeanPermissions.js` | Keeps the permission set to the 4 the app actually uses |
| `plugins/withReleaseManifestHardening.js` | Fails the build if `debuggable` / cleartext traffic appear |
| `.github/workflows/build-apk.yml` | CI release build (generates + caches a keystore with a **randomly generated password**, verifies signature + branding) |

Credentials are resolved **in this order**, first match wins:

1. **Environment variables**

   ```bash
   export ARKIFY_STORE_FILE=/absolute/path/arkify-release.keystore
   export ARKIFY_STORE_PASSWORD='***'
   export ARKIFY_KEY_ALIAS=arkify
   export ARKIFY_KEY_PASSWORD='***'
   ```

2. **`keystore.properties`** (project root, gitignored)

   ```properties
   storeFile=/absolute/path/arkify-release.keystore
   storePassword=***
   keyAlias=arkify
   keyPassword=***
   ```

3. **`credentials/keystore.json`** (gitignored; what CI uses)

   ```json
   {
     "keystorePath": "credentials/arkify-release.keystore",
     "storePassword": "***",
     "keyAlias": "arkify",
     "keyPassword": "***"
   }
   ```

If **none** is present, the build stays debug-signed and still succeeds —
a fresh clone never fails on missing secrets.

> **Existing key:** a keystore is already in use for published builds
> (CI-generated, `CN=ARK DURRANI (PATHAN), OU=trigxon`, cached under the
> GitHub Actions cache key `audia-signing-keystore-v1`, kept under its original
> name on purpose — the name is what restores the existing key material).
> Do **not** generate
> a new one for an update release: Android treats a different key as a
> different app. Only generate a fresh key for a deliberate new identity
> (see §7).
>
> CI generates that keystore's password with `openssl rand` at creation time
> and stores it only in the cached `credentials/keystore.json` — no password
> appears anywhere in the repository. If you build locally and want the
> **same signing identity** as CI, export the four `ARKIFY_*` variables with
> a copy of that keystore and its password (kept outside Git).

---

## 2. Create a production keystore (local, first time)

Run this **once**, keep the output for the life of the app:

```bash
keytool -genkeypair -v \
  -keystore arkify-release.keystore -storetype PKCS12 \
  -alias arkify -keyalg RSA -keysize 2048 -validity 10950 \
  -storepass 'YOUR_STRONG_STORE_PASSWORD' \
  -keypass  'YOUR_STRONG_KEY_PASSWORD' \
  -dname "CN=ARK DURRANI, OU=trigxon, O=trigxon, C=IN"
```

- `10950` days ≈ 30 years (Android's recommended maximum).
- PKCS12 keys can be moved between machines/toolchains.
- Then point one of the three credential mechanisms above at
  `/absolute/path/arkify-release.keystore`.
- Back the file + passwords up (encrypted USB / password manager).

## 3. Build a release APK

```bash
git clone https://github.com/trigxon/Arkify.git
cd Arkify
npm install

# generate android/ with all plugins applied (idempotent)
npx expo prebuild --platform android --no-install

# build the signed release APK
cd android && ./gradlew assembleRelease --no-daemon
```

CI runs exactly this (plus license acceptance and verification steps).

## 4. Where the APK is generated

```
android/app/build/outputs/apk/release/app-release.apk
```

For distribution, copy it with a versioned name:

```bash
cp android/app/build/outputs/apk/release/app-release.apk Arkify-v1.3.0.apk
```

## 5. Verify the signature

```bash
# apksigner ships with Android build-tools
apksigner verify --print-certs Arkify-v1.3.0.apk
```

Expected:

```
Signer #1 certificate DN: CN=ARK DURRANI, OU=trigxon, O=trigxon, C=IN
Signer #1 certificate SHA-256 digest: <hex>
Verified using v1 scheme: false
Verified using v2 scheme: true
```

Any build whose certificate digest differs from your keystore's is **not**
your build.

## 6. Calculate SHA-256

```bash
sha256sum Arkify-v1.3.0.apk            # Linux / macOS
Get-FileHash Arkify-v1.3.0.apk -Algorithm SHA256   # Windows
```

Publish the hash next to the APK (GitHub Release + README) so users can
verify their download.

## 7. What must NEVER be committed to Git

All of these are gitignored, double-check before committing:

- `*.keystore`, `*.jks` — signing keys
- `keystore.properties` — signing passwords
- `credentials/` — CI credential drop
- `*.p12`, `*.pem`, `*.key` — other private key material
- anything containing `storePassword` / `keyPassword` values

If a keystore ever lands in a commit: rotate immediately and treat every
build signed with it as compromised (git history keeps secrets forever —
removing the file from HEAD is not enough).

## 8. Release checklist

1. [ ] `app.json` `version` bumped, `android.versionCode` incremented
2. [ ] `npx expo prebuild --platform android --no-install` runs clean
3. [ ] `npx tsc --noEmit` — no errors
4. [ ] `./gradlew assembleRelease` — build succeeds (hardening gate passes)
5. [ ] `apksigner verify --print-certs` shows **your** certificate
6. [ ] `apksigner verify` does **not** show `CN=Android Debug`
7. [ ] SHA-256 recorded and published with the APK
8. [ ] GitHub Release updated with the new APK + hash

## Signing vs Google's systems

Be precise about what signing does and does not do:

- **APK signing** proves *who built it* and makes updates installable over
  previous versions of the same app. It is entirely local to Android.
- **Google Play Protect** scans installs and, in Advanced Protection mode,
  blocks *all* apps installed outside an app store by default — regardless
  of how the APK is signed. A validly signed APK can still show
  "App blocked by Advanced Protection".
- **Google Play App Signing / developer verification** are Play-ecosystem
  programs; they are separate from sideload distribution and are not used
  by this project.

Distribution outside Google Play is a normal, supported Android capability
(users allow their browser/file manager to install unknown apps). Document
that flow honestly (see README) instead of implying signing changes how
Google treats the app.
