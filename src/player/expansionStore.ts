/**
 * Mini-player ↔ Now Playing shared-element handoff.
 *
 * The mini player and the full player live in different navigation screens,
 * so a true shared-element needs one imperative meeting point: the mini side
 * publishes the window-space rect of its artwork (and the artwork URI), and
 * the full player reads it on mount to fly the artwork from that exact spot.
 *
 * A plain module store (not React state) is deliberate: the handoff happens
 * across a navigation commit, where context providers race remounts. The
 * store must stay in sync with the CURRENT track — every publish stamps the
 * artwork URI so a stale rect from a previous track can never fly the wrong
 * image.
 */

export type ExpansionOrigin = {
  /** Window-space rect of the mini artwork, px. */
  x: number;
  y: number;
  size: number;
  /** Artwork URI the rect was measured for — guards against stale flights. */
  uri: string | null;
};

let origin: ExpansionOrigin | null = null;

/** Publish the mini artwork rect (called by the MiniPlayer). */
export function setExpansionOrigin(next: ExpansionOrigin | null): void {
  origin = next;
}

/** Read without consuming — the dismiss flight needs the rect too. */
export function peekExpansionOrigin(): ExpansionOrigin | null {
  return origin;
}

/** Consume the origin (full-player mount). */
export function takeExpansionOrigin(): ExpansionOrigin | null {
  const current = origin;
  origin = null;
  return current;
}

/** Restore after a cancelled consume, so dismiss can still fly home. */
export function restoreExpansionOrigin(value: ExpansionOrigin | null): void {
  origin = value;
}
