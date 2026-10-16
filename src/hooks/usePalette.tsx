import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { usePlayer } from './usePlayer';
import { useLibrary } from './useLibrary';
import {
  ArtworkPalette,
  extractArtworkPalette,
} from '../services/PaletteService';

type PaletteContextType = {
  /**
   * Palette derived from the CURRENT track's artwork, or `null` when dynamic
   * colors are disabled, the artwork has no usable color, or extraction is
   * still running. Consumers must fall back to theme tokens on `null` — the
   * aqua identity stays authoritative either way.
   */
  palette: ArtworkPalette | null;
  /** Raw preference (persisted). */
  dynamicColors: boolean;
  setDynamicColors: (v: boolean) => void;
};

const PaletteContext = createContext<PaletteContextType | undefined>(undefined);

/**
 * Bridges playback → color. Debounced (~240 ms) so rapid skipping never pays
 * for extraction on tracks that flash by, and every consumer receives exactly
 * one palette change per track.
 */
export const PaletteProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { settings, updateSettings } = useLibrary();
  const { currentTrack } = usePlayer();

  const dynamicColors = settings.dynamicColors ?? true;
  const artworkUrl = currentTrack?.albumImageUrl ?? null;

  const [palette, setPalette] = useState<ArtworkPalette | null>(null);

  useEffect(() => {
    if (!dynamicColors || !artworkUrl) {
      setPalette(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      extractArtworkPalette(artworkUrl)
        .then((result) => {
          if (!cancelled) setPalette(result);
        })
        .catch(() => {
          if (!cancelled) setPalette(null);
        });
    }, 240);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [artworkUrl, dynamicColors]);

  const value = useMemo<PaletteContextType>(
    () => ({
      palette,
      dynamicColors,
      setDynamicColors: (v) => updateSettings({ dynamicColors: v }),
    }),
    [palette, dynamicColors, updateSettings]
  );

  return <PaletteContext.Provider value={value}>{children}</PaletteContext.Provider>;
};

/** Artwork-reactive palette for the current track. */
export const usePalette = (): PaletteContextType => {
  const ctx = useContext(PaletteContext);
  if (!ctx) throw new Error('usePalette must be used within a PaletteProvider');
  return ctx;
};
