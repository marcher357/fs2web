Void Interceptor
==

A browser-based space dogfighting game: procedural low-poly ships, WebGL via
Three.js, no external assets. Fly Alpha lead, escort a convoy, and clear the
corridor of NTF fighters and a cruiser.

Running locally
--
```
npm install
npm run dev
```

Then open the printed local URL. `npm run build` produces a static production
build in `dist/`.

Controls
--
- Mouse: steer (offset from screen center sets turn rate)
- Left click: fire lasers
- Right click (hold): lock target, release to fire a missile
- WASD: thrust / strafe
- Shift: afterburner
- T: cycle target
- Q: cycle subsystem (capital ship targets)
