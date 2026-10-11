import { registerWebModule, NativeModule } from 'expo';

import { AudioFxInfo, NativeStreamResult, PlatformInfo } from './ArkifyNative.types';

class ArkifyNativeModule extends NativeModule<{}> {
  getPlatformInfo(): PlatformInfo {
    return { platform: 'web', native: false };
  }

  /** There is no extractor on web; callers fall through to the next source. */
  async resolveYouTubeStream(): Promise<NativeStreamResult> {
    return {
      ok: false,
      reason: 'module_unavailable',
      message: 'Native stream resolution is not available on web',
    };
  }

  getAudioFxInfo(): AudioFxInfo {
    return { supported: false };
  }

  setEqualizerLevels(): { ok: boolean } {
    return { ok: false };
  }

  setEqualizerEnabled(): { ok: boolean } {
    return { ok: false };
  }

  setBassBoost(): { ok: boolean } {
    return { ok: false };
  }
}

export default registerWebModule(ArkifyNativeModule, 'ArkifyNativeModule');
