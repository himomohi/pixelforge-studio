"use client";

import * as React from "react";
import {
  Circle,
  Copy,
  Eraser,
  Eye,
  EyeOff,
  FlipHorizontal2,
  FlipVertical2,
  Grid3X3,
  Hand,
  Layers3,
  Lock,
  Minus,
  PaintBucket,
  Palette,
  Pause,
  Pencil,
  Pipette,
  Play,
  Plus,
  Scan,
  Square,
  Trash2,
  Unlock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { celFor } from "@/lib/pixelforge/project";
import { compositeFrameRgba, parsePixel } from "@/lib/pixelforge/render";
import { curatedPalettes } from "@/lib/pixelforge/palettes";
import type {
  Layer,
  PixelProject,
  ProjectAction,
  ToolId,
} from "@/lib/pixelforge/types";

export const TOOL_ITEMS: Array<{
  id: ToolId;
  label: string;
  key: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "pencil", label: "Pencil", key: "B", icon: Pencil },
  { id: "eraser", label: "Eraser", key: "E", icon: Eraser },
  { id: "fill", label: "Flood fill", key: "G", icon: PaintBucket },
  { id: "line", label: "Line", key: "L", icon: Minus },
  { id: "rectangle", label: "Rectangle", key: "R", icon: Square },
  { id: "ellipse", label: "Ellipse", key: "O", icon: Circle },
  { id: "picker", label: "Eyedropper", key: "I", icon: Pipette },
  { id: "select", label: "Marquee", key: "M", icon: Scan },
  { id: "hand", label: "Pan canvas", key: "H", icon: Hand },
];

export function ToolDock({
  tool,
  onToolChange,
  horizontal = false,
}: {
  tool: ToolId;
  onToolChange: (tool: ToolId) => void;
  horizontal?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex gap-1",
        horizontal
          ? "pixel-scrollbar w-full flex-row overflow-x-auto px-2 py-1.5"
          : "w-14 flex-col items-center border-r border-[#252d3d] px-1.5 py-2",
      )}
      aria-label="Drawing tools"
    >
      {TOOL_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <Tooltip key={item.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="tool-button shrink-0"
                data-active={tool === item.id}
                aria-label={item.label}
                aria-pressed={tool === item.id}
                onClick={() => onToolChange(item.id)}
              >
                <Icon className="size-[18px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side={horizontal ? "top" : "right"} sideOffset={8}>
              <span>{item.label}</span>
              <span className="ml-2 opacity-60">{item.key}</span>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

function MiniCanvas({
  width,
  height,
  rgba,
  pixels,
  className,
}: {
  width: number;
  height: number;
  rgba?: Uint8ClampedArray;
  pixels?: string[];
  className?: string;
}) {
  const ref = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.imageSmoothingEnabled = false;
    const data = rgba ?? new Uint8ClampedArray(width * height * 4);
    if (!rgba && pixels) {
      pixels.forEach((color, index) => {
        const [red, green, blue, alpha] = parsePixel(color);
        const offset = index * 4;
        data[offset] = red;
        data[offset + 1] = green;
        data[offset + 2] = blue;
        data[offset + 3] = alpha;
      });
    }
    context.putImageData(
      new ImageData(new Uint8ClampedArray(data), width, height),
      0,
      0,
    );
  }, [height, pixels, rgba, width]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={cn("pixel-canvas object-contain", className)}
    />
  );
}

export function NavigatorPanel({
  project,
  zoom,
  onZoomChange,
  showGrid,
  onShowGridChange,
}: {
  project: PixelProject;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  showGrid: boolean;
  onShowGridChange: (enabled: boolean) => void;
}) {
  const rgba = React.useMemo(() => compositeFrameRgba(project), [project]);
  return (
    <section className="border-b border-[#262f40] p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="panel-label">Navigator</p>
        <span className="font-mono text-[10px] text-[#79849a]">
          {project.width}×{project.height}
        </span>
      </div>
      <div className="pixel-checker flex h-28 items-center justify-center overflow-hidden rounded border border-[#303a4e] p-2">
        <MiniCanvas
          width={project.width}
          height={project.height}
          rgba={rgba}
          className="max-h-full max-w-full"
        />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="w-9 font-mono text-[10px] text-[#8993a6]">{zoom}×</span>
        <Slider
          value={[zoom]}
          min={2}
          max={32}
          step={1}
          onValueChange={(values) => onZoomChange(values[0] ?? zoom)}
          aria-label="Canvas zoom"
        />
        <button
          type="button"
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded border",
            showGrid
              ? "border-[#b8f34a]/50 bg-[#b8f34a]/10 text-[#b8f34a]"
              : "border-[#303a4e] text-[#8993a6]",
          )}
          onClick={() => onShowGridChange(!showGrid)}
          aria-label="Toggle grid"
          aria-pressed={showGrid}
        >
          <Grid3X3 className="size-4" />
        </button>
      </div>
    </section>
  );
}

export function PalettePanel({
  project,
  primaryColor,
  secondaryColor,
  onPrimaryColor,
  onSecondaryColor,
  onSetPalette,
}: {
  project: PixelProject;
  primaryColor: string;
  secondaryColor: string;
  onPrimaryColor: (color: string) => void;
  onSecondaryColor: (color: string) => void;
  onSetPalette: (name: string, colors: string[]) => void;
}) {
  const activePalette = project.palettes[0] ?? {
    name: "PICO-8",
    colors: curatedPalettes["PICO-8"],
  };
  return (
    <section className="border-b border-[#262f40] p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="panel-label">Color & palette</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="xs"
              className="h-6 font-mono text-[10px] text-[#aeb7c8]"
            >
              {activePalette.name}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>Palette presets</DropdownMenuLabel>
            {Object.entries(curatedPalettes).map(([name, colors]) => (
              <DropdownMenuItem
                key={name}
                onSelect={() => onSetPalette(name, colors)}
              >
                <span
                  className="size-3 rounded-sm"
                  style={{ backgroundColor: colors[0] }}
                />
                {name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <label className="flex min-w-0 items-center gap-2 rounded border border-[#303a4e] bg-[#0d1119] p-2">
          <input
            type="color"
            value={primaryColor.slice(0, 7)}
            onChange={(event) => onPrimaryColor(event.target.value)}
            className="size-8 shrink-0 cursor-pointer border-0 bg-transparent p-0"
            aria-label="Primary color"
          />
          <span className="min-w-0">
            <span className="block text-[9px] uppercase tracking-widest text-[#69758a]">
              Fore
            </span>
            <span className="block truncate font-mono text-[10px] text-[#cbd2df]">
              {primaryColor.slice(0, 7)}
            </span>
          </span>
        </label>
        <label className="flex min-w-0 items-center gap-2 rounded border border-[#303a4e] bg-[#0d1119] p-2">
          <input
            type="color"
            value={secondaryColor.slice(0, 7)}
            onChange={(event) => onSecondaryColor(event.target.value)}
            className="size-8 shrink-0 cursor-pointer border-0 bg-transparent p-0"
            aria-label="Secondary color"
          />
          <span className="min-w-0">
            <span className="block text-[9px] uppercase tracking-widest text-[#69758a]">
              Back
            </span>
            <span className="block truncate font-mono text-[10px] text-[#cbd2df]">
              {secondaryColor.slice(0, 7)}
            </span>
          </span>
        </label>
      </div>
      <div className="grid grid-cols-8 gap-1.5" aria-label={activePalette.name}>
        {activePalette.colors.map((color, index) => (
          <button
            key={color + "-" + index}
            type="button"
            className={cn(
              "aspect-square min-h-6 rounded-[3px] border shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)] transition-transform hover:z-10 hover:scale-125",
              primaryColor.toLowerCase() === color.toLowerCase()
                ? "border-white ring-1 ring-[#b8f34a]"
                : "border-black/30",
            )}
            style={{ backgroundColor: color }}
            title={color + " · click foreground / right-click background"}
            aria-label={"Set color " + color}
            onClick={() => onPrimaryColor(color)}
            onContextMenu={(event) => {
              event.preventDefault();
              onSecondaryColor(color);
            }}
          />
        ))}
      </div>
      <p className="mt-2 text-[10px] text-[#69758a]">
        Click: foreground · right-click: background
      </p>
    </section>
  );
}

export function LayerPanel({
  project,
  dispatch,
}: {
  project: PixelProject;
  dispatch: (action: ProjectAction, record?: boolean) => void;
}) {
  const activeLayer = project.layers.find(
    (layer) => layer.id === project.activeLayerId,
  );
  const visibleLayers = [...project.layers].reverse();

  const moveLayer = (layer: Layer, direction: -1 | 1) => {
    const index = project.layers.findIndex((item) => item.id === layer.id);
    dispatch({
      type: "layer/reorder",
      id: layer.id,
      to: Math.max(0, Math.min(project.layers.length - 1, index + direction)),
    });
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="panel-label">Layers</p>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => dispatch({ type: "layer/add" })}
            aria-label="Add layer"
          >
            <Plus />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={!activeLayer}
            onClick={() =>
              activeLayer &&
              dispatch({ type: "layer/duplicate", id: activeLayer.id })
            }
            aria-label="Duplicate layer"
          >
            <Copy />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={!activeLayer || project.layers.length === 1}
            onClick={() =>
              activeLayer && dispatch({ type: "layer/delete", id: activeLayer.id })
            }
            aria-label="Delete layer"
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      <div className="pixel-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {visibleLayers.map((layer) => {
          const active = layer.id === project.activeLayerId;
          const cel = celFor(project, layer.id, project.activeFrameId);
          return (
            <div
              key={layer.id}
              className={cn(
                "group flex items-center gap-1.5 rounded border p-1.5 transition-colors",
                active
                  ? "border-[#b8f34a]/50 bg-[#b8f34a]/8"
                  : "border-transparent hover:border-[#2c3548] hover:bg-[#171d29]",
              )}
            >
              <button
                type="button"
                className="flex size-7 shrink-0 items-center justify-center text-[#7f8a9d] hover:text-white"
                onClick={() =>
                  dispatch({ type: "layer/visibility", id: layer.id }, false)
                }
                aria-label={layer.visible ? "Hide layer" : "Show layer"}
              >
                {layer.visible ? (
                  <Eye className="size-3.5" />
                ) : (
                  <EyeOff className="size-3.5" />
                )}
              </button>
              <button
                type="button"
                className="pixel-checker flex size-9 shrink-0 items-center justify-center overflow-hidden rounded border border-[#303a4e]"
                onClick={() =>
                  dispatch({ type: "active/set", layerId: layer.id }, false)
                }
                aria-label={"Select " + layer.name}
              >
                {cel ? (
                  <MiniCanvas
                    width={project.width}
                    height={project.height}
                    pixels={cel.pixels}
                    className="size-8"
                  />
                ) : null}
              </button>
              <input
                value={layer.name}
                onFocus={() =>
                  dispatch({ type: "active/set", layerId: layer.id }, false)
                }
                onChange={(event) =>
                  dispatch(
                    {
                      type: "layer/rename",
                      id: layer.id,
                      name: event.target.value,
                    },
                    false,
                  )
                }
                onBlur={(event) =>
                  dispatch({
                    type: "layer/rename",
                    id: layer.id,
                    name: event.target.value.trim() || "Layer",
                  })
                }
                className="min-w-0 flex-1 bg-transparent text-xs text-[#d7dde8] outline-none"
                aria-label="Layer name"
              />
              <button
                type="button"
                className="flex size-7 shrink-0 items-center justify-center text-[#677287] hover:text-white"
                onClick={() =>
                  dispatch({ type: "layer/lock", id: layer.id }, false)
                }
                aria-label={layer.locked ? "Unlock layer" : "Lock layer"}
              >
                {layer.locked ? (
                  <Lock className="size-3.5" />
                ) : (
                  <Unlock className="size-3.5" />
                )}
              </button>
              <div className="hidden gap-0.5 group-hover:flex">
                <button
                  type="button"
                  className="text-[10px] text-[#667287] hover:text-white"
                  onClick={() => moveLayer(layer, 1)}
                  aria-label="Move layer up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="text-[10px] text-[#667287] hover:text-white"
                  onClick={() => moveLayer(layer, -1)}
                  aria-label="Move layer down"
                >
                  ↓
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {activeLayer ? (
        <div className="mt-3 border-t border-[#262f40] pt-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="panel-label">Opacity</span>
            <span className="font-mono text-[10px] text-[#9aa5b7]">
              {Math.round(activeLayer.opacity * 100)}%
            </span>
          </div>
          <Slider
            value={[Math.round(activeLayer.opacity * 100)]}
            min={0}
            max={100}
            step={1}
            onValueChange={(values) =>
              dispatch(
                {
                  type: "layer/opacity",
                  id: activeLayer.id,
                  opacity: (values[0] ?? 100) / 100,
                },
                false,
              )
            }
            onValueCommit={(values) =>
              dispatch({
                type: "layer/opacity",
                id: activeLayer.id,
                opacity: (values[0] ?? 100) / 100,
              })
            }
            aria-label="Layer opacity"
          />
        </div>
      ) : null}
    </section>
  );
}

export function OptionsPanel({
  project,
  brushSize,
  onBrushSize,
  dispatch,
}: {
  project: PixelProject;
  brushSize: number;
  onBrushSize: (value: number) => void;
  dispatch: (action: ProjectAction, record?: boolean) => void;
}) {
  return (
    <section className="space-y-4 p-3">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="panel-label">Brush size</span>
          <span className="font-mono text-[10px]">{brushSize}px</span>
        </div>
        <Slider
          value={[brushSize]}
          min={1}
          max={8}
          step={1}
          onValueChange={(values) => onBrushSize(values[0] ?? brushSize)}
          aria-label="Brush size"
        />
      </div>
      <div className="space-y-2">
        <div className="flex min-h-10 items-center justify-between rounded border border-[#2d374a] bg-[#0e131c] px-3">
          <span className="flex items-center gap-2 text-xs">
            <Layers3 className="size-3.5 text-[#66d9ef]" />
            Onion skin
          </span>
          <Switch
            checked={project.onionSkin.enabled}
            onCheckedChange={(enabled) =>
              dispatch({ type: "onion/set", settings: { enabled } }, false)
            }
          />
        </div>
        <div className="flex min-h-10 items-center justify-between rounded border border-[#2d374a] bg-[#0e131c] px-3">
          <span className="flex items-center gap-2 text-xs">
            <FlipHorizontal2 className="size-3.5 text-[#ff9f68]" />
            Mirror X
          </span>
          <Switch
            checked={project.symmetry.x}
            onCheckedChange={(x) =>
              dispatch(
                {
                  type: "symmetry/set",
                  settings: { enabled: x || project.symmetry.y, x },
                },
                false,
              )
            }
          />
        </div>
        <div className="flex min-h-10 items-center justify-between rounded border border-[#2d374a] bg-[#0e131c] px-3">
          <span className="flex items-center gap-2 text-xs">
            <FlipVertical2 className="size-3.5 text-[#c792ea]" />
            Mirror Y
          </span>
          <Switch
            checked={project.symmetry.y}
            onCheckedChange={(y) =>
              dispatch(
                {
                  type: "symmetry/set",
                  settings: { enabled: y || project.symmetry.x, y },
                },
                false,
              )
            }
          />
        </div>
      </div>
    </section>
  );
}

export function Timeline({
  project,
  dispatch,
  isPlaying,
  onPlayingChange,
}: {
  project: PixelProject;
  dispatch: (action: ProjectAction, record?: boolean) => void;
  isPlaying: boolean;
  onPlayingChange: (playing: boolean) => void;
}) {
  const activeFrame = project.frames.find(
    (frame) => frame.id === project.activeFrameId,
  );
  return (
    <section className="studio-panel flex h-[132px] shrink-0 flex-col border-x-0 border-b-0 md:h-[164px]">
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-[#273044] px-2">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => onPlayingChange(!isPlaying)}
          aria-label={isPlaying ? "Pause animation" : "Play animation"}
        >
          {isPlaying ? <Pause /> : <Play />}
        </Button>
        <div className="mx-1 h-4 w-px bg-[#30394c]" />
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => dispatch({ type: "frame/add", duration: 130 })}
          aria-label="Add frame"
        >
          <Plus />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={!activeFrame}
          onClick={() =>
            activeFrame &&
            dispatch({ type: "frame/duplicate", id: activeFrame.id })
          }
          aria-label="Duplicate frame"
        >
          <Copy />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={!activeFrame || project.frames.length === 1}
          onClick={() =>
            activeFrame &&
            dispatch({ type: "frame/delete", id: activeFrame.id })
          }
          aria-label="Delete frame"
        >
          <Trash2 />
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <label
            htmlFor="frame-duration"
            className="hidden text-[10px] text-[#778398] sm:block"
          >
            Duration
          </label>
          <input
            id="frame-duration"
            type="number"
            min={20}
            max={10000}
            step={10}
            value={activeFrame?.duration ?? 100}
            onChange={(event) =>
              activeFrame &&
              dispatch(
                {
                  type: "frame/duration",
                  id: activeFrame.id,
                  duration: Number(event.target.value),
                },
                false,
              )
            }
            onBlur={(event) =>
              activeFrame &&
              dispatch({
                type: "frame/duration",
                id: activeFrame.id,
                duration: Math.max(20, Number(event.target.value)),
              })
            }
            className="h-6 w-16 rounded border border-[#30394c] bg-[#0d1119] px-1.5 font-mono text-[10px] outline-none focus:border-[#b8f34a]"
          />
          <span className="text-[10px] text-[#69758a]">ms</span>
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-36 shrink-0 border-r border-[#273044] p-2 md:block">
          <p className="panel-label mb-2">Timeline</p>
          <div className="flex items-center gap-2 text-xs text-[#cbd2df]">
            <Palette className="size-3.5 text-[#b8f34a]" />
            {project.layers.find((layer) => layer.id === project.activeLayerId)?.name ??
              "Layer"}
          </div>
        </div>
        <div className="pixel-scrollbar flex min-w-0 flex-1 items-start gap-2 overflow-x-auto p-2">
          {project.frames.map((frame, index) => {
            const active = frame.id === project.activeFrameId;
            const rgba = compositeFrameRgba(project, frame.id);
            return (
              <button
                type="button"
                key={frame.id}
                className="group shrink-0 text-left"
                onClick={() =>
                  dispatch({ type: "active/set", frameId: frame.id }, false)
                }
                aria-label={"Select frame " + (index + 1)}
                aria-pressed={active}
              >
                <span
                  className="timeline-cell pixel-checker relative flex items-center justify-center overflow-hidden"
                  data-active={active}
                >
                  <MiniCanvas
                    width={project.width}
                    height={project.height}
                    rgba={rgba}
                    className="size-10"
                  />
                  <span className="absolute left-1 top-0.5 rounded bg-black/55 px-1 font-mono text-[8px] text-white">
                    {index + 1}
                  </span>
                </span>
                <span
                  className={cn(
                    "mt-1 block text-center font-mono text-[9px]",
                    active ? "text-[#b8f34a]" : "text-[#69758a]",
                  )}
                >
                  {frame.duration}ms
                </span>
              </button>
            );
          })}
          <button
            type="button"
            className="timeline-cell flex shrink-0 items-center justify-center border-dashed text-[#667287] hover:border-[#b8f34a]/50 hover:text-[#b8f34a]"
            onClick={() => dispatch({ type: "frame/add", duration: 130 })}
            aria-label="Add frame"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
