import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Track } from '../core/types';
import { DOWNLOADS_STORAGE_KEY, ensureMigrated, readJson, STORAGE_KEYS } from '../core/storage';
import { MusicService } from './MusicService';

/** Index key used before the Arkify rename; read once, then migrated away. */
const LEGACY_STORAGE_KEY = 'audia:v1:downloads';
const DOWNLOAD_DIR = 'arkify_downloads';

type DownloadedMeta = {
  id: string;
  track: Track;
  fileUri: string;
  size: number;
  downloadedAt: number;
};

function sanitize(name: string): string {
  return name.replace(/[^a-z0-9._-]/gi, '_').slice(0, 80);
}

function fileNameFor(track: Track): string {
  return `${sanitize(track.sourceId)}-${sanitize(track.title)}.m4a`;
}

async function ensureDir(): Promise<string> {
  // Web has no filesystem — gracefully degrade.
  if (Platform.OS === 'web') throw new Error('Downloads are not supported on web');
  const base = FileSystem.documentDirectory;
  if (!base) throw new Error('No document directory');
  const dir = `${base}${DOWNLOAD_DIR}/`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

async function loadIndex(): Promise<DownloadedMeta[]> {
  try {
    await ensureMigrated();
    let raw = await AsyncStorage.getItem(DOWNLOADS_STORAGE_KEY);
    if (raw == null) {
      // Pre-rename index: adopt it so existing downloads stay listed. The
      // downloaded files themselves keep their absolute URIs and still play.
      raw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw != null) {
        await AsyncStorage.setItem(DOWNLOADS_STORAGE_KEY, raw);
        await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
      }
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveIndex(list: DownloadedMeta[]): Promise<void> {
  try {
    await AsyncStorage.setItem(DOWNLOADS_STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

class DownloadServiceImpl {
  private index: DownloadedMeta[] | null = null;
  /** Track ids currently downloading (dedup + UI progress binding). */
  private active = new Map<string, number>();
  /** Change listeners — the library/download screens subscribe for progress. */
  private listeners = new Set<() => void>();

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }

  /** Live progress of an active download, or undefined. */
  progressFor(trackId: string): number | undefined {
    return this.active.get(trackId);
  }

  async init(): Promise<void> {
    this.index = await loadIndex();
    // Prune entries whose files no longer exist (e.g. cleared storage).
    if (Platform.OS !== 'web') {
      const pruned: DownloadedMeta[] = [];
      for (const e of this.index) {
        try {
          const info = await FileSystem.getInfoAsync(e.fileUri);
          if (info.exists) pruned.push(e);
        } catch {
          // treat as missing
        }
      }
      if (pruned.length !== this.index.length) {
        this.index = pruned;
        await saveIndex(pruned);
      }
    }
  }

  async getDownloaded(): Promise<DownloadedMeta[]> {
    if (this.index === null) await this.init();
    return [...(this.index ?? [])];
  }

  async getDownloadedTracks(): Promise<Track[]> {
    const list = await this.getDownloaded();
    return list.map((e) => ({ ...e.track, audioUrl: e.fileUri }));
  }

  isDownloaded(trackId: string): boolean {
    return !!this.index?.some((e) => e.id === trackId);
  }

  getFileUri(trackId: string): string | null {
    return this.index?.find((e) => e.id === trackId)?.fileUri ?? null;
  }

  async isAvailableOffline(trackId: string): Promise<boolean> {
    const uri = this.getFileUri(trackId);
    if (!uri) return false;
    try {
      const info = await FileSystem.getInfoAsync(uri);
      return !!info.exists;
    } catch {
      return false;
    }
  }

  /**
   * Download a track's audio and store it locally.
   * Returns the local file uri. Subsequent plays will use it via audioUrl.
   *
   * onProgress reports 0..1 in phases: resolve (0.05), then byte progress
   * scaled across the remaining range, then 1 on completion.
   */
  async download(track: Track, onProgress?: (p: number) => void): Promise<string> {
    if (Platform.OS === 'web') throw new Error('Downloads are not supported on web');
    if (this.index === null) await this.init();

    // Already downloaded?
    const existing = this.index!.find((e) => e.id === track.id);
    if (existing) {
      const info = await FileSystem.getInfoAsync(existing.fileUri);
      if (info.exists) return existing.fileUri;
      // stale entry — remove
      this.index = this.index!.filter((e) => e.id !== track.id);
    }

    onProgress?.(0.02);

    // Resolve a playable URL (uses native extractor on Android, endpoints otherwise).
    const stream = await MusicService.resolveStream(track);
    onProgress?.(0.08);

    const dir = await ensureDir();
    const fileUri = `${dir}${fileNameFor(track)}`;

    // downloadAsync has no progress callback, so poll the growing file while
    // the transfer runs. Coarse but honest, and it lets the UI show motion.
    const downloadPromise = FileSystem.downloadAsync(stream.url, fileUri, {
      headers: stream.headers ?? {},
    });

    const started = Date.now();
    let lastReported = 0.08;
    const poll = setInterval(async () => {
      try {
        const info = await FileSystem.getInfoAsync(fileUri);
        if (info.exists) {
          const size = ((info as unknown as { size?: number }).size ?? 0) / 8_000_000; // assume ~8MB track
          const p = Math.min(0.95, 0.08 + size * 0.87);
          if (p > lastReported + 0.02) {
            lastReported = p;
            onProgress?.(p);
          }
        }
      } catch {
        /* file not created yet */
      }
    }, 400);

    let result;
    try {
      result = await downloadPromise;
    } finally {
      clearInterval(poll);
      void started;
    }

    // Verify
    const info = await FileSystem.getInfoAsync(result.uri);
    if (!info.exists) throw new Error('Download failed — the file never arrived');

    const size = (info as unknown as { size?: number }).size ?? 0;
    // A zero-byte file is a failed transfer that silently "succeeded".
    if (size === 0) {
      try {
        await FileSystem.deleteAsync(result.uri, { idempotent: true });
      } catch {}
      throw new Error('Download failed — empty file, try again');
    }

    const meta: DownloadedMeta = {
      id: track.id,
      track: { ...track },
      fileUri: result.uri,
      size,
      downloadedAt: Date.now(),
    };
    this.index!.unshift(meta);
    await saveIndex(this.index!);
    onProgress?.(1);
    return result.uri;
  }

  /**
   * Download several tracks with bounded concurrency. Reports overall and
   * per-track progress; one failure never aborts the batch.
   */
  async downloadBatch(
    tracks: Track[],
    options: { concurrency?: number; onTrackDone?: (trackId: string, ok: boolean) => void } = {}
  ): Promise<{ ok: number; failed: number }> {
    const concurrency = Math.max(1, options.concurrency ?? 2);
    let cursor = 0;
    let ok = 0;
    let failed = 0;

    const worker = async () => {
      while (cursor < tracks.length) {
        const track = tracks[cursor++];
        if (this.isDownloaded(track.id)) {
          ok += 1;
          options.onTrackDone?.(track.id, true);
          continue;
        }
        try {
          this.active.set(track.id, 0.02);
          this.notify();
          await this.download(track, (p) => {
            this.active.set(track.id, p);
            this.notify();
          });
          ok += 1;
          options.onTrackDone?.(track.id, true);
        } catch {
          failed += 1;
          options.onTrackDone?.(track.id, false);
        } finally {
          this.active.delete(track.id);
          this.notify();
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }, worker));
    return { ok, failed };
  }

  /**
   * Smart auto-download: when enabled in settings and the device is on an
   * unmetered network, quietly fetch the most recent liked songs that are
   * not yet on disk. Bounded so the first run cannot hammer storage.
   */
  async smartAutoDownload(maxNew = 10): Promise<number> {
    if (Platform.OS === 'web') return 0;

    // The Smart-offline toggle is the single source of truth. Before this
    // gate the setting was write-only: turning it OFF did not stop the
    // App-boot run, so downloads happened with the switch off.
    try {
      const settings = await readJson<Partial<{ autoDownload: boolean }>>(STORAGE_KEYS.settings, {});
      if (settings && settings.autoDownload === false) return 0;
    } catch {
      // Unreadable settings must never silently re-enable downloads — but
      // the default is ON, so falling through matches the shipped default.
    }

    try {
      const net = await NetInfo.fetch();
      if (!net.isConnected || net.type !== 'wifi') return 0;
    } catch {
      return 0;
    }

    // Read the liked list straight from storage to avoid a hook dependency.
    try {
      await ensureMigrated();
      const raw = await AsyncStorage.getItem('arkify:v1:liked');
      if (!raw) return 0;
      const liked = JSON.parse(raw) as Track[];
      const missing = liked.filter((t) => !this.isDownloaded(t.id)).slice(0, maxNew);
      if (!missing.length) return 0;

      const { ok } = await this.downloadBatch(missing, { concurrency: 2 });
      return ok;
    } catch {
      return 0;
    }
  }

  /** Aggregate storage facts for the manager UI. Never throws. */
  async storageSummary(): Promise<{ usedBytes: number; freeBytes: number | null; count: number }> {
    if (this.index === null) await this.init();
    const usedBytes = (this.index ?? []).reduce((sum, e) => sum + (e.size || 0), 0);

    let freeBytes: number | null = null;
    if (Platform.OS !== 'web') {
      try {
        freeBytes = await FileSystem.getFreeDiskStorageAsync();
      } catch {
        freeBytes = null;
      }
    }

    return { usedBytes, freeBytes, count: this.index?.length ?? 0 };
  }

  async removeAll(): Promise<void> {
    if (this.index === null) await this.init();
    for (const entry of this.index ?? []) {
      try {
        await FileSystem.deleteAsync(entry.fileUri, { idempotent: true });
      } catch {}
    }
    this.index = [];
    await saveIndex([]);
    this.notify();
  }

  async remove(trackId: string): Promise<void> {
    if (this.index === null) await this.init();
    const entry = this.index!.find((e) => e.id === trackId);
    if (!entry) return;
    try {
      await FileSystem.deleteAsync(entry.fileUri, { idempotent: true });
    } catch {}
    this.index = this.index!.filter((e) => e.id !== trackId);
    await saveIndex(this.index!);
  }

  async shareTrack(track: Track): Promise<void> {
    const url =
      track.provider === 'youtube'
        ? `https://music.youtube.com/watch?v=${track.sourceId}`
        : track.audioUrl ?? '';

    const message = `${track.title} — ${track.artist.name}${url ? `\n${url}` : ''}`;

    // Prefer system share sheet for text/links
    try {
      const result = await Share.share({ message, title: track.title });
      // Share returns action, no need to handle
      void result;
      return;
    } catch {}

    // Fallback: if a local file exists, share the file via expo-sharing
    const fileUri = this.getFileUri(track.id);
    if (fileUri && (await Sharing.isAvailableAsync())) {
      try {
        await Sharing.shareAsync(fileUri, {
          dialogTitle: track.title,
          mimeType: 'audio/mpeg',
        });
      } catch {}
    }
  }

  async shareFile(trackId: string): Promise<void> {
    const uri = this.getFileUri(trackId);
    if (!uri) return;
    if (Platform.OS === 'web') return;
    if (!(await Sharing.isAvailableAsync())) return;
    try {
      await Sharing.shareAsync(uri);
    } catch {}
  }
}

export const DownloadService = new DownloadServiceImpl();
