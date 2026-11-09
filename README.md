# Chord Workbench

A local-first chord chart tool for exploring chord relationships and hearing synthesized piano and guitar.

## Playlist and session

Open **Playlist** in Setup to add the current chart, or select multiple ChordPro/text files and review them before adding. Rename, reorder, load, remove or undo removal of songs. Each saved song retains its chart, transposition, spelling, tempo and instrument. Playlist data stays in this browser; download a playlist backup and use the same file picker to restore it elsewhere. Adding a backup appends its songs. Limits: 40 songs, 500,000 characters per chart and four million characters in total. The original single-chart draft remains separate. Importing a replacement into the editor does not overwrite a loaded playlist song; use **Add current chart** to save it.

Choose **Start session** to play with fixed navigation and transport. The playlist selector changes songs without returning to Setup and stops playback when switching. Browsing chords while playing stops playback. Long charts have page-turn controls and follow the active chord.

## Song DNA: staff and voice leading

The session's **Song DNA** and the workbench's **Song DNA** view show the current and next chords on a grand staff. Tap **Hear chord** or **Hear change**; **Score options** offers alternate voicings, note names, voice guides, a flat/tilted 3D perspective, and a short notation guide. Enable guided piano playback to use the displayed, connected voicings across the chart. Guitar keeps its own shapes. These suggestions minimize movement within a bounded set of piano inversions and registers; they are not fingering, hand assignments, or the song's original arrangement. Voice choices and guided playback are session-only.

The score uses a teaching assumption of one whole note per written chord in 4/4; the original rhythm, melody and key signature are not inferred. Dashed arrows describe voice movement, not ties or slurs. Accidentals are shown explicitly, and the staff uses treble and bass clefs with ledger lines. This is a practice visualization, not an engraved transcription. The optional tilt is a CSS 3D perspective on a readable vector score; **Spatial DNA** retains the earlier WebGL visualization in the full workbench.

The chord details panel includes **To the next chord**: compare the selected occurrence with its written neighbor, choose among reference piano voicings, read exact pitch movements, and hear the pair. These are temporary examples, not inferred performance, fingering, or edits to the song. Unrecognized neighbors are not skipped; the final chord has no outgoing comparison. On mobile, open **Learn**.

## Run locally

Spatial DNA shows selectable **Voice-leading paths** for concrete reference piano voicings, with directional arrows, octave labels and an expandable movement list. These examples do not alter chart playback. The outer 3D timing rail faces the camera and connects its current/next bar markers to the chord positions; the earlier DOM ruler remains only as a graphics-unavailable fallback.

During playback, the focused chord shape eases into its next shape over the final 180 ms before the chord change; the audio stays on its original timing. The darker 3D spine and screen-facing four-beat ruler keep assumed timing readable at different camera angles. Reduced motion disables anticipatory animation.

In **Whole song**, the focused-chord diagram labels each tone. Expand **Notes & intervals** for its construction, or choose **Dive into chord** to inspect that occurrence in detail. The focused diagram stays pinned while the background travels along the time line during playback; ticks describe the existing assumed timing.

Spatial DNA offers **Whole song** to see every written chord and **Chord detail** for individual notes. Use **Jump to chord** or **Jump to section** to navigate long charts. **Visual groove** adds selectable waltz, minuet, Cuban bolero, samba, phonk, funk, rock, dance-pop, swing-jazz and rock-opera examples with a **Meter / compás** control. These are illustrative visual interpretations, assuming one bar per written chord; audio remains the original assumed 4/4 chord preview. Dense overviews enlarge representative rhythm cells while retaining every harmonic occurrence. Rhythm preferences are browser view settings, not chart timing or draft-export data.

Use Node 22.18 or later:

```sh
npm ci --ignore-scripts
npm run dev
```

In Windows PowerShell, use `npm.cmd` if script execution policies block `npm`. Open the local address printed by Vite. The app and its fonts run locally; imported chart files stay in your browser.

Run `npm test` for domain checks and `npm run build` for the static production build. Browser checks use locally installed Microsoft Edge and can be run with `npm run test:browser`.

## GitHub Pages

The provided workflow builds the app and deploys the `dist` artifact from the `main` branch when the repository has GitHub Pages configured to use GitHub Actions. URLs are relative and support a repository subpath.

## Current limits

Playback uses assumed timing of one 4/4 bar per chord unless otherwise specified. Chord charts do not establish the melody, actual timing or a unique voicing. The Spatial DNA view requires WebGL2; text and note controls remain available when it is unavailable. Generated guitar arrangements have not been verified for fingering or physical playability.
