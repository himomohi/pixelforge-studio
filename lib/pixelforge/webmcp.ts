/** WebMCP bridge for PixelForge. This module is intentionally UI-framework agnostic. */

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type ToolInput = Record<string, unknown>;
export type ToolOutput = JsonValue | { [key: string]: JsonValue };

export interface EditorAutomationApi {
  getProjectState(): ToolOutput;
  createProject(input: { width: number; height: number; name?: string }): ToolOutput;
  setActiveTool(tool: string): ToolOutput;
  setPrimaryColor(color: string): ToolOutput;
  drawPixels(input: { pixels: Array<{ x: number; y: number; color?: string }>; color?: string }): ToolOutput;
  clearActiveCel(): ToolOutput;
  addFrame(): ToolOutput; duplicateFrame(): ToolOutput; deleteFrame(): ToolOutput; setActiveFrame(index: number): ToolOutput;
  setFrameDuration(ms: number): ToolOutput;
  addLayer(name?: string): ToolOutput; duplicateLayer(): ToolOutput; deleteLayer(): ToolOutput;
  renameLayer(name: string): ToolOutput; toggleLayerVisibility(): ToolOutput; setLayerOpacity(opacity: number): ToolOutput; setActiveLayer(index: number): ToolOutput;
  undo(): ToolOutput; redo(): ToolOutput; setZoom(zoom: number): ToolOutput;
  toggleGrid(enabled?: boolean): ToolOutput; toggleOnionSkin(enabled?: boolean): ToolOutput; toggleSymmetry(enabled?: boolean): ToolOutput;
  playback(action: "play" | "pause" | "stop"): ToolOutput;
  exportAsset(format: "png" | "gif" | "spritesheet" | "project", options?: ToolInput): ToolOutput | Promise<ToolOutput>;
}

interface WebMCPTool {
  name: string; description: string; inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
  execute: (input: ToolInput, context?: { signal?: AbortSignal }) => ToolOutput | Promise<ToolOutput>;
}
interface ModelContext { registerTool(tool: WebMCPTool, options?: { signal?: AbortSignal }): void | (() => void); }
type ContextHost = { modelContext?: ModelContext };

declare global {
  interface Document { modelContext?: ModelContext; }
  interface Navigator { modelContext?: ModelContext; }
}

const noArgs = { type: "object", additionalProperties: false, properties: {} };
const int = (min = 0, max = 8192) => ({ type: "integer", minimum: min, maximum: max });
const num = (min = 0, max = 100) => ({ type: "number", minimum: min, maximum: max });
const bool = { type: "boolean" };
const tool = (name: string, description: string, inputSchema: Record<string, unknown>, execute: WebMCPTool["execute"], readOnlyHint = false, destructiveHint = false): WebMCPTool => ({ name, description, inputSchema, execute, annotations: { readOnlyHint, destructiveHint } });

/** Register PixelForge commands with the browser's current WebMCP host. Returns null when unsupported. */
export function registerPixelForgeTools(api: EditorAutomationApi, onStatus?: (message: string) => void): (() => void) | null {
  if (typeof document === "undefined" || typeof navigator === "undefined") return null;
  const host = (document as ContextHost).modelContext ?? (navigator as ContextHost).modelContext;
  if (!host?.registerTool) return null;
  const abort = new AbortController();
  const call = <T extends keyof EditorAutomationApi>(method: T, args?: unknown[]) => {
    const fn = api[method] as unknown as (...values: unknown[]) => ToolOutput;
    const result = fn(...(args ?? [])); onStatus?.(`${String(method)} completed`); return result;
  };
  const px = { type: "object", required: ["pixels"], additionalProperties: false, properties: { color: { type: "string", pattern: "^#[0-9a-fA-F]{6,8}$" }, pixels: { type: "array", minItems: 1, maxItems: 100000, items: { type: "object", required: ["x", "y"], additionalProperties: false, properties: { x: int(), y: int(), color: { type: "string", pattern: "^#[0-9a-fA-F]{6,8}$" } } } } } };
  const tools: WebMCPTool[] = [
    tool("get_project_state", "Read the complete current project state.", noArgs, () => call("getProjectState"), true),
    tool("create_project", "Create a new pixel project.", { type: "object", required: ["width", "height"], additionalProperties: false, properties: { width: int(1, 4096), height: int(1, 4096), name: { type: "string", maxLength: 120 } } }, i => call("createProject", [i]), false, true),
    tool("set_active_tool", "Select an editor tool such as pencil, eraser, fill, line, rectangle, or eyedropper.", { type: "object", required: ["tool"], additionalProperties: false, properties: { tool: { type: "string", maxLength: 40 } } }, i => call("setActiveTool", [i.tool])),
    tool("set_primary_color", "Set the primary drawing color.", { type: "object", required: ["color"], additionalProperties: false, properties: { color: { type: "string", pattern: "^#[0-9a-fA-F]{6,8}$" } } }, i => call("setPrimaryColor", [i.color])),
    tool("draw_pixels", "Draw a batch of pixels atomically.", px, i => call("drawPixels", [i])),
    tool("clear_active_cel", "Clear all pixels in the active layer and frame.", noArgs, () => call("clearActiveCel"), false, true),
    ...(["addFrame", "duplicateFrame", "deleteFrame"] as const).map(m => tool(m.replace(/[A-Z]/g, x => `_${x.toLowerCase()}`), `${m} on the timeline.`, noArgs, () => call(m), false, m === "deleteFrame")),
    tool("set_active_frame", "Select a frame by index.", { type: "object", required: ["index"], additionalProperties: false, properties: { index: int(0, 10000) } }, i => call("setActiveFrame", [i.index])),
    tool("set_frame_duration", "Set active frame duration in milliseconds.", { type: "object", required: ["ms"], additionalProperties: false, properties: { ms: int(1, 600000) } }, i => call("setFrameDuration", [i.ms])),
    ...(["addLayer", "duplicateLayer", "deleteLayer", "toggleLayerVisibility"] as const).map(m => tool(m.replace(/[A-Z]/g, x => `_${x.toLowerCase()}`), `${m} in the layer stack.`, noArgs, () => call(m), false, m === "deleteLayer")),
    tool("rename_layer", "Rename the active layer.", { type: "object", required: ["name"], additionalProperties: false, properties: { name: { type: "string", minLength: 1, maxLength: 120 } } }, i => call("renameLayer", [i.name])),
    tool("set_layer_opacity", "Set active layer opacity from 0 to 100.", { type: "object", required: ["opacity"], additionalProperties: false, properties: { opacity: num(0, 100) } }, i => call("setLayerOpacity", [i.opacity])),
    tool("set_active_layer", "Select a layer by index.", { type: "object", required: ["index"], additionalProperties: false, properties: { index: int(0, 10000) } }, i => call("setActiveLayer", [i.index])),
    ...(["undo", "redo"] as const).map(m => tool(m, `${m} the latest edit.`, noArgs, () => call(m), false, m === "undo")),
    tool("set_zoom", "Set canvas zoom percentage.", { type: "object", required: ["zoom"], additionalProperties: false, properties: { zoom: num(1, 3200) } }, i => call("setZoom", [i.zoom])),
    ...(["toggleGrid", "toggleOnionSkin", "toggleSymmetry"] as const).map(m => tool(m.replace(/[A-Z]/g, x => `_${x.toLowerCase()}`), `Toggle ${m}.`, { type: "object", additionalProperties: false, properties: { enabled: bool } }, i => call(m, [i.enabled]))),
    tool("playback", "Control animation playback.", { type: "object", required: ["action"], additionalProperties: false, properties: { action: { type: "string", enum: ["play", "pause", "stop"] } } }, i => call("playback", [i.action])),
    ...(["png", "gif", "spritesheet", "project"] as const).map(format => tool(`export_${format}`, `Export the project as ${format}.`, { type: "object", additionalProperties: false, properties: { options: { type: "object", additionalProperties: true } } }, i => call("exportAsset", [format, i.options]), false, true)),
  ];
  tools.forEach(t => host.registerTool(t, { signal: abort.signal }));
  return () => abort.abort();
}
