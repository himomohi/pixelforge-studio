# PixelForge Studio

PixelForge Studio is a browser-based pixel-art editor built for people and AI agents to create together. Humans get a complete visual editor for drawing, animation, layers, palettes, reference images, and exports. Compatible agents get 65 structured WebMCP tools that operate on the same project without guessing through the interface.

**Live app:** https://pixelforge-studio.appcaster.chatgpt.site  
**WebMCP Challenge:** https://webmcp.devpost.com/

## Why WebMCP

Pixel-art production involves many precise, repetitive operations: creating canvases, placing exact pixels, managing frames and layers, converting reference images, validating fidelity, and exporting several engine-specific formats. These tasks are awkward and fragile when an agent must infer controls from pixels on a screen.

PixelForge exposes those workflows as typed browser-native tools. An agent can inspect the current project, apply an exact edit, and return control to the person in the same editor. The person can immediately review, refine, undo, animate, or export the result.

## What people and agents can do together

- Start from a hand-drawn frame or a browser-local reference image.
- Ask an agent to create or duplicate projects, frames, and layers.
- Apply exact pixel batches, shapes, colors, palettes, selections, and timing.
- Convert references with aspect-ratio and alpha guardrails.
- Audit reference fidelity with a measured 0.99 verification gate.
- Continue editing manually with pencil, fill, shape, selection, and navigation tools.
- Export PNG, animated GIF, sprite sheets, editable project files, or game-engine-ready bundles.

## WebMCP implementation

The integration lives in [`lib/pixelforge/webmcp.ts`](lib/pixelforge/webmcp.ts). It registers 65 tools through `document.modelContext.registerTool`, including:

- project creation, duplication, selection, import, rename, and resize;
- reference-image state, display, conversion, and fidelity auditing;
- exact pixel drawing, shape edits, palettes, colors, brush size, and selections;
- frame, layer, playback, zoom, grid, onion-skin, and symmetry controls;
- PNG, GIF, sprite-sheet, project, and game-bundle exports.

Tools use bounded JSON schemas and cancellation signals. Read-only operations are annotated, destructive operations are identified, and reference workflows preserve browser-local image data.

## Product features

- Crisp, grid-aligned pixel canvas with keyboard and pointer editing
- Multi-frame animation timeline and playback
- Multi-layer cels, opacity, visibility, locking, duplication, and reordering
- Browser-local autosave and multiple project management
- Reference image split, overlay, zoom, opacity, flip, and fit controls
- Adaptive image-to-pixel conversion with transparency support
- PNG, GIF, sprite-sheet, project JSON, and multi-engine game bundle exports
- Responsive desktop and mobile editor layouts

## Run locally

Requirements:

- Node.js 22.13 or newer
- npm
- Linux or WSL for the provided bounded Sites build scripts

```bash
npm ci
npm run dev
```

Open the local URL printed by the development server. To test WebMCP in Chrome, enable the WebMCP testing flag described in the challenge documentation. ChatGPT's in-app browser supports WebMCP directly.

## Test and build

```bash
npm test
npm run lint
npm run build
```

The test suite covers project editing, reference conversion and fidelity behavior, animation and export formats, WebMCP registration, and rendered UI metadata.

## Demo video

The reproducible Remotion project is in [`demo-video`](demo-video). It uses real captures from the deployed app and an audio narration track.

```bash
cd demo-video
npm ci
npm run render
```

The rendered MP4 is written to `demo-video/out/pixelforge-demo.mp4`.

## Architecture

- Next.js 16 and React 19 UI
- Vinext and Vite for Cloudflare-compatible Sites output
- Browser-local project and reference storage
- TypeScript pixel-art algorithms and exporters
- Browser-native WebMCP registration
- Remotion demo-video source

## License

MIT — see [LICENSE](LICENSE).
