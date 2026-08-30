import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

after(async () => {
  await vite.close();
});

test("project reducer preserves complete cels and locked pixels", async () => {
  const { createProject, celFor, validateProject } = await vite.ssrLoadModule(
    "/lib/pixelforge/project.ts",
  );
  const { projectReducer } = await vite.ssrLoadModule(
    "/lib/pixelforge/reducer.ts",
  );

  let project = createProject(4, 4, "Reducer contract");
  const layerId = project.activeLayerId;
  const frameId = project.activeFrameId;
  project = projectReducer(project, {
    type: "pixels/patch",
    layerId,
    frameId,
    patches: [{ x: 1, y: 1, color: "#ff00ff" }],
  });
  project = projectReducer(project, {
    type: "layer/lock",
    id: layerId,
    locked: true,
  });
  project = projectReducer(project, { type: "cel/clear", layerId, frameId });
  assert.equal(celFor(project, layerId, frameId).pixels[5], "#ff00ff");

  project = projectReducer(project, { type: "frame/add", duration: 120 });
  project = projectReducer(project, { type: "layer/add", name: "Highlights" });
  assert.equal(
    Object.keys(project.cels).length,
    project.layers.length * project.frames.length,
  );
  assert.equal(validateProject(project), true);
});

test("project validation rejects incomplete and duplicate cel references", async () => {
  const { createProject, validateProject } = await vite.ssrLoadModule(
    "/lib/pixelforge/project.ts",
  );
  const project = createProject(2, 2, "Validation contract");
  const damaged = structuredClone(project);
  delete damaged.cels[Object.keys(damaged.cels)[0]];
  assert.equal(validateProject(damaged), false);

  const duplicateReference = structuredClone(project);
  duplicateReference.layers[0].frameIds = ["missing-cel"];
  assert.equal(validateProject(duplicateReference), false);
});

test("production presets cover web games, classic systems, and detailed canvases", async () => {
  const { projectPresets, getProjectPreset, recommendedZoom, MAX_CANVAS_DIMENSION } =
    await vite.ssrLoadModule("/lib/pixelforge/presets.ts");
  const categories = new Set(projectPresets.map((preset) => preset.category));
  assert.deepEqual(
    categories,
    new Set(["sprites", "tiles-ui", "web-games", "classic-systems"]),
  );
  assert.deepEqual(
    [getProjectPreset("pico8-screen").width, getProjectPreset("pico8-screen").height],
    [128, 128],
  );
  assert.deepEqual(
    [getProjectPreset("web-detailed-640x360").width, getProjectPreset("playdate-screen").height],
    [640, 240],
  );
  assert.equal(MAX_CANVAS_DIMENSION, 4096);
  assert.equal(recommendedZoom(1254, 1254), 1);
  assert.ok(projectPresets.length >= 20);
});

test("adaptive pixelization preserves bounds, palette, alpha, and dither modes", async () => {
  const { pixelizeRgba } = await vite.ssrLoadModule(
    "/lib/pixelforge/pixelize.ts",
  );
  const rgba = new Uint8ClampedArray([
    255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255,
    255, 255, 0, 255, 255, 0, 255, 128, 0, 0, 0, 0,
  ]);
  for (const dither of ["none", "ordered-4x4", "floyd-steinberg"]) {
    const converted = pixelizeRgba(rgba, 3, 2, {
      maxColors: 4,
      dither,
      alphaThreshold: 8,
      preserveAlpha: true,
    });
    assert.equal(converted.pixels.length, 6);
    assert.ok(converted.palette.length >= 2 && converted.palette.length <= 4);
    assert.equal(converted.transparentPixels, 1);
    assert.equal(converted.pixels[5], "");
    assert.match(converted.pixels[4], /^#[0-9a-f]{8}$/);
  }
});

test("reference image state stays bounded and excludes remote sources", async () => {
  const {
    DEFAULT_REFERENCE_IMAGE_STATE,
    normalizeReferenceImageState,
    validateReferenceImageState,
  } = await vite.ssrLoadModule("/lib/pixelforge/reference-image.ts");
  const normalized = normalizeReferenceImageState({
    mode: "overlay",
    zoom: 99,
    opacity: -4,
    panelSize: 10_000,
    overlayRect: { x: -10, y: 99_999, width: 4, height: 9_999 },
  });

  assert.equal(normalized.mode, "overlay");
  assert.equal(normalized.zoom, 8);
  assert.equal(normalized.opacity, 0);
  assert.equal(normalized.panelSize, 720);
  assert.deepEqual(normalized.overlayRect, {
    x: 0,
    y: 4096,
    width: 260,
    height: 1200,
  });
  assert.equal(validateReferenceImageState(normalized), true);
  assert.equal("url" in normalized, false);
  assert.equal("dataUrl" in normalized, false);
  assert.equal(validateReferenceImageState(DEFAULT_REFERENCE_IMAGE_STATE), true);
});

test("animated GIF export emits a complete GIF89a file", async () => {
  const { createProject } = await vite.ssrLoadModule(
    "/lib/pixelforge/project.ts",
  );
  const { projectReducer } = await vite.ssrLoadModule(
    "/lib/pixelforge/reducer.ts",
  );
  const { exportAnimatedGif } = await vite.ssrLoadModule(
    "/lib/pixelforge/export.ts",
  );

  let project = createProject(3, 2, "GIF contract");
  project = projectReducer(project, {
    type: "pixels/patch",
    layerId: project.activeLayerId,
    frameId: project.activeFrameId,
    patches: [{ x: 0, y: 0, color: "#b8f34a" }],
  });
  project = projectReducer(project, { type: "frame/duplicate", id: project.activeFrameId });
  const blob = exportAnimatedGif(project, { scale: 2, loop: 0 });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(blob.type, "image/gif");
  assert.equal(new TextDecoder().decode(bytes.slice(0, 6)), "GIF89a");
  assert.equal(bytes.at(-1), 0x3b);
  assert.ok(bytes.length > 800);
});

test("game bundle ZIP writer packages named assets", async () => {
  const { createStoredZip } = await vite.ssrLoadModule(
    "/lib/pixelforge/game-export.ts",
  );
  const blob = createStoredZip([
    { name: "metadata/atlas.json", bytes: new TextEncoder().encode("{}") },
    {
      name: "engine/godot-sprite-frames.tres",
      bytes: new TextEncoder().encode("[resource]"),
    },
    {
      name: "frames/frame-000.png",
      bytes: new Uint8Array([137, 80, 78, 71]),
    },
  ]);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(blob.type, "application/zip");
  assert.deepEqual([...bytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  const text = new TextDecoder().decode(bytes);
  assert.match(text, /metadata\/atlas\.json/);
  assert.match(text, /engine\/godot-sprite-frames\.tres/);
  assert.match(text, /frames\/frame-000\.png/);
});

test("WebMCP registers a unique, cancellable tool for every workflow", async () => {
  const { registerPixelForgeTools } = await vite.ssrLoadModule(
    "/lib/pixelforge/webmcp.ts",
  );
  const registrations = [];
  const originalDocument = globalThis.document;
  globalThis.document = {
    modelContext: {
      async registerTool(tool, options) {
        registrations.push({ tool, signal: options?.signal });
      },
    },
  };

  const calls = [];
  const api = new Proxy(
    {
      getProjectState(options) {
        calls.push(["getProjectState", options]);
        return { ok: true, name: "Automation contract" };
      },
      async exportAsset(format, options, signal) {
        calls.push(["exportAsset", format, options, signal]);
        return { ok: true, filename: `contract.${format}` };
      },
    },
    {
      get(target, property) {
        if (property in target) return target[property];
        return (...args) => {
          calls.push([String(property), ...args]);
          return { ok: true };
        };
      },
    },
  );

  try {
    const cleanup = await registerPixelForgeTools(api);
    assert.equal(typeof cleanup, "function");
    assert.equal(registrations.length, 64);
    assert.equal(new Set(registrations.map(({ tool }) => tool.name)).size, 64);
    for (const name of [
      "list_projects",
      "select_project",
      "duplicate_project",
      "list_project_presets",
      "create_from_preset",
      "image_to_pixel",
      "animation_from_images",
      "export_game_bundle",
      "reference_image.get_state",
      "reference_image.set_from_data_url",
      "reference_image.set_mode",
      "reference_image.set_overlay_rect",
      "reference_image.pixelize",
    ]) {
      assert.ok(registrations.some(({ tool }) => tool.name === name));
    }

    const stateTool = registrations.find(
      ({ tool }) => tool.name === "get_project_state",
    ).tool;
    assert.deepEqual(await stateTool.execute({ includePixels: false }), {
      ok: true,
      name: "Automation contract",
    });
    assert.deepEqual(calls[0], ["getProjectState", { includePixels: false }]);

    const exportTool = registrations.find(
      ({ tool }) => tool.name === "export_gif",
    ).tool;
    const cancelled = new AbortController();
    cancelled.abort();
    await assert.rejects(
      () => exportTool.execute({ scale: 1 }, { signal: cancelled.signal }),
      (error) => error?.name === "AbortError",
    );

    const imageTool = registrations.find(
      ({ tool }) => tool.name === "image_to_pixel",
    ).tool;
    assert.equal(imageTool.inputSchema.properties.width.maximum, 4096);
    await assert.rejects(
      () =>
        imageTool.execute(
          {
            imageDataUrl: "data:image/png;base64,AA==",
            width: 32,
            height: 32,
          },
          { signal: cancelled.signal },
        ),
      (error) => error?.name === "AbortError",
    );

    const panelTool = registrations.find(
      ({ tool }) => tool.name === "reference_image.set_panel_size",
    ).tool;
    assert.equal(panelTool.inputSchema.properties.panelSize.minimum, 220);
    assert.equal(panelTool.inputSchema.properties.panelSize.maximum, 720);
    await panelTool.execute({ panelSize: 360 });
    assert.deepEqual(calls.at(-1), ["setReferencePanelSize", 360]);

    const referenceDataTool = registrations.find(
      ({ tool }) => tool.name === "reference_image.set_from_data_url",
    ).tool;
    assert.match(
      referenceDataTool.inputSchema.properties.imageDataUrl.pattern,
      /data:image/,
    );
    await assert.rejects(
      () =>
        referenceDataTool.execute(
          { imageDataUrl: "data:image/png;base64,AA==" },
          { signal: cancelled.signal },
        ),
      (error) => error?.name === "AbortError",
    );

    cleanup();
    assert.ok(registrations.every(({ signal }) => signal?.aborted));
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});
