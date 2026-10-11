import { NativeModule, requireOptionalNativeModule } from 'expo';

import { AudioFxInfo, NativeStreamResult, PlatformInfo } from './ArkifyNative.types';

declare class ArkifyNativeModule extends NativeModule<{}> {
  getPlatformInfo(): PlatformInfo;
  resolveYouTubeStream(videoId: string): Promise<NativeStreamResult>;
  getAudioFxInfo(): AudioFxInfo;
  setEqualizerLevels(levels: number[]): { ok: boolean; message?: string };
  setEqualizerEnabled(enabled: boolean): { ok: boolean; message?: string };
  setBassBoost(strength: number): { ok: boolean; message?: string };
}

/**
 * Null when the native module is not in the running binary -- Expo Go, or a
 * development build made before this module existed. Callers must handle that,
 * which is why `index.ts` exposes the guarded helpers instead.
 */
export default requireOptionalNativeModule<ArkifyNativeModule>('ArkifyNative');
