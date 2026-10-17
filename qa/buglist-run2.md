# Arkify Bug List — Session 2 (run at HEAD d7519db)

Sources: Task 2 rendered-screen walkthrough (17 surfaces, 420×800, zero page errors) + Task 3 read-only code audit (15 screens + 25 components).

## Task 2 walkthrough result — no NEW visual defects

| Surface | Result |
|---|---|
| Launch / Onboarding | clean |
| Home top / mid / bottom | clean |
| Mini player (appear + post-dismiss restore) | clean |
| Now Playing (artwork, ambient palette, transport, error state) | clean — "Couldn't play" is the honest environmental error (YouTube blocks datacenter IPs) |
| Queue sheet | clean — footer pinned |
| Lyrics (karaoke) | clean |
| Search browse / focused / results | clean |
| Library (playlists empty state) | clean |
| You | clean |
| Side drawer | clean |
| MoodRadios | clean — mini player present (B8 fix held) |
| Settings top / bottom | clean |
| History | clean |
| PlaylistDetail (Liked Songs) | clean |
| History "0 plays" after attempted play | VERIFIED NOT A BUG — `recordPlay` intentionally fires only after stream load succeeds (usePlayer.tsx:196-203) |
| Console | pre-existing Reanimated "easing not supported on web" warnings only; zero page errors |

## Task 3 — new findings (8)

### R2-B1 · HIGH — Equalizer band touch tracks are 26px wide with dead zones
- **File**: `src/components/player/EqualizerSheet.tsx:340-352`
- **Repro**: Open EQ sheet → tap in the empty space beside a band's vertical rail → nothing. Drag works only when pointer is within the 26px track.
- **Root cause**: each band column is `flex:1` (~66px in-sheet) but the responder is only the 26px `bandTrack` View; raw View responders get no hitSlop.
- **Fix**: stretch the responder across the column; draw the visual rail as an inner element.
- **Severity**: high (core interaction of the sheet; <32px = critical per touch rubric).

### R2-B2 · MEDIUM — Pill `small` variant is a 30px target (36px effective)
- **File**: `src/components/common/Pill.tsx:76-81`; consumers: Library sort chips.
- **Root cause**: `containerSmall.minHeight: 30` + hitSlop 3 → 36 effective; rubric threshold 40.
- **Fix**: `minHeight: 36` (+ hitSlop 3 → ≥40 effective with vertical slop), or `SIZES.touchTarget - 6`.

### R2-B3 · MEDIUM — ProfileSetup gender pills are 38px, not the logged 44
- **File**: `src/components/screens/ProfileSetup.tsx:188-197`
- **Root cause**: `minHeight: SIZES.touchTarget - 6` (=38), no hitSlop; worklog Task 6 claimed "gender pills 44".
- **Fix**: `minHeight: SIZES.touchTarget` + vertical hitSlop 3.

### R2-B4 · LOW — TrackActionsSheet picker chips & back rows 36px
- **File**: `src/components/player/TrackActionsSheet.tsx:667-687`
- **Fix**: `minHeight: SIZES.touchTarget` (rows have vertical room in scrollBody).

### R2-B5 · LOW — EQ preset chips have no minHeight (~33px rendered)
- **File**: `src/components/player/EqualizerSheet.tsx:284-291`
- **Fix**: `minHeight: 36` + center content.

### R2-B6 · LOW — Dead EQ power-toggle styles
- **File**: `src/components/player/EqualizerSheet.tsx:311-333` (`powerBtn/powerBtnOn/powerKnob/powerKnobOn` unreferenced since IOSToggle swap).
- **Fix**: delete the four styles.

### R2-B7 · LOW — PlaybackSourceSheet pokes state after await with no unmount guard
- **File**: `src/components/player/PlaybackSourceSheet.tsx:56-77`
- **Fix**: adopt the codebase `alive` ref pattern.

### R2-B8 · LOW — BottomSheet `keyboardHeight` prop is dormant (no caller wires it)
- **File**: `src/components/player/BottomSheet.tsx:29-30,99-102`; inputs in TrackActionsSheet:246 (create playlist, autoFocus) + PlaybackSourceSheet:113 (URL).
- **Fix**: wire `Keyboard` listeners in the two sheets so the designed lift actually fires on native.

## Environmental (documented, NOT code bugs)
- YouTube streaming blocked in sandbox by datacenter-IP login wall → honest "Couldn't play this track" UI; works on real devices/networks.
- No Android device/SDK in sandbox → no gradle build, no on-device FPS or real safe-area inset verification.
- Reanimated "easing not supported on web" console warnings — pre-existing, web-only, cosmetic.
