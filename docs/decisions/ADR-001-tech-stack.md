# ADR-001: Tech stack

**Status:** accepted · 2026-11-09

## Decision
Phaser 3 + TypeScript (strict) + Vite. Vitest for unit tests, Playwright for smoke tests.
Static hosting on GitHub Pages as an installable PWA. Save data in localStorage.
All art drawn in code; voice via Web Speech API placeholder; SFX via jsfxr.

## Why
- Runs in Chrome on laptops and Android with no install; one codebase.
- Phaser has mature 2D, input (mouse/keyboard/touch), scaling and isometric-friendly depth sorting.
- Code-drawn blocks give a consistent, non-branded look without an artist.

## Alternatives considered
- three.js with an orthographic camera: free depth sorting, but pushes toward a 3D-voxel look
  the designer rejected. Keep as fallback only if iso depth sorting becomes unmanageable.
- Godot web export: heavier download, slower iteration for this scope.
