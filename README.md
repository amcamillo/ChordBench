# Chord Workbench

A local-first chord chart tool for exploring chord relationships and hearing synthesized piano and guitar.

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

Playback uses assumed timing of one 4/4 bar per chord unless otherwise specified. Chord charts do not establish the melody, actual timing or a unique voicing. The 3D Song DNA view requires WebGL2; text and note controls remain available when it is unavailable. Generated guitar arrangements have not been verified for fingering or physical playability.
