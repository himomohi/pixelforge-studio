# PixelForge Studio — WebMCP Challenge demo narration

PixelForge Studio starts with proof: a real pixel editor, a real WebMCP call, and ten cyan pixels drawn directly into the active layer.

PixelForge is a browser-based studio for indie game creators. The artist keeps the visual workflow: drawing, palettes, frames, layers, animation, references, undo, redo, and exports. An agent helps with precise, repetitive work through the same project state.

That matters because pixel art is exacting. A request such as “move these pixels, add a frame, or prepare an animation layer” should not depend on guessing a screen coordinate, a panel focus, or which frame happens to be selected.

PixelForge runs in the browser and is Cloudflare-compatible. It exposes sixty-five typed WebMCP tools that use product concepts: project state, frames, layers, pixels, references, playback, fidelity checks, and exports. Each tool returns an explicit result, and the editor updates immediately for the person watching.

Here is the exact request: inspect the project. Add a frame, undo it, duplicate a frame, set it to 180 milliseconds, add and name a layer “Agent Highlights,” then draw ten #5EE8FF pixels.

Watch the uninterrupted live run. The agent first reads the project state: four frames and one layer. It adds a frame, moving from four to five. It undoes that change, returning from five to four. It duplicates a frame, returning to five. It sets the frame duration to 180 milliseconds, adds a second layer, names it Agent Highlights, and draws the ten cyan pixels.

The result is not a hidden automation log. It is visible in the actual editor. The artist can keep drawing, inspect the generated work, undo it, and redo it — all in the shared state.

Finally, PixelForge turns the edited work into something shippable: a PNG, animated GIF, sprite sheet with metadata, editable project, or game-ready bundle.

Try the Cloudflare deployment first, explore the source on GitHub, or use the Sites backup. PixelForge Studio makes WebMCP edits visible, reviewable, and useful for real pixel-art production.

## Exact request

> Inspect the project. Add a frame, undo it, duplicate a frame, set it to 180 ms, add and name a layer “Agent Highlights,” then draw ten #5EE8FF pixels.

## URLs

- Cloudflare: https://pixelforge-studio.himomohi.workers.dev
- GitHub: https://github.com/himomohi/pixelforge-studio
- Sites backup: https://pixelforge-studio.appcaster.chatgpt.site
