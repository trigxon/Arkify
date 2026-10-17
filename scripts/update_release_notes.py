#!/usr/bin/env python3
"""Prepend curated highlights to the v2.1.0 release notes (keeps auto notes)."""
import json
import urllib.request

TOKEN = None  # read from env-free local file to avoid shell history
with open("/home/z/my-project/.ghtok") as f:
    TOKEN = f.read().strip()

REPO = "trigxon/Arkify"
TAG = "v2.1.0"
RELEASE_ID = None  # fetched

HIGHLIGHTS = """## Highlights

**Arkify v2.1.0 is the biggest release yet** — the entire app was rebuilt around a clear
iOS-grade liquid-glass design system, with an on-device AI engine, a cinematic player,
and a full audio-FX stack. This release also fixes every defect found in two rounds of
rendered-screen audits (29 verification screenshots shipped in `qa/`).

### New

- **Liquid glass UI** — clear translucent materials with specular highlights and edge
  light, shared across the tab bar, mini player, sheets, dialogs, search and FABs;
  sliding-pill tab bar, sidebar drawer, and a branded launch experience
  (Orbitron / Chakra Petch)
- **Arkify AI** — on-device taste profile + recommendation engine, mood radios
  (Workout, Focus, Chill, Late Night, Party, Feels, Commute, Romance), prompt-based
  AI playlists, and "Ask Arkify AI" in search. Optional: paste your own Gemini API key
  in Settings to upgrade playlist planning — the key never leaves your device
- **Cinematic Now Playing** — artwork-reactive ambient glow (palette extracted and
  cached off the UI thread), shared-element artwork flight between mini player and
  full screen, velocity-aware gestures, hold-and-slide navigation
- **Karaoke lyrics** — follow-the-line lyrics with active-line highlighting
- **Audio FX** — system equalizer (device band count, presets + custom shape),
  bass boost, crossfade, and a sleep timer
- **Offline** — Downloads screen with smart auto-download and a storage manager
- **Gamification** — listening streaks, detailed stats, and a Wrapped experience
- **Spotify-grade library depth** — song radio, full track menus everywhere, recent
  searches, playlist CRUD, search-within-playlist, sort, drag-to-reorder, descriptions
- **Filter chips** on Home (Music / Podcasts / Radio) and quick-access tiles

### Fixed

- 40+ layout, gesture and interaction bugs fixed across two audit sessions,
  including touch-target sizes, EQ band hit zones, keyboard lift in sheets,
  ghost-playing state after playback errors, and sheet transition glitches

### Engineering

- Tag-driven releases: pushing a `v*` tag now builds and publishes the signed APK
  automatically (`build-apk.yml`)
- First CI-validated Android build of the v2 line (native module compile fixes:
  `BassBoost.setStrength`, catch-clause syntax)
- Rendered-screen QA evidence committed under `qa/` for every audited surface

---

"""


def api(path, method="GET", data=None):
    req = urllib.request.Request(
        f"https://api.github.com{path}",
        headers={
            "Authorization": f"token {TOKEN}",
            "Accept": "application/vnd.github+json",
            "User-Agent": "arkify-release-script",
        },
        method=method,
        data=json.dumps(data).encode() if data else None,
    )
    with urllib.request.urlopen(req) as r:
        body = r.read().decode()
        return json.loads(body) if body else {}


def main():
    rel = api(f"/repos/{REPO}/releases/tags/{TAG}")
    rid = rel["id"]
    current = rel.get("body") or ""
    if current.startswith("## Highlights"):
        print("highlights already present — nothing to do")
        return
    new_body = HIGHLIGHTS + current
    api(f"/repos/{REPO}/releases/{rid}", method="PATCH", data={"body": new_body})
    print(f"release {TAG} updated: {len(new_body)} chars")


if __name__ == "__main__":
    main()
