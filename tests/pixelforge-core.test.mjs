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
  assert.equal(MAX_CANVAS_DIMENSION, 1024);
  assert.equal(recommendedZoom(1024, 1024), 1);
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
    assert.equal(registrations.length, 44);
    assert.equal(new Set(registrations.map(({ tool }) => tool.name)).size, 44);
    for (const name of [
      "list_project_presets",
      "create_from_preset",
      "image_to_pixel",
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
    assert.equal(imageTool.inputSchema.properties.width.maximum, 1024);
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

    cleanup();
    assert.ok(registrations.every(({ signal }) => signal?.aborted));
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});
