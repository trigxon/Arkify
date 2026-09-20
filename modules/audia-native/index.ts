import AudiaNativeModule from './src/AudiaNativeModule';
import { NativeStreamResult, PlatformInfo } from './src/AudiaNative.types';

export * from './src/AudiaNative.types';
export { default as AudiaNativeModule } from './src/AudiaNativeModule';

/** True when this binary actually contains the Audia native module. */
export function isAudiaNativeAvailable(): boolean {
  return AudiaNativeModule != null;
}

/**
 * Proof-of-connection call across the TypeScript -> Kotlin boundary.
 * Returns null instead of throwing when the native module is absent.
 */
export function getPlatformInfo(): PlatformInfo | null {
  return AudiaNativeModule?.getPlatformInfo() ?? null;
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
  const module = AudiaNativeModule;
  if (!module) {
    return {
      ok: false,
      reason: 'module_unavailable',
      message: 'AudiaNative is not present in this binary',
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
