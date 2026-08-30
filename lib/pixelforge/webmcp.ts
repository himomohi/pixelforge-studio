/** Browser-native WebMCP bridge for PixelForge Studio. */

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
export type ToolInput = Record<string, unknown>;
export type ToolOutput = JsonValue | { [key: string]: JsonValue };

export interface EditorAutomationApi {
  getProjectState(options?: { includePixels?: boolean }): ToolOutput;
  listProjectPresets(): ToolOutput;
  createFromPreset(input: { presetId: string; name?: string }): ToolOutput;
  createProject(input: { width: number; height: number; name?: string }): ToolOutput;
  pixelizeImage(
    input: {
      imageDataUrl: string;
      name?: string;
      width: number;
      height: number;
      maxColors?: number;
      dither?: "none" | "ordered-4x4" | "floyd-steinberg";
      fit?: "contain" | "cover" | "stretch";
      sampling?: "smooth" | "nearest";
      alphaThreshold?: number;
      preserveAlpha?: boolean;
    },
    signal?: AbortSignal,
  ): ToolOutput | Promise<ToolOutput>;
  getReferenceState(): ToolOutput;
  openReferencePicker(): ToolOutput;
  setReferenceFromDataUrl(
    input: { imageDataUrl: string; name?: string },
    signal?: AbortSignal,
  ): ToolOutput | Promise<ToolOutput>;
  clearReferenceImage(): ToolOutput;
  setReferenceMode(mode: "split" | "overlay" | "hidden"): ToolOutput;
  setReferenceZoom(zoom: number): ToolOutput;
  setReferenceOpacity(opacity: number): ToolOutput;
  setReferenceFlip(input: { flipX?: boolean; flipY?: boolean }): ToolOutput;
  setReferencePanelSize(panelSize: number): ToolOutput;
  setReferenceOverlayRect(input: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): ToolOutput;
  fitReferenceImage(): ToolOutput;
  setReferencePinned(pinned: boolean): ToolOutput;
  setReferenceCollapsed(collapsed: boolean): ToolOutput;
  pixelizeReference(
    input: {
      name?: string;
      width?: number;
      height?: number;
      maxColors?: number;
      dither?: "none" | "ordered-4x4" | "floyd-steinberg";
      fit?: "contain" | "cover" | "stretch";
      sampling?: "smooth" | "nearest";
      alphaThreshold?: number;
      preserveAlpha?: boolean;
    },
    signal?: AbortSignal,
  ): ToolOutput | Promise<ToolOutput>;
  importProject(project: unknown): ToolOutput;
  renameProject(name: string): ToolOutput;
  resizeCanvas(input: { width: number; height: number; anchor?: string }): ToolOutput;
  setActiveTool(tool: string): ToolOutput;
  setPrimaryColor(color: string): ToolOutput;
  setSecondaryColor(color: string): ToolOutput;
  setBrushSize(size: number): ToolOutput;
  loadPalette(input: { name?: string; colors: string[] }): ToolOutput;
  drawPixels(input: {
    pixels: Array<{ x: number; y: number; color?: string }>;
    color?: string;
  }): ToolOutput;
  applyEdit(input: {
    operation: "line" | "rectangle" | "ellipse" | "fill";
    start: { x: number; y: number };
    end?: { x: number; y: number };
    color?: string;
    filled?: boolean;
  }): ToolOutput;
  clearActiveCel(): ToolOutput;
  setSelection(selection: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null): ToolOutput;
  deleteSelection(): ToolOutput;
  addFrame(): ToolOutput;
  duplicateFrame(): ToolOutput;
  deleteFrame(): ToolOutput;
  setActiveFrame(index: number): ToolOutput;
  setFrameDuration(ms: number): ToolOutput;
  reorderFrame(to: number): ToolOutput;
  addLayer(name?: string): ToolOutput;
  duplicateLayer(): ToolOutput;
  deleteLayer(): ToolOutput;
  renameLayer(name: string): ToolOutput;
  toggleLayerVisibility(): ToolOutput;
  lockLayer(locked?: boolean): ToolOutput;
  setLayerOpacity(opacity: number): ToolOutput;
  setActiveLayer(index: number): ToolOutput;
  reorderLayer(to: number): ToolOutput;
  undo(): ToolOutput;
  redo(): ToolOutput;
  setZoom(zoom: number): ToolOutput;
  toggleGrid(enabled?: boolean): ToolOutput;
  toggleOnionSkin(enabled?: boolean): ToolOutput;
  toggleSymmetry(enabled?: boolean): ToolOutput;
  playback(action: "play" | "pause" | "stop"): ToolOutput;
  exportAsset(
    format: "png" | "gif" | "spritesheet" | "project",
    options?: ToolInput,
    signal?: AbortSignal,
  ): ToolOutput | Promise<ToolOutput>;
}

type ExecuteContext = { signal?: AbortSignal };

interface WebMCPTool {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
  execute: (
    input: ToolInput,
    context?: ExecuteContext,
  ) => ToolOutput | Promise<ToolOutput>;
}

interface ModelContext {
  registerTool(
    tool: WebMCPTool,
    options?: { signal?: AbortSignal },
  ): Promise<void>;
}

declare global {
  interface Document {
    modelContext?: ModelContext;
  }
}

const noArgs = {
  type: "object",
  additionalProperties: false,
  properties: {},
};
const integer = (minimum = 0, maximum = 8192, description?: string) => ({
  type: "integer",
  minimum,
  maximum,
  description,
});
const number = (minimum = 0, maximum = 100, description?: string) => ({
  type: "number",
  minimum,
  maximum,
  description,
});
const boolean = (description?: string) => ({ type: "boolean", description });
const color = {
  type: "string",
  pattern: "^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$",
  description: "Hex color as #RRGGBB or #RRGGBBAA.",
};
const point = {
  type: "object",
  additionalProperties: false,
  required: ["x", "y"],
  properties: {
    x: integer(0, 1023, "Zero-based pixel x coordinate."),
    y: integer(0, 1023, "Zero-based pixel y coordinate."),
  },
};

function definition(
  name: string,
  title: string,
  description: string,
  inputSchema: Record<string, unknown>,
  execute: WebMCPTool["execute"],
  annotations: WebMCPTool["annotations"] = {},
): WebMCPTool {
  return {
    name,
    title,
    description,
    inputSchema,
    execute,
    annotations: {
      openWorldHint: false,
      ...annotations,
    },
  };
}

function assertActive(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("The WebMCP operation was cancelled.", "AbortError");
  }
}

/** Register every editor workflow as a browser-native WebMCP tool. */
export async function registerPixelForgeTools(
  api: EditorAutomationApi,
  onStatus?: (message: string) => void,
): Promise<(() => void) | null> {
  if (typeof document === "undefined" || !document.modelContext?.registerTool) {
    return null;
  }

  const host = document.modelContext;
  const controller = new AbortController();
  const call = <T extends keyof EditorAutomationApi>(
    method: T,
    args: unknown[] = [],
    context?: ExecuteContext,
  ) => {
    assertActive(context?.signal);
    const fn = api[method] as unknown as (...values: unknown[]) => ToolOutput;
    const output = fn(...args);
    onStatus?.(String(method) + " completed");
    return output;
  };

  const tools: WebMCPTool[] = [
    definition(
      "get_project_state",
      "Get project state",
      "Read a concise project summary. Set includePixels only when exact cel data is required.",
      {
        type: "object",
        additionalProperties: false,
        properties: {
          includePixels: boolean("Include every cel pixel. This can be a large response."),
        },
      },
      (input, context) =>
        call("getProjectState", [{ includePixels: input.includePixels === true }], context),
      { readOnlyHint: true, idempotentHint: true },
    ),
    definition(
      "list_project_presets",
      "List production presets",
      "List researched sprite, tile, web-game, and classic-system canvas presets.",
      noArgs,
      (_input, context) => call("listProjectPresets", [], context),
      { readOnlyHint: true, idempotentHint: true },
    ),
    definition(
      "create_from_preset",
      "Create from preset",
      "Replace the workspace with a production-sized preset and matching palette.",
      {
        type: "object",
        additionalProperties: false,
        required: ["presetId"],
        properties: {
          presetId: { type: "string", minLength: 1, maxLength: 80 },
          name: { type: "string", maxLength: 120 },
        },
      },
      (input, context) => call("createFromPreset", [input], context),
      { destructiveHint: true },
    ),
    definition(
      "create_project",
      "Create project",
      "Replace the workspace with a new transparent pixel project.",
      {
        type: "object",
        additionalProperties: false,
        required: ["width", "height"],
        properties: {
          width: integer(1, 1024, "Canvas width in pixels."),
          height: integer(1, 1024, "Canvas height in pixels."),
          name: { type: "string", maxLength: 120, description: "Project name." },
        },
      },
      (input, context) => call("createProject", [input], context),
      { destructiveHint: true },
    ),
    definition(
      "image_to_pixel",
      "Convert image to pixel art",
      "Decode a bounded PNG, JPEG, or WebP data URL, downsample it, quantize its palette, apply optional dithering, and replace the workspace with an editable pixel project.",
      {
        type: "object",
        additionalProperties: false,
        required: ["imageDataUrl", "width", "height"],
        properties: {
          imageDataUrl: {
            type: "string",
            pattern: "^data:image/(png|jpeg|webp);base64,",
            maxLength: 22400000,
            description: "Base64 image data URL; arbitrary remote URLs are not accepted.",
          },
          name: { type: "string", maxLength: 120 },
          width: integer(1, 1024, "Editable output width."),
          height: integer(1, 1024, "Editable output height."),
          maxColors: integer(2, 64, "Adaptive palette size."),
          dither: {
            type: "string",
            enum: ["none", "ordered-4x4", "floyd-steinberg"],
          },
          fit: { type: "string", enum: ["contain", "cover", "stretch"] },
          sampling: { type: "string", enum: ["smooth", "nearest"] },
          alphaThreshold: integer(0, 255),
          preserveAlpha: boolean("Preserve alpha values above the cutoff."),
        },
      },
      async (input, context) => {
        assertActive(context?.signal);
        const output = await api.pixelizeImage(
          {
            imageDataUrl: String(input.imageDataUrl),
            name: typeof input.name === "string" ? input.name : undefined,
            width: Number(input.width),
            height: Number(input.height),
            maxColors:
              input.maxColors === undefined ? undefined : Number(input.maxColors),
            dither: input.dither as
              | "none"
              | "ordered-4x4"
              | "floyd-steinberg"
              | undefined,
            fit: input.fit as "contain" | "cover" | "stretch" | undefined,
            sampling: input.sampling as "smooth" | "nearest" | undefined,
            alphaThreshold:
              input.alphaThreshold === undefined
                ? undefined
                : Number(input.alphaThreshold),
            preserveAlpha:
              input.preserveAlpha === undefined
                ? undefined
                : input.preserveAlpha === true,
          },
          context?.signal,
        );
        assertActive(context?.signal);
        onStatus?.("pixelizeImage completed");
        return output;
      },
      { destructiveHint: true },
    ),
    definition(
      "reference_image.get_state",
      "Get reference image state",
      "Read the browser-local reference image metadata and every synchronized view setting without returning the image bytes.",
      noArgs,
      (_input, context) => call("getReferenceState", [], context),
      { readOnlyHint: true, idempotentHint: true },
    ),
    definition(
      "reference_image.open_picker",
      "Open reference image picker",
      "Request the browser file picker for a local PNG, JPEG, or WebP. Browser user-activation rules may require the user to click the visible upload control instead.",
      noArgs,
      (_input, context) => call("openReferencePicker", [], context),
    ),
    definition(
      "reference_image.set_from_data_url",
      "Set reference from data URL",
      "Validate and store a bounded PNG, JPEG, or WebP data URL as the current browser-local reference image. Remote URLs are never accepted.",
      {
        type: "object",
        additionalProperties: false,
        required: ["imageDataUrl"],
        properties: {
          imageDataUrl: {
            type: "string",
            pattern: "^data:image/(png|jpeg|webp);base64,",
            maxLength: 22400000,
            description: "Base64 image data URL; arbitrary remote URLs are not accepted.",
          },
          name: { type: "string", maxLength: 180 },
        },
      },
      async (input, context) => {
        assertActive(context?.signal);
        const output = await api.setReferenceFromDataUrl(
          {
            imageDataUrl: String(input.imageDataUrl),
            name: typeof input.name === "string" ? input.name : undefined,
          },
          context?.signal,
        );
        assertActive(context?.signal);
        onStatus?.("setReferenceFromDataUrl completed");
        return output;
      },
    ),
    definition(
      "reference_image.clear",
      "Clear reference image",
      "Remove the current browser-local reference image while preserving the pixel project.",
      noArgs,
      (_input, context) => call("clearReferenceImage", [], context),
      { destructiveHint: true },
    ),
    definition(
      "reference_image.set_mode",
      "Set reference display mode",
      "Switch the desktop reference between split, floating overlay, and hidden modes. Mobile continues to use its dedicated sheet viewer.",
      {
        type: "object",
        additionalProperties: false,
        required: ["mode"],
        properties: {
          mode: {
            type: "string",
            enum: ["split", "overlay", "hidden"],
          },
        },
      },
      (input, context) => call("setReferenceMode", [input.mode], context),
      { idempotentHint: true },
    ),
    definition(
      "reference_image.set_zoom",
      "Set reference zoom",
      "Set the reference image scale from 0.1 to 8, where 1 is 100 percent.",
      {
        type: "object",
        additionalProperties: false,
        required: ["zoom"],
        properties: {
          zoom: number(0.1, 8, "Scale multiplier; 1 is 100 percent."),
        },
      },
      (input, context) =>
        call("setReferenceZoom", [Number(input.zoom)], context),
      { idempotentHint: true },
    ),
    definition(
      "reference_image.set_opacity",
      "Set reference opacity",
      "Set reference image opacity from 0 to 1.",
      {
        type: "object",
        additionalProperties: false,
        required: ["opacity"],
        properties: {
          opacity: number(0, 1, "Opacity from transparent 0 to opaque 1."),
        },
      },
      (input, context) =>
        call("setReferenceOpacity", [Number(input.opacity)], context),
      { idempotentHint: true },
    ),
    definition(
      "reference_image.set_flip",
      "Set reference flips",
      "Set horizontal and/or vertical reference mirroring. At least one field is required.",
      {
        type: "object",
        additionalProperties: false,
        minProperties: 1,
        properties: {
          flipX: boolean("Mirror left to right."),
          flipY: boolean("Mirror top to bottom."),
        },
      },
      (input, context) =>
        call(
          "setReferenceFlip",
          [
            {
              flipX:
                input.flipX === undefined ? undefined : input.flipX === true,
              flipY:
                input.flipY === undefined ? undefined : input.flipY === true,
            },
          ],
          context,
        ),
      { idempotentHint: true },
    ),
    definition(
      "reference_image.set_panel_size",
      "Set reference panel width",
      "Set the desktop split reference panel width in pixels.",
      {
        type: "object",
        additionalProperties: false,
        required: ["panelSize"],
        properties: {
          panelSize: integer(220, 720, "Desktop panel width in pixels."),
        },
      },
      (input, context) =>
        call("setReferencePanelSize", [Number(input.panelSize)], context),
      { idempotentHint: true },
    ),
    definition(
      "reference_image.set_overlay_rect",
      "Set floating reference bounds",
      "Move and resize the floating reference using workspace-relative pixel bounds.",
      {
        type: "object",
        additionalProperties: false,
        required: ["x", "y", "width", "height"],
        properties: {
          x: integer(0, 4096),
          y: integer(0, 4096),
          width: integer(260, 1600),
          height: integer(220, 1200),
        },
      },
      (input, context) =>
        call(
          "setReferenceOverlayRect",
          [
            {
              x: Number(input.x),
              y: Number(input.y),
              width: Number(input.width),
              height: Number(input.height),
            },
          ],
          context,
        ),
      { idempotentHint: true },
    ),
    definition(
      "reference_image.fit",
      "Fit reference image",
      "Fit the entire reference image inside its current panel or floating window.",
      noArgs,
      (_input, context) => call("fitReferenceImage", [], context),
      { idempotentHint: true },
    ),
    definition(
      "reference_image.set_pinned",
      "Pin floating reference",
      "Pin or unpin the floating reference so its position and size cannot be changed by pointer input.",
      {
        type: "object",
        additionalProperties: false,
        required: ["pinned"],
        properties: { pinned: boolean() },
      },
      (input, context) =>
        call("setReferencePinned", [input.pinned === true], context),
      { idempotentHint: true },
    ),
    definition(
      "reference_image.set_collapsed",
      "Collapse reference panel",
      "Collapse or expand the desktop split reference panel without clearing its image.",
      {
        type: "object",
        additionalProperties: false,
        required: ["collapsed"],
        properties: { collapsed: boolean() },
      },
      (input, context) =>
        call("setReferenceCollapsed", [input.collapsed === true], context),
      { idempotentHint: true },
    ),
    definition(
      "reference_image.pixelize",
      "Convert current reference to pixel art",
      "Reuse the current browser-local reference as image-to-pixel input and replace the canvas with an editable pixel project.",
      {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string", maxLength: 120 },
          width: integer(1, 1024, "Defaults to the current project width."),
          height: integer(1, 1024, "Defaults to the current project height."),
          maxColors: integer(2, 64, "Adaptive palette size."),
          dither: {
            type: "string",
            enum: ["none", "ordered-4x4", "floyd-steinberg"],
          },
          fit: { type: "string", enum: ["contain", "cover", "stretch"] },
          sampling: { type: "string", enum: ["smooth", "nearest"] },
          alphaThreshold: integer(0, 255),
          preserveAlpha: boolean("Preserve alpha values above the cutoff."),
        },
      },
      async (input, context) => {
        assertActive(context?.signal);
        const output = await api.pixelizeReference(
          {
            name: typeof input.name === "string" ? input.name : undefined,
            width:
              input.width === undefined ? undefined : Number(input.width),
            height:
              input.height === undefined ? undefined : Number(input.height),
            maxColors:
              input.maxColors === undefined
                ? undefined
                : Number(input.maxColors),
            dither: input.dither as
              | "none"
              | "ordered-4x4"
              | "floyd-steinberg"
              | undefined,
            fit: input.fit as "contain" | "cover" | "stretch" | undefined,
            sampling: input.sampling as "smooth" | "nearest" | undefined,
            alphaThreshold:
              input.alphaThreshold === undefined
                ? undefined
                : Number(input.alphaThreshold),
            preserveAlpha:
              input.preserveAlpha === undefined
                ? undefined
                : input.preserveAlpha === true,
          },
          context?.signal,
        );
        assertActive(context?.signal);
        onStatus?.("pixelizeReference completed");
        return output;
      },
      { destructiveHint: true },
    ),
    definition(
      "import_project",
      "Import project data",
      "Replace the workspace from a complete PixelForge project JSON object.",
      {
        type: "object",
        additionalProperties: false,
        required: ["project"],
        properties: { project: { type: "object", description: "PixelForge project object." } },
      },
      (input, context) => call("importProject", [input.project], context),
      { destructiveHint: true },
    ),
    definition(
      "rename_project",
      "Rename project",
      "Change the current project name.",
      {
        type: "object",
        additionalProperties: false,
        required: ["name"],
        properties: { name: { type: "string", minLength: 1, maxLength: 120 } },
      },
      (input, context) => call("renameProject", [input.name], context),
    ),
    definition(
      "resize_canvas",
      "Resize canvas",
      "Resize every cel and anchor existing pixels to a chosen edge or the center.",
      {
        type: "object",
        additionalProperties: false,
        required: ["width", "height"],
        properties: {
          width: integer(1, 1024),
          height: integer(1, 1024),
          anchor: {
            type: "string",
            enum: [
              "top-left", "top", "top-right", "left", "center", "right",
              "bottom-left", "bottom", "bottom-right",
            ],
          },
        },
      },
      (input, context) => call("resizeCanvas", [input], context),
      { destructiveHint: true },
    ),
    definition(
      "set_active_tool",
      "Select drawing tool",
      "Select pencil, eraser, fill, line, rectangle, ellipse, picker, marquee, or hand.",
      {
        type: "object",
        additionalProperties: false,
        required: ["tool"],
        properties: {
          tool: {
            type: "string",
            enum: [
              "pencil", "eraser", "fill", "line", "rectangle",
              "ellipse", "picker", "select", "hand",
            ],
          },
        },
      },
      (input, context) => call("setActiveTool", [input.tool], context),
    ),
    definition(
      "set_primary_color",
      "Set primary color",
      "Set the foreground drawing color.",
      {
        type: "object",
        additionalProperties: false,
        required: ["color"],
        properties: { color },
      },
      (input, context) => call("setPrimaryColor", [input.color], context),
    ),
    definition(
      "set_secondary_color",
      "Set secondary color",
      "Set the right-click background drawing color.",
      {
        type: "object",
        additionalProperties: false,
        required: ["color"],
        properties: { color },
      },
      (input, context) => call("setSecondaryColor", [input.color], context),
    ),
    definition(
      "set_brush_size",
      "Set brush size",
      "Set the square pixel brush size from 1 to 8.",
      {
        type: "object",
        additionalProperties: false,
        required: ["size"],
        properties: { size: integer(1, 8) },
      },
      (input, context) => call("setBrushSize", [input.size], context),
    ),
    definition(
      "load_palette",
      "Load color palette",
      "Replace the active palette with named hex colors.",
      {
        type: "object",
        additionalProperties: false,
        required: ["colors"],
        properties: {
          name: { type: "string", maxLength: 80 },
          colors: {
            type: "array",
            minItems: 1,
            maxItems: 64,
            items: color,
          },
        },
      },
      (input, context) =>
        call("loadPalette", [{ name: input.name, colors: input.colors }], context),
    ),
    definition(
      "draw_pixels",
      "Draw pixel batch",
      "Write a bounded batch of exact pixels into the active cel atomically.",
      {
        type: "object",
        additionalProperties: false,
        required: ["pixels"],
        properties: {
          color,
          pixels: {
            type: "array",
            minItems: 1,
            maxItems: 1048576,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["x", "y"],
              properties: { ...point.properties, color },
            },
          },
        },
      },
      (input, context) => call("drawPixels", [input], context),
    ),
    definition(
      "apply_edit",
      "Draw shape or fill",
      "Run the editor's line, rectangle, ellipse, or flood-fill algorithm on the active cel.",
      {
        type: "object",
        additionalProperties: false,
        required: ["operation", "start"],
        properties: {
          operation: {
            type: "string",
            enum: ["line", "rectangle", "ellipse", "fill"],
          },
          start: point,
          end: point,
          color,
          filled: boolean("Fill the interior of rectangles or ellipses."),
        },
      },
      (input, context) => call("applyEdit", [input], context),
    ),
    definition(
      "clear_active_cel",
      "Clear active cel",
      "Erase all pixels in the active layer and frame unless the layer is locked.",
      noArgs,
      (_input, context) => call("clearActiveCel", [], context),
      { destructiveHint: true },
    ),
    definition(
      "set_selection",
      "Set marquee selection",
      "Create or clear the rectangular marquee selection.",
      {
        type: "object",
        additionalProperties: false,
        properties: {
          selection: {
            oneOf: [
              {
                type: "object",
                additionalProperties: false,
                required: ["x", "y", "width", "height"],
                properties: {
                  x: integer(0, 1023),
                  y: integer(0, 1023),
                  width: integer(1, 1024),
                  height: integer(1, 1024),
                },
              },
              { type: "null" },
            ],
          },
        },
      },
      (input, context) => call("setSelection", [input.selection ?? null], context),
    ),
    definition(
      "delete_selection",
      "Delete selected pixels",
      "Clear pixels inside the current marquee on the active cel.",
      noArgs,
      (_input, context) => call("deleteSelection", [], context),
      { destructiveHint: true },
    ),
  ];

  const simple: Array<{
    name: string;
    title: string;
    description: string;
    method: keyof EditorAutomationApi;
    destructive?: boolean;
  }> = [
    { name: "add_frame", title: "Add frame", description: "Append a blank animation frame.", method: "addFrame" },
    { name: "duplicate_frame", title: "Duplicate frame", description: "Copy the active frame and every layer cel.", method: "duplicateFrame" },
    { name: "delete_frame", title: "Delete frame", description: "Delete the active animation frame.", method: "deleteFrame", destructive: true },
    { name: "add_layer", title: "Add layer", description: "Add a transparent layer.", method: "addLayer" },
    { name: "duplicate_layer", title: "Duplicate layer", description: "Copy the active layer and all cels.", method: "duplicateLayer" },
    { name: "delete_layer", title: "Delete layer", description: "Delete the active layer.", method: "deleteLayer", destructive: true },
    { name: "toggle_layer_visibility", title: "Toggle layer visibility", description: "Show or hide the active layer.", method: "toggleLayerVisibility" },
    { name: "undo", title: "Undo", description: "Undo the latest recorded project edit.", method: "undo" },
    { name: "redo", title: "Redo", description: "Redo the next project edit.", method: "redo" },
  ];
  simple.forEach((item) => {
    tools.push(
      definition(
        item.name,
        item.title,
        item.description,
        noArgs,
        (_input, context) => call(item.method, [], context),
        { destructiveHint: item.destructive },
      ),
    );
  });

  tools.push(
    definition(
      "set_active_frame",
      "Select frame",
      "Select an animation frame by zero-based index.",
      {
        type: "object", additionalProperties: false, required: ["index"],
        properties: { index: integer(0, 9999) },
      },
      (input, context) => call("setActiveFrame", [input.index], context),
    ),
    definition(
      "set_frame_duration",
      "Set frame duration",
      "Set the active frame duration in milliseconds.",
      {
        type: "object", additionalProperties: false, required: ["ms"],
        properties: { ms: integer(20, 10000) },
      },
      (input, context) => call("setFrameDuration", [input.ms], context),
    ),
    definition(
      "reorder_frame",
      "Reorder frame",
      "Move the active frame to a zero-based timeline index.",
      {
        type: "object", additionalProperties: false, required: ["to"],
        properties: { to: integer(0, 9999) },
      },
      (input, context) => call("reorderFrame", [input.to], context),
    ),
    definition(
      "rename_layer",
      "Rename layer",
      "Rename the active layer.",
      {
        type: "object", additionalProperties: false, required: ["name"],
        properties: { name: { type: "string", minLength: 1, maxLength: 120 } },
      },
      (input, context) => call("renameLayer", [input.name], context),
    ),
    definition(
      "lock_layer",
      "Lock layer",
      "Lock, unlock, or toggle the active layer edit lock.",
      {
        type: "object", additionalProperties: false,
        properties: { locked: boolean("Omit to toggle.") },
      },
      (input, context) => call("lockLayer", [input.locked], context),
    ),
    definition(
      "set_layer_opacity",
      "Set layer opacity",
      "Set active layer opacity from 0 to 100 percent.",
      {
        type: "object", additionalProperties: false, required: ["opacity"],
        properties: { opacity: number(0, 100) },
      },
      (input, context) => call("setLayerOpacity", [input.opacity], context),
    ),
    definition(
      "set_active_layer",
      "Select layer",
      "Select a layer by zero-based index.",
      {
        type: "object", additionalProperties: false, required: ["index"],
        properties: { index: integer(0, 9999) },
      },
      (input, context) => call("setActiveLayer", [input.index], context),
    ),
    definition(
      "reorder_layer",
      "Reorder layer",
      "Move the active layer to a zero-based stack index.",
      {
        type: "object", additionalProperties: false, required: ["to"],
        properties: { to: integer(0, 9999) },
      },
      (input, context) => call("reorderLayer", [input.to], context),
    ),
    definition(
      "set_zoom",
      "Set canvas zoom",
      "Set the editor's integer pixel zoom multiplier from 1 to 64.",
      {
        type: "object", additionalProperties: false, required: ["zoom"],
        properties: { zoom: integer(1, 64) },
      },
      (input, context) => call("setZoom", [input.zoom], context),
    ),
  );

  const toggles: Array<{
    name: string;
    title: string;
    description: string;
    method: "toggleGrid" | "toggleOnionSkin" | "toggleSymmetry";
  }> = [
    { name: "toggle_grid", title: "Toggle grid", description: "Show, hide, or toggle the pixel grid.", method: "toggleGrid" },
    { name: "toggle_onion_skin", title: "Toggle onion skin", description: "Show, hide, or toggle adjacent animation frames.", method: "toggleOnionSkin" },
    { name: "toggle_symmetry", title: "Toggle symmetry", description: "Enable, disable, or toggle mirrored drawing on both axes.", method: "toggleSymmetry" },
  ];
  toggles.forEach((item) => {
    tools.push(
      definition(
        item.name,
        item.title,
        item.description,
        {
          type: "object", additionalProperties: false,
          properties: { enabled: boolean("Omit to toggle the current value.") },
        },
        (input, context) => call(item.method, [input.enabled], context),
      ),
    );
  });

  tools.push(
    definition(
      "playback",
      "Control animation playback",
      "Play, pause, or stop the frame animation.",
      {
        type: "object", additionalProperties: false, required: ["action"],
        properties: { action: { type: "string", enum: ["play", "pause", "stop"] } },
      },
      (input, context) => call("playback", [input.action], context),
    ),
  );

  const exports: Array<{
    format: "png" | "gif" | "spritesheet" | "project";
    schema: Record<string, unknown>;
    description: string;
  }> = [
    {
      format: "png",
      description: "Download the active frame as a crisp PNG.",
      schema: {
        type: "object", additionalProperties: false,
        properties: { scale: integer(1, 16) },
      },
    },
    {
      format: "gif",
      description: "Download all frames as a looping animated GIF.",
      schema: {
        type: "object", additionalProperties: false,
        properties: { scale: integer(1, 8), loop: boolean() },
      },
    },
    {
      format: "spritesheet",
      description: "Download a PNG sprite sheet and JSON frame metadata.",
      schema: {
        type: "object", additionalProperties: false,
        properties: {
          scale: integer(1, 16),
          columns: integer(1, 9999),
          gap: integer(0, 128),
          layout: { type: "string", enum: ["horizontal", "vertical", "grid"] },
        },
      },
    },
    {
      format: "project",
      description: "Download the editable PixelForge project file.",
      schema: noArgs,
    },
  ];
  exports.forEach((item) => {
    tools.push(
      definition(
        "export_" + item.format,
        "Export " + item.format,
        item.description,
        item.schema,
        async (input, context) => {
          assertActive(context?.signal);
          const output = await api.exportAsset(
            item.format,
            input,
            context?.signal,
          );
          assertActive(context?.signal);
          onStatus?.("exportAsset completed");
          return output;
        },
      ),
    );
  });

  try {
    await Promise.all(
      tools.map((tool) =>
        host.registerTool(tool, { signal: controller.signal }),
      ),
    );
    onStatus?.(String(tools.length) + " WebMCP tools registered");
    return () => controller.abort();
  } catch (error) {
    controller.abort();
    const message =
      error instanceof Error ? error.message : "WebMCP registration failed";
    onStatus?.(message);
    throw error;
  }
}
