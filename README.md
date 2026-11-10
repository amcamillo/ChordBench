# Chord Workbench

A local-first companion for reading chord charts, exploring harmony, and hearing synthesized piano and guitar.

[Watch the release video](https://amcamillo.github.io/ChordBench/media/ChordWorkbench-v0.1-release.mp4).

## Using ChordBench

Open **Setup** to edit or import a chart. Use **Playlist** to prepare multiple songs, arrange their order and download or restore a backup. Select **Start session** for a touch-friendly view with chart, instrument, playback and song navigation controls.

**Song DNA** shows the chord progression in 3D and offers voice-leading suggestions. The session also provides a **Score** view with note names, auditions and a notation guide. The suggested piano voicings can be used for playback; guitar playback uses guitar shapes.

Charts and playlists are stored in your browser. Download a separate backup if you need to keep a copy. An individual draft download cannot currently be imported; playlist backups can be restored through the playlist file picker.

## Run locally

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

Playback assumes one 4/4 bar per written chord. Chord charts do not establish the melody, actual timing, fingering or a unique voicing; suggested voicings are examples. The 3D strand requires WebGL2, and a score view remains available when it is unavailable. Generated guitar arrangements have not been verified for physical playability.
