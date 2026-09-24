import ArkifyNativeModule from './src/ArkifyNativeModule';
import { NativeStreamResult, PlatformInfo } from './src/ArkifyNative.types';

export * from './src/ArkifyNative.types';
export { default as ArkifyNativeModule } from './src/ArkifyNativeModule';

/** True when this binary actually contains the Arkify native module. */
export function isArkifyNativeAvailable(): boolean {
  return ArkifyNativeModule != null;
}

/**
 * Proof-of-connection call across the TypeScript -> Kotlin boundary.
 * Returns null instead of throwing when the native module is absent.
 */
export function getPlatformInfo(): PlatformInfo | null {
  return ArkifyNativeModule?.getPlatformInfo() ?? null;
}

/**
 * Resolve a YouTube video id to a playable progressive audio stream using the
 * native NewPipe Extractor.
 *
 * Never throws: a missing module or a failed extraction both come back as a
 * structured failure result.
 */
export async function resolveYouTubeStream(
  videoId: string
): Promise<NativeStreamResult> {
  const module = ArkifyNativeModule;
  if (!module) {
    return {
      ok: false,
      reason: 'module_unavailable',
      message: 'ArkifyNative is not present in this binary',
    };
  }

  try {
    return await module.resolveYouTubeStream(videoId);
  } catch (e) {
    // A bridge-level failure (rather than an extraction failure) still has to
    // arrive as data, not as a thrown error.
    return {
      ok: false,
      reason: 'unknown',
      message: e instanceof Error ? e.message : String(e),
    };
  }
}
