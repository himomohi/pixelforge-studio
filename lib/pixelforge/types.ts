export type Pixel = string;
export type Pixels = Pixel[];

export type Anchor =
  | "top-left"
  | "top"
  | "top-right"
  | "left"
  | "center"
  | "right"
  | "bottom-left"
  | "bottom"
  | "bottom-right";

export interface Cel {
  id: string;
  frameId: string;
  layerId: string;
  pixels: Pixels;
  duration: number;
}

export interface Frame {
  id: string;
  index: number;
  duration: number;
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  frameIds: string[];
}

export interface Palette {
  id: string;
  name: string;
  colors: string[];
}

export type ToolId =
  | "pencil"
  | "eraser"
  | "line"
  | "rectangle"
  | "ellipse"
  | "fill"
  | "picker"
  | "select"
  | "hand";

export interface ToolSettings {
  tool: ToolId;
  color: string;
  size: number;
  fill: boolean;
}

export interface OnionSkin {
  enabled: boolean;
  previous: number;
  next: number;
  opacity: number;
}

export interface Symmetry {
  enabled: boolean;
  x: boolean;
  y: boolean;
  centerX: number;
  centerY: number;
}

export type Selection = {
  x: number;
  y: number;
  width: number;
  height: number;
} | null;

export interface PixelProject {
  version: 1;
  id: string;
  name: string;
  width: number;
  height: number;
  layers: Layer[];
  frames: Frame[];
  cels: Record<string, Cel>;
  palettes: Palette[];
  activeLayerId: string;
  activeFrameId: string;
  tool: ToolSettings;
  onionSkin: OnionSkin;
  symmetry: Symmetry;
  selection: Selection;
}

/** Compatibility name used by persistence, import, and export modules. */
export type Project = PixelProject;

export interface PixelPatch {
  x: number;
  y: number;
  color: Pixel;
}

export type ProjectAction =
  | { type: "project/replace"; project: PixelProject }
  | { type: "project/rename"; name: string }
  | { type: "layer/add"; name?: string }
  | { type: "layer/duplicate"; id: string }
  | { type: "layer/delete"; id: string }
  | { type: "layer/reorder"; id: string; to: number }
  | { type: "layer/rename"; id: string; name: string }
  | { type: "layer/visibility"; id: string; visible?: boolean }
  | { type: "layer/lock"; id: string; locked?: boolean }
  | { type: "layer/opacity"; id: string; opacity: number }
  | { type: "frame/add"; duration?: number }
  | { type: "frame/duplicate"; id: string }
  | { type: "frame/delete"; id: string }
  | { type: "frame/reorder"; id: string; to: number }
  | { type: "frame/duration"; id: string; duration: number }
  | { type: "pixels/patch"; layerId: string; frameId: string; patches: PixelPatch[] }
  | { type: "cel/clear"; layerId: string; frameId: string }
  | { type: "canvas/resize"; width: number; height: number; anchor?: Anchor }
  | { type: "selection/set"; selection: Selection }
  | { type: "tool/set"; settings: Partial<ToolSettings> }
  | { type: "onion/set"; settings: Partial<OnionSkin> }
  | { type: "symmetry/set"; settings: Partial<Symmetry> }
  | { type: "active/set"; layerId?: string; frameId?: string };
