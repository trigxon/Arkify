import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Track } from '../core/types';
import { MusicService } from './MusicService';

const STORAGE_KEY = 'audia:v1:downloads';
const DOWNLOAD_DIR = 'audia_downloads';

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
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveIndex(list: DownloadedMeta[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

class DownloadServiceImpl {
  private index: DownloadedMeta[] | null = null;

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
