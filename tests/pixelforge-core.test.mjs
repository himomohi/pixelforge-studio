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
    assert.equal(registrations.length, 41);
    assert.equal(new Set(registrations.map(({ tool }) => tool.name)).size, 41);

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

    cleanup();
    assert.ok(registrations.every(({ signal }) => signal?.aborted));
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});
