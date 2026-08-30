"use client";

import * as React from "react";
import {
  Bot,
  ChevronDown,
  Download,
  FileImage,
  FileJson,
  FilePlus2,
  FolderOpen,
  Grid3X3,
  Keyboard,
  Layers3,
  Menu,
  Palette,
  Redo2,
  Save,
  Settings2,
  Sparkles,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { PixelCanvas, type CanvasPoint } from "./PixelCanvas";
import {
  ExportDialog,
  NewProjectDialog,
  ShortcutsDialog,
  WebMCPDialog,
  type ExportOptions,
  type WebMCPTool,
} from "./EditorDialogs";
import {
  LayerPanel,
  NavigatorPanel,
  OptionsPanel,
  PalettePanel,
  Timeline,
  ToolDock,
} from "./StudioParts";
import { usePixelEditor } from "@/hooks/use-pixel-editor";
import { celFor } from "@/lib/pixelforge/project";
import {
  adjacentFrameId,
  compositeFramePixels,
} from "@/lib/pixelforge/render";
import {
  downloadBlob,
  exportAnimatedGif,
  exportFramePng,
  exportFrameSequence,
  exportProjectJson,
  exportSpriteSheet,
  sanitizeFilename,
} from "@/lib/pixelforge/export";
import { importProjectJson, importRaster } from "@/lib/pixelforge/import";
import {
  ellipse as drawEllipse,
  floodFill,
  line as drawLine,
  rectangle as drawRectangle,
} from "@/lib/pixelforge/algorithms";
import {
  registerPixelForgeTools,
  type EditorAutomationApi,
  type ToolOutput,
} from "@/lib/pixelforge/webmcp";
import type { Anchor, PixelPatch, PixelProject, ToolId } from "@/lib/pixelforge/types";

const WEBMCP_TOOLS: WebMCPTool[] = [
  ["get_project_state", "Read project, frame, layer, and tool state"],
  ["create_project", "Create a pixel canvas"],
  ["import_project", "Restore a complete project object"],
  ["rename_project", "Rename the project"],
  ["resize_canvas", "Resize and anchor every cel"],
  ["set_active_tool", "Choose a drawing tool"],
  ["set_primary_color", "Set the drawing color"],
  ["set_secondary_color", "Set the background color"],
  ["set_brush_size", "Set the brush diameter"],
  ["load_palette", "Replace the active palette"],
  ["draw_pixels", "Write an atomic pixel batch"],
  ["apply_edit", "Draw a shape or flood fill"],
  ["clear_active_cel", "Clear the current cel"],
  ["set_selection", "Set or clear the marquee"],
  ["delete_selection", "Clear selected pixels"],
  ["add_frame", "Add an animation frame"],
  ["duplicate_frame", "Duplicate the active frame"],
  ["delete_frame", "Delete the active frame"],
  ["set_active_frame", "Select a frame"],
  ["set_frame_duration", "Change frame timing"],
  ["reorder_frame", "Move a frame in the timeline"],
  ["add_layer", "Add a layer"],
  ["duplicate_layer", "Duplicate the active layer"],
  ["delete_layer", "Delete the active layer"],
  ["rename_layer", "Rename the active layer"],
  ["toggle_layer_visibility", "Show or hide a layer"],
  ["lock_layer", "Lock or unlock a layer"],
  ["set_layer_opacity", "Change layer opacity"],
  ["set_active_layer", "Select a layer"],
  ["reorder_layer", "Move a layer in the stack"],
  ["undo", "Undo the latest edit"],
  ["redo", "Redo the latest edit"],
  ["set_zoom", "Change canvas zoom"],
  ["toggle_grid", "Show or hide the pixel grid"],
  ["toggle_onion_skin", "Show adjacent frames"],
  ["toggle_symmetry", "Mirror drawing"],
  ["playback", "Play, pause, or stop animation"],
  ["export_png", "Download the active frame"],
  ["export_gif", "Download an animated GIF"],
  ["export_spritesheet", "Download a sheet and metadata"],
  ["export_project", "Download the editable project"],
].map(([name, description]) => ({ name, description }));

function result(message: string, project?: PixelProject): ToolOutput {
  return {
    ok: true,
    message,
    projectId: project?.id ?? null,
    frameCount: project?.frames.length ?? null,
    layerCount: project?.layers.length ?? null,
  };
}

export function PixelForgeStudio() {
  const editor = usePixelEditor();
  const { project } = editor;
  const [newOpen, setNewOpen] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);
  const [webMcpOpen, setWebMcpOpen] = React.useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = React.useState(false);
  const [mobileTab, setMobileTab] = React.useState("layers");
  const [cursor, setCursor] = React.useState<CanvasPoint | null>(null);
  const [webMcpAvailable, setWebMcpAvailable] = React.useState(false);
  const [webMcpStatus, setWebMcpStatus] = React.useState("Not detected");
  const [webMcpRefreshKey, setWebMcpRefreshKey] = React.useState(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const previousToolRef = React.useRef<ToolId | null>(null);

  const activeLayer = project.layers.find(
    (layer) => layer.id === project.activeLayerId,
  );
  const activeCel = celFor(project, project.activeLayerId, project.activeFrameId);
  const currentPixels = React.useMemo(
    () => compositeFramePixels(project),
    [project],
  );
  const previousFrameId = adjacentFrameId(project, -1);
  const nextFrameId = adjacentFrameId(project, 1);
  const previousPixels = React.useMemo(
    () =>
      previousFrameId ? compositeFramePixels(project, previousFrameId) : null,
    [previousFrameId, project],
  );
  const nextPixels = React.useMemo(
    () => (nextFrameId ? compositeFramePixels(project, nextFrameId) : null),
    [nextFrameId, project],
  );

  const setPalette = (name: string, colors: string[]) => {
      const next = JSON.parse(JSON.stringify(editor.projectRef.current)) as PixelProject;
      next.palettes = [
        {
          id: "palette-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          name,
          colors: [...colors],
        },
      ];
      if (colors[0]) next.tool.color = colors[0];
      editor.replaceProject(next);
      toast.success(name + " palette loaded");
  };

  const downloadCurrentPng = async (scale = 1) => {
      const latest = editor.projectRef.current;
      const blob = await exportFramePng(latest, latest.activeFrameId, scale);
      downloadBlob(blob, sanitizeFilename(latest.name) + "-frame.png");
  };

  const downloadProject = () => {
    const latest = editor.projectRef.current;
    downloadBlob(
      exportProjectJson(latest),
      sanitizeFilename(latest.name) + ".pxforge",
    );
    toast.success("Editable project downloaded");
  };

  const downloadSheet = async (scale = 1, columns?: number, gap = 0) => {
      const latest = editor.projectRef.current;
      const output = await exportSpriteSheet(latest, {
        layout: "grid",
        columns,
        gap,
        scale,
      });
      const base = sanitizeFilename(latest.name);
      downloadBlob(output.png, base + "-sheet.png");
      window.setTimeout(
        () => downloadBlob(output.json, base + "-sheet.json"),
        120,
      );
  };

  const downloadGif = (scale = 1, loop = true) => {
      const latest = editor.projectRef.current;
      const blob = exportAnimatedGif(latest, {
        scale,
        loop: loop ? 0 : 1,
      });
      downloadBlob(blob, sanitizeFilename(latest.name) + ".gif");
  };

  const handleExport = async (options: ExportOptions) => {
      try {
        if (options.format === "gif") {
          downloadGif(options.scale, options.loop);
        } else {
          await downloadSheet(options.scale, options.columns, options.spacing);
        }
        setExportOpen(false);
        toast.success(options.format === "gif" ? "GIF exported" : "Sprite sheet exported");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Export failed");
      }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const isProject =
        file.name.endsWith(".pxforge") ||
        file.type === "application/json" ||
        file.name.endsWith(".json");
      const next = isProject
        ? importProjectJson(await file.text())
        : await importRaster(file, file.name.replace(/\.[^.]+$/, ""));
      editor.replaceProject(next);
      toast.success(isProject ? "Project opened" : "Image imported");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed");
    }
  };

  React.useEffect(() => {
    const deleteSelection = () => {
      const selection = editor.projectRef.current.selection;
      if (!selection) return;
      const latest = editor.projectRef.current;
      editor.dispatch({
        type: "pixels/clear-rect",
        layerId: latest.activeLayerId,
        frameId: latest.activeFrameId,
        selection,
      });
      editor.dispatch({ type: "selection/set", selection: null }, false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.matches("input, textarea, select") ||
        target?.isContentEditable
      ) {
        return;
      }
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) editor.redo();
        else editor.undo();
        return;
      }
      if (command && event.key.toLowerCase() === "y") {
        event.preventDefault();
        editor.redo();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        if (editor.projectRef.current.selection) {
          event.preventDefault();
          deleteSelection();
        }
        return;
      }
      if (event.key === "Escape") {
        editor.dispatch({ type: "selection/set", selection: null }, false);
        editor.setIsPlaying(false);
        return;
      }
      if (event.code === "Space" && !previousToolRef.current) {
        event.preventDefault();
        previousToolRef.current = editor.projectRef.current.tool.tool;
        editor.setTool("hand");
        return;
      }
      const tools: Record<string, ToolId> = {
        b: "pencil",
        e: "eraser",
        g: "fill",
        l: "line",
        r: "rectangle",
        o: "ellipse",
        i: "picker",
        m: "select",
        h: "hand",
      };
      const selected = tools[event.key.toLowerCase()];
      if (selected) {
        event.preventDefault();
        editor.setTool(selected);
      } else if (event.key === "[") {
        editor.setBrushSize(editor.projectRef.current.tool.size - 1);
      } else if (event.key === "]") {
        editor.setBrushSize(editor.projectRef.current.tool.size + 1);
      } else if (event.key === "+" || event.key === "=") {
        editor.setZoom(editor.zoom + 2);
      } else if (event.key === "-") {
        editor.setZoom(editor.zoom - 2);
      } else if (event.key === "0") {
        editor.setZoom(project.width <= 32 ? 16 : project.width <= 64 ? 8 : 4);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space" && previousToolRef.current) {
        editor.setTool(previousToolRef.current);
        previousToolRef.current = null;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [
    editor,
    project.width,
  ]);

  React.useEffect(() => {
    if (!editor.hydrated) return;
    let disposed = false;
    let unregister: (() => void) | null = null;
    let retryTimer: number | undefined;
    const projectRef = editor.projectRef;
    const summary = (message: string) => result(message, projectRef.current);
    const reject = (message: string): ToolOutput => ({ ok: false, message });
    const activeLayerFor = (latest = projectRef.current) =>
      latest.layers.find((layer) => layer.id === latest.activeLayerId);
    const assertExportActive = (signal?: AbortSignal) => {
      if (signal?.aborted) {
        throw new DOMException("The WebMCP export was cancelled.", "AbortError");
      }
    };
    const api: EditorAutomationApi = {
      getProjectState: ({ includePixels = false } = {}) => {
        const latest = projectRef.current;
        if (includePixels) {
          return JSON.parse(JSON.stringify(latest)) as ToolOutput;
        }
        return {
          id: latest.id,
          name: latest.name,
          width: latest.width,
          height: latest.height,
          activeLayerId: latest.activeLayerId,
          activeFrameId: latest.activeFrameId,
          tool: JSON.parse(JSON.stringify(latest.tool)) as ToolOutput,
          onionSkin: JSON.parse(JSON.stringify(latest.onionSkin)) as ToolOutput,
          symmetry: JSON.parse(JSON.stringify(latest.symmetry)) as ToolOutput,
          selection: latest.selection
            ? JSON.parse(JSON.stringify(latest.selection)) as ToolOutput
            : null,
          frames: latest.frames.map((frame) => ({
            id: frame.id,
            index: frame.index,
            duration: frame.duration,
          })),
          layers: latest.layers.map((layer) => ({
            id: layer.id,
            name: layer.name,
            visible: layer.visible,
            locked: layer.locked,
            opacity: layer.opacity,
          })),
          palettes: latest.palettes.map((palette) => ({
            id: palette.id,
            name: palette.name,
            colors: [...palette.colors],
          })),
        } as ToolOutput;
      },
      createProject: (input) => {
        const next = editor.newProject({
          name: input.name || "Agent sprite",
          width: input.width,
          height: input.height,
          transparent: true,
        });
        return result("Project created", next);
      },
      importProject: (value) => {
        const next = importProjectJson(value);
        editor.replaceProject(next);
        return result("Project imported", next);
      },
      renameProject: (name) => {
        editor.dispatch({ type: "project/rename", name });
        return summary("Project renamed");
      },
      resizeCanvas: (input) => {
        editor.dispatch({
          type: "canvas/resize",
          width: input.width,
          height: input.height,
          anchor: input.anchor as Anchor | undefined,
        });
        return summary("Canvas resized");
      },
      setActiveTool: (tool) => {
        const supported = [
          "pencil",
          "eraser",
          "fill",
          "line",
          "rectangle",
          "ellipse",
          "picker",
          "select",
          "hand",
        ] as ToolId[];
        if (!supported.includes(tool as ToolId)) {
          return { ok: false, message: "Unsupported tool" };
        }
        editor.setTool(tool as ToolId);
        return summary("Tool selected");
      },
      setPrimaryColor: (color) => {
        editor.setPrimaryColor(color);
        return summary("Primary color set");
      },
      setSecondaryColor: (color) => {
        editor.setSecondaryColor(color);
        return summary("Secondary color set");
      },
      setBrushSize: (size) => {
        editor.setBrushSize(size);
        return summary("Brush size set");
      },
      loadPalette: ({ name = "Agent palette", colors }) => {
        const next = JSON.parse(JSON.stringify(projectRef.current)) as PixelProject;
        next.palettes = [
          {
            id: "palette-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            name,
            colors: [...colors],
          },
        ];
        if (colors[0]) next.tool.color = colors[0];
        editor.replaceProject(next);
        return result("Palette loaded", next);
      },
      drawPixels: (input) => {
        if (activeLayerFor()?.locked) return reject("The active layer is locked");
        const fallback = projectRef.current.tool.color;
        editor.commitPixels(
          input.pixels.map((pixel) => ({
            x: pixel.x,
            y: pixel.y,
            color: pixel.color || input.color || fallback,
          })),
        );
        return summary("Pixels drawn");
      },
      applyEdit: (input) => {
        const latest = projectRef.current;
        if (activeLayerFor(latest)?.locked) {
          return reject("The active layer is locked");
        }
        const active = celFor(
          latest,
          latest.activeLayerId,
          latest.activeFrameId,
        );
        if (!active) return reject("The active cel is unavailable");
        if (
          input.start.x < 0 ||
          input.start.y < 0 ||
          input.start.x >= latest.width ||
          input.start.y >= latest.height
        ) {
          return reject("The start point is outside the canvas");
        }
        if (input.operation !== "fill" && !input.end) {
          return reject("This operation requires an end point");
        }

        const before = active.pixels;
        const after = [...before];
        const color = input.color || latest.tool.color;
        if (input.operation === "fill") {
          floodFill(after, latest.width, input.start.x, input.start.y, color);
        } else if (input.operation === "line") {
          drawLine(after, latest.width, input.start, input.end!, color);
        } else if (input.operation === "rectangle") {
          drawRectangle(
            after,
            latest.width,
            input.start,
            input.end!,
            color,
            input.filled === true,
          );
        } else {
          drawEllipse(
            after,
            latest.width,
            input.start,
            input.end!,
            color,
            input.filled === true,
          );
        }
        const patches: PixelPatch[] = [];
        for (let index = 0; index < after.length; index += 1) {
          if (after[index] === before[index]) continue;
          patches.push({
            x: index % latest.width,
            y: Math.floor(index / latest.width),
            color: after[index],
          });
        }
        editor.commitPixels(patches);
        return summary(
          patches.length ? `${input.operation} applied` : "No pixels changed",
        );
      },
      clearActiveCel: () => {
        const latest = projectRef.current;
        if (activeLayerFor(latest)?.locked) {
          return reject("The active layer is locked");
        }
        editor.dispatch({
          type: "cel/clear",
          layerId: latest.activeLayerId,
          frameId: latest.activeFrameId,
        });
        return summary("Cel cleared");
      },
      setSelection: (selection) => {
        const latest = projectRef.current;
        const normalized = selection
          ? {
              x: Math.max(0, Math.min(latest.width - 1, selection.x)),
              y: Math.max(0, Math.min(latest.height - 1, selection.y)),
              width: Math.max(
                1,
                Math.min(selection.width, latest.width - selection.x),
              ),
              height: Math.max(
                1,
                Math.min(selection.height, latest.height - selection.y),
              ),
            }
          : null;
        editor.dispatch({ type: "selection/set", selection: normalized }, false);
        return summary(normalized ? "Selection set" : "Selection cleared");
      },
      deleteSelection: () => {
        const latest = projectRef.current;
        if (!latest.selection) return reject("There is no active selection");
        if (activeLayerFor(latest)?.locked) {
          return reject("The active layer is locked");
        }
        editor.dispatch({
          type: "pixels/clear-rect",
          layerId: latest.activeLayerId,
          frameId: latest.activeFrameId,
          selection: latest.selection,
        });
        editor.dispatch({ type: "selection/set", selection: null }, false);
        return summary("Selected pixels cleared");
      },
      addFrame: () => {
        editor.dispatch({ type: "frame/add", duration: 130 });
        return summary("Frame added");
      },
      duplicateFrame: () => {
        editor.dispatch({
          type: "frame/duplicate",
          id: projectRef.current.activeFrameId,
        });
        return summary("Frame duplicated");
      },
      deleteFrame: () => {
        editor.dispatch({
          type: "frame/delete",
          id: projectRef.current.activeFrameId,
        });
        return summary("Frame deleted");
      },
      setActiveFrame: (index) => {
        const frame = projectRef.current.frames[index];
        if (!frame) return { ok: false, message: "Frame index is out of range" };
        editor.dispatch({ type: "active/set", frameId: frame.id }, false);
        return summary("Frame selected");
      },
      setFrameDuration: (ms) => {
        editor.dispatch({
          type: "frame/duration",
          id: projectRef.current.activeFrameId,
          duration: ms,
        });
        return summary("Frame duration set");
      },
      reorderFrame: (to) => {
        editor.dispatch({
          type: "frame/reorder",
          id: projectRef.current.activeFrameId,
          to,
        });
        return summary("Frame reordered");
      },
      addLayer: (name) => {
        editor.dispatch({ type: "layer/add", name });
        return summary("Layer added");
      },
      duplicateLayer: () => {
        editor.dispatch({
          type: "layer/duplicate",
          id: projectRef.current.activeLayerId,
        });
        return summary("Layer duplicated");
      },
      deleteLayer: () => {
        editor.dispatch({
          type: "layer/delete",
          id: projectRef.current.activeLayerId,
        });
        return summary("Layer deleted");
      },
      renameLayer: (name) => {
        editor.dispatch({
          type: "layer/rename",
          id: projectRef.current.activeLayerId,
          name,
        });
        return summary("Layer renamed");
      },
      toggleLayerVisibility: () => {
        editor.dispatch({
          type: "layer/visibility",
          id: projectRef.current.activeLayerId,
        });
        return summary("Layer visibility toggled");
      },
      lockLayer: (locked) => {
        editor.dispatch({
          type: "layer/lock",
          id: projectRef.current.activeLayerId,
          locked,
        });
        return summary("Layer lock updated");
      },
      setLayerOpacity: (opacity) => {
        editor.dispatch({
          type: "layer/opacity",
          id: projectRef.current.activeLayerId,
          opacity: opacity / 100,
        });
        return summary("Layer opacity set");
      },
      setActiveLayer: (index) => {
        const layer = projectRef.current.layers[index];
        if (!layer) return { ok: false, message: "Layer index is out of range" };
        editor.dispatch({ type: "active/set", layerId: layer.id }, false);
        return summary("Layer selected");
      },
      reorderLayer: (to) => {
        editor.dispatch({
          type: "layer/reorder",
          id: projectRef.current.activeLayerId,
          to,
        });
        return summary("Layer reordered");
      },
      undo: () => {
        editor.undo();
        return summary("Undo completed");
      },
      redo: () => {
        editor.redo();
        return summary("Redo completed");
      },
      setZoom: (value) => {
        editor.setZoom(value);
        return summary("Zoom set");
      },
      toggleGrid: (enabled) => {
        editor.setShowGrid(enabled ?? !editor.showGrid);
        return summary("Grid updated");
      },
      toggleOnionSkin: (enabled) => {
        editor.dispatch(
          {
            type: "onion/set",
            settings: {
              enabled: enabled ?? !projectRef.current.onionSkin.enabled,
            },
          },
          false,
        );
        return summary("Onion skin updated");
      },
      toggleSymmetry: (enabled) => {
        const value = enabled ?? !projectRef.current.symmetry.enabled;
        editor.dispatch(
          {
            type: "symmetry/set",
            settings: { enabled: value, x: value, y: value },
          },
          false,
        );
        return summary("Symmetry updated");
      },
      playback: (action) => {
        editor.setIsPlaying(action === "play");
        if (action === "stop") {
          const first = projectRef.current.frames[0];
          if (first) {
            editor.dispatch({ type: "active/set", frameId: first.id }, false);
          }
        }
        return summary("Playback " + action);
      },
      exportAsset: async (format, options, signal): Promise<ToolOutput> => {
        assertExportActive(signal);
        const latest = projectRef.current;
        const scale = Math.max(1, Math.floor(Number(options?.scale ?? 1)));
        const base = sanitizeFilename(latest.name);
        if (format === "png") {
          const blob = await exportFramePng(latest, latest.activeFrameId, scale);
          assertExportActive(signal);
          const filename = base + "-frame.png";
          downloadBlob(blob, filename);
          return {
            ok: true,
            message: "PNG export completed",
            filename,
            mime: blob.type || "image/png",
            size: blob.size,
          };
        }
        if (format === "gif") {
          const blob = exportAnimatedGif(latest, {
            scale,
            loop: options?.loop === false ? 1 : 0,
          });
          assertExportActive(signal);
          const filename = base + ".gif";
          downloadBlob(blob, filename);
          return {
            ok: true,
            message: "GIF export completed",
            filename,
            mime: blob.type || "image/gif",
            size: blob.size,
          };
        }
        if (format === "spritesheet") {
          const output = await exportSpriteSheet(latest, {
            layout:
              options?.layout === "horizontal" ||
              options?.layout === "vertical" ||
              options?.layout === "grid"
                ? options.layout
                : "grid",
            columns: Number(options?.columns || 0) || undefined,
            gap: Number(options?.gap || 0),
            scale,
          });
          assertExportActive(signal);
          const pngFilename = base + "-sheet.png";
          const jsonFilename = base + "-sheet.json";
          downloadBlob(output.png, pngFilename);
          window.setTimeout(() => {
            if (!signal?.aborted) downloadBlob(output.json, jsonFilename);
          }, 120);
          return {
            ok: true,
            message: "Sprite sheet export completed",
            pngFilename,
            jsonFilename,
            pngSize: output.png.size,
            jsonSize: output.json.size,
            frameCount: output.metadata.frames.length,
          };
        }
        const blob = exportProjectJson(latest);
        assertExportActive(signal);
        const filename = base + ".pxforge";
        downloadBlob(blob, filename);
        return {
          ok: true,
          message: "Project export completed",
          filename,
          mime: blob.type,
          size: blob.size,
        };
      },
    };
    const attemptRegistration = async (remainingAttempts: number) => {
      try {
        const cleanup = await registerPixelForgeTools(api, (message) => {
          if (!disposed) setWebMcpStatus(message);
        });
        if (disposed) {
          cleanup?.();
          return;
        }
        if (cleanup) {
          unregister = cleanup;
          setWebMcpAvailable(true);
          setWebMcpStatus("Tools registered");
          return;
        }
        setWebMcpAvailable(false);
        if (remainingAttempts > 0) {
          setWebMcpStatus("Waiting for a compatible WebMCP host");
          retryTimer = window.setTimeout(
            () => void attemptRegistration(remainingAttempts - 1),
            1500,
          );
        } else {
          setWebMcpStatus("No compatible WebMCP host detected");
        }
      } catch (error) {
        if (disposed) return;
        setWebMcpAvailable(false);
        setWebMcpStatus(
          error instanceof Error ? error.message : "WebMCP registration failed",
        );
        if (remainingAttempts > 0) {
          retryTimer = window.setTimeout(
            () => void attemptRegistration(remainingAttempts - 1),
            1500,
          );
        }
      }
    };

    void attemptRegistration(20);
    return () => {
      disposed = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      unregister?.();
    };
    // Register after local restoration and on an explicit status refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor.hydrated, webMcpRefreshKey]);

  const statusText = activeLayer?.locked
    ? "Layer locked"
    : editor.hydrated
      ? "Autosaved locally"
      : "Restoring project";

  return (
    <TooltipProvider delayDuration={180}>
      <main className="studio-shell flex flex-col text-[#eef2f8]">
        <header className="studio-panel z-20 flex h-13 shrink-0 items-center border-x-0 border-t-0 px-2 md:h-14 md:px-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid size-8 shrink-0 grid-cols-2 gap-[2px] rounded border border-[#b8f34a]/45 bg-[#b8f34a]/8 p-1.5">
              <span className="bg-[#b8f34a]" />
              <span className="bg-[#66d9ef]" />
              <span className="bg-[#ff9f68]" />
              <span className="bg-[#c792ea]" />
            </div>
            <div className="hidden leading-none sm:block">
              <p className="font-mono text-[11px] font-black tracking-[0.14em] text-white">
                PIXELFORGE
              </p>
              <p className="mt-1 text-[8px] uppercase tracking-[0.22em] text-[#69758a]">
                Studio
              </p>
            </div>
          </div>

          <div className="mx-2 hidden h-6 w-px bg-[#2b3446] sm:block" />
          <input
            value={project.name}
            onChange={(event) =>
              editor.dispatch(
                { type: "project/rename", name: event.target.value },
                false,
              )
            }
            onBlur={(event) =>
              editor.dispatch({
                type: "project/rename",
                name: event.target.value.trim() || "Untitled sprite",
              })
            }
            className="min-w-0 max-w-44 flex-1 rounded bg-transparent px-2 py-1 text-xs font-medium outline-none hover:bg-white/[.03] focus:bg-[#1a2030] sm:flex-none"
            aria-label="Project name"
          />
          <span className="hidden rounded border border-[#2e384b] bg-[#111722] px-2 py-1 font-mono text-[9px] text-[#8993a6] md:inline">
            {project.width}×{project.height}
          </span>

          <div className="ml-auto flex items-center gap-1">
            <ToolbarButton
              label="Undo"
              shortcut="Ctrl Z"
              disabled={!editor.canUndo}
              onClick={editor.undo}
            >
              <Undo2 />
            </ToolbarButton>
            <ToolbarButton
              label="Redo"
              shortcut="Ctrl Shift Z"
              disabled={!editor.canRedo}
              onClick={editor.redo}
            >
              <Redo2 />
            </ToolbarButton>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden text-xs sm:inline-flex"
                >
                  File <ChevronDown className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <FileMenu
                onNew={() => setNewOpen(true)}
                onOpen={() => fileInputRef.current?.click()}
                onProject={downloadProject}
                onPng={() => void downloadCurrentPng(1)}
                onSequence={async () => {
                  const latest = editor.projectRef.current;
                  const files = await exportFrameSequence(latest, 1);
                  files.forEach((blob, index) => {
                    window.setTimeout(
                      () =>
                        downloadBlob(
                          blob,
                          sanitizeFilename(latest.name) +
                            "-frame-" +
                            String(index + 1).padStart(2, "0") +
                            ".png",
                        ),
                      index * 100,
                    );
                  });
                }}
                onExport={() => setExportOpen(true)}
              />
            </DropdownMenu>

            <Button
              size="sm"
              className="h-8 bg-[#b8f34a] px-3 text-xs text-[#111608] hover:bg-[#c9ff62]"
              onClick={() => setExportOpen(true)}
            >
              <Download className="size-3.5" />
              <span className="hidden sm:inline">Export</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="More actions">
                  <Menu />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onSelect={() => setMobilePanelOpen(true)}>
                  <Settings2 /> Panels
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setShortcutsOpen(true)}>
                  <Keyboard /> Shortcuts
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setWebMcpOpen(true)}>
                  <Bot /> WebMCP
                  <span
                    className={
                      "ml-auto size-2 rounded-full " +
                      (webMcpAvailable ? "bg-emerald-400" : "bg-amber-400")
                    }
                  />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <aside className="studio-panel hidden shrink-0 border-y-0 border-l-0 md:flex">
            <ToolDock tool={project.tool.tool} onToolChange={editor.setTool} />
          </aside>

          <section className="flex min-w-0 flex-1 flex-col">
            <div className="studio-panel hidden h-10 shrink-0 items-center gap-3 border-x-0 border-t-0 px-3 md:flex">
              <span className="panel-label">{project.tool.tool}</span>
              <div className="h-4 w-px bg-[#2c3548]" />
              <label className="flex items-center gap-2 text-[10px] text-[#8993a6]">
                Size
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={project.tool.size}
                  onChange={(event) =>
                    editor.setBrushSize(Number(event.target.value))
                  }
                  className="h-6 w-12 rounded border border-[#30394c] bg-[#0e121a] px-1.5 font-mono text-white outline-none focus:border-[#b8f34a]"
                />
              </label>
              <label className="flex items-center gap-2 text-[10px] text-[#8993a6]">
                <span
                  className="size-5 rounded border border-white/20"
                  style={{ backgroundColor: project.tool.color }}
                />
                {project.tool.color.slice(0, 7)}
              </label>
              <span className="ml-auto flex items-center gap-2 text-[10px] text-[#69758a]">
                {project.onionSkin.enabled ? (
                  <>
                    <Sparkles className="size-3 text-[#66d9ef]" /> Onion
                  </>
                ) : null}
                {project.symmetry.x || project.symmetry.y ? (
                  <>
                    <span className="text-[#ff9f68]">◇</span> Symmetry
                  </>
                ) : null}
              </span>
            </div>

            <div className="studio-panel flex shrink-0 border-x-0 border-t-0 md:hidden">
              <ToolDock
                tool={project.tool.tool}
                onToolChange={editor.setTool}
                horizontal
              />
            </div>

            <div className="min-h-0 flex-1">
              <PixelCanvas
                width={project.width}
                height={project.height}
                pixels={currentPixels}
                previousPixels={previousPixels}
                nextPixels={nextPixels}
                zoom={editor.zoom}
                showGrid={editor.showGrid}
                onionSkin={project.onionSkin.enabled}
                tool={project.tool.tool}
                primaryColor={project.tool.color}
                secondaryColor={editor.secondaryColor}
                brushSize={project.tool.size}
                symmetryX={project.symmetry.enabled && project.symmetry.x}
                symmetryY={project.symmetry.enabled && project.symmetry.y}
                selection={project.selection}
                disabled={activeLayer?.locked || !activeCel}
                onCommit={(patches) => editor.commitPixels(patches)}
                onPickColor={editor.setPrimaryColor}
                onSelectionChange={(selection) =>
                  editor.dispatch(
                    { type: "selection/set", selection },
                    false,
                  )
                }
                onCursorChange={setCursor}
              />
            </div>
            <div className="flex h-7 shrink-0 items-center border-t border-[#252e3f] bg-[#0d1118] px-2 font-mono text-[9px] text-[#788398] sm:px-3">
              <span className="min-w-20">
                {cursor ? "X " + cursor.x + " · Y " + cursor.y : "X – · Y –"}
              </span>
              <span className="hidden sm:inline">
                {project.frames.findIndex(
                  (frame) => frame.id === project.activeFrameId,
                ) + 1}
                /{project.frames.length} frames
              </span>
              <span className="ml-auto hidden items-center gap-1.5 sm:flex">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                {statusText}
              </span>
              <span className="ml-auto sm:ml-4">{editor.zoom}×</span>
            </div>
          </section>

          <aside className="studio-panel hidden w-[278px] shrink-0 flex-col overflow-hidden border-y-0 border-r-0 xl:flex">
            <NavigatorPanel
              project={project}
              zoom={editor.zoom}
              onZoomChange={editor.setZoom}
              showGrid={editor.showGrid}
              onShowGridChange={editor.setShowGrid}
            />
            <PalettePanel
              project={project}
              primaryColor={project.tool.color}
              secondaryColor={editor.secondaryColor}
              onPrimaryColor={editor.setPrimaryColor}
              onSecondaryColor={editor.setSecondaryColor}
              onSetPalette={setPalette}
            />
            <LayerPanel project={project} dispatch={editor.dispatch} />
          </aside>
        </div>

        <Timeline
          project={project}
          dispatch={editor.dispatch}
          isPlaying={editor.isPlaying}
          onPlayingChange={editor.setIsPlaying}
        />

        <nav className="safe-bottom studio-panel flex h-[58px] shrink-0 items-center justify-around border-x-0 border-b-0 xl:hidden">
          <MobileNavButton
            label="Layers"
            onClick={() => {
              setMobileTab("layers");
              setMobilePanelOpen(true);
            }}
          >
            <Layers3 />
          </MobileNavButton>
          <MobileNavButton
            label="Palette"
            onClick={() => {
              setMobileTab("palette");
              setMobilePanelOpen(true);
            }}
          >
            <Palette />
          </MobileNavButton>
          <MobileNavButton
            label="Grid"
            active={editor.showGrid}
            onClick={() => editor.setShowGrid(!editor.showGrid)}
          >
            <Grid3X3 />
          </MobileNavButton>
          <MobileNavButton
            label="Zoom out"
            onClick={() => editor.setZoom(editor.zoom - 2)}
          >
            <ZoomOut />
          </MobileNavButton>
          <MobileNavButton
            label="Zoom in"
            onClick={() => editor.setZoom(editor.zoom + 2)}
          >
            <ZoomIn />
          </MobileNavButton>
        </nav>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pxforge,.json,image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => void handleImport(event)}
        />

        <NewProjectDialog
          open={newOpen}
          onOpenChange={setNewOpen}
          onCreate={(input) => {
            editor.newProject(input);
            setNewOpen(false);
            toast.success("New canvas created");
          }}
        />
        <ExportDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          frameCount={project.frames.length}
          projectName={project.name}
          onExport={(options) => void handleExport(options)}
        />
        <ShortcutsDialog
          open={shortcutsOpen}
          onOpenChange={setShortcutsOpen}
        />
        <WebMCPDialog
          open={webMcpOpen}
          onOpenChange={setWebMcpOpen}
          available={webMcpAvailable}
          status={webMcpStatus}
          tools={WEBMCP_TOOLS}
          onRefresh={() => {
            setWebMcpRefreshKey((key) => key + 1);
            toast.info("Checking for a compatible WebMCP host…");
          }}
        />

        <Sheet open={mobilePanelOpen} onOpenChange={setMobilePanelOpen}>
          <SheetContent
            side="bottom"
            className="mobile-modal-panel border-[#344057] bg-[#11151f] p-0 text-white"
          >
            <SheetHeader className="border-b border-[#2a3345]">
              <SheetTitle className="font-mono text-sm">Studio panels</SheetTitle>
              <SheetDescription className="text-xs">
                Layers, palette, navigator, and drawing options
              </SheetDescription>
            </SheetHeader>
            <Tabs
              value={mobileTab}
              onValueChange={setMobileTab}
              className="min-h-0 flex-1 gap-0"
            >
              <TabsList className="mx-4 mt-3 grid w-auto grid-cols-4 bg-[#0c1018]">
                <TabsTrigger value="layers">Layers</TabsTrigger>
                <TabsTrigger value="palette">Colors</TabsTrigger>
                <TabsTrigger value="options">Options</TabsTrigger>
                <TabsTrigger value="nav">View</TabsTrigger>
              </TabsList>
              <TabsContent value="layers" className="min-h-[330px] overflow-y-auto">
                <LayerPanel project={project} dispatch={editor.dispatch} />
              </TabsContent>
              <TabsContent value="palette" className="min-h-[330px] overflow-y-auto">
                <PalettePanel
                  project={project}
                  primaryColor={project.tool.color}
                  secondaryColor={editor.secondaryColor}
                  onPrimaryColor={editor.setPrimaryColor}
                  onSecondaryColor={editor.setSecondaryColor}
                  onSetPalette={setPalette}
                />
              </TabsContent>
              <TabsContent value="options" className="min-h-[330px] overflow-y-auto">
                <OptionsPanel
                  project={project}
                  brushSize={project.tool.size}
                  onBrushSize={editor.setBrushSize}
                  dispatch={editor.dispatch}
                />
              </TabsContent>
              <TabsContent value="nav" className="min-h-[330px] overflow-y-auto">
                <NavigatorPanel
                  project={project}
                  zoom={editor.zoom}
                  onZoomChange={editor.setZoom}
                  showGrid={editor.showGrid}
                  onShowGridChange={editor.setShowGrid}
                />
              </TabsContent>
            </Tabs>
          </SheetContent>
        </Sheet>
        <Toaster position="top-center" richColors />
      </main>
    </TooltipProvider>
  );
}

function ToolbarButton({
  label,
  shortcut,
  children,
  ...props
}: React.ComponentProps<typeof Button> & {
  label: string;
  shortcut?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={7}>
        {label}
        {shortcut ? <span className="ml-2 opacity-60">{shortcut}</span> : null}
      </TooltipContent>
    </Tooltip>
  );
}

function MobileNavButton({
  label,
  active,
  children,
  ...props
}: React.ComponentProps<"button"> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      className={
        "flex min-h-11 min-w-12 flex-col items-center justify-center gap-1 rounded text-[9px] " +
        (active ? "text-[#b8f34a]" : "text-[#8d98aa]")
      }
      aria-label={label}
      aria-pressed={active}
      {...props}
    >
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<{ className?: string }>, {
            className: "size-[18px]",
          })
        : children}
      <span>{label}</span>
    </button>
  );
}

function FileMenu({
  onNew,
  onOpen,
  onProject,
  onPng,
  onSequence,
  onExport,
}: {
  onNew: () => void;
  onOpen: () => void;
  onProject: () => void;
  onPng: () => void;
  onSequence: () => void;
  onExport: () => void;
}) {
  return (
    <DropdownMenuContent align="end" className="w-60">
      <DropdownMenuLabel>Project</DropdownMenuLabel>
      <DropdownMenuItem onSelect={onNew}>
        <FilePlus2 /> New project
        <DropdownMenuShortcut>Ctrl N</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={onOpen}>
        <FolderOpen /> Open project or image
        <DropdownMenuShortcut>Ctrl O</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={onProject}>
        <Save /> Save editable project
        <DropdownMenuShortcut>.pxforge</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>Quick export</DropdownMenuLabel>
      <DropdownMenuItem onSelect={onPng}>
        <FileImage /> Current frame PNG
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={onSequence}>
        <FileJson /> PNG frame sequence
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={onExport}>
        <Download /> Export options
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}
