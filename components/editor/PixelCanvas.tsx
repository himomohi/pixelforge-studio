"use client";

import * as React from "react";

export type CanvasPoint = { x: number; y: number };
export type PixelPatch = CanvasPoint & { color: string };
export type SelectionRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CanvasTool =
  | "pencil"
  | "eraser"
  | "fill"
  | "line"
  | "rectangle"
  | "ellipse"
  | "picker"
  | "select"
  | "hand";

type PixelCanvasProps = {
  width: number;
  height: number;
  pixels: string[];
  previousPixels?: string[] | null;
  nextPixels?: string[] | null;
  zoom: number;
  showGrid: boolean;
  onionSkin: boolean;
  tool: CanvasTool;
  primaryColor: string;
  secondaryColor: string;
  brushSize: number;
  symmetryX: boolean;
  symmetryY: boolean;
  selection?: SelectionRect | null;
  disabled?: boolean;
  onCommit: (patches: PixelPatch[], label: string) => void;
  onPickColor: (color: string) => void;
  onSelectionChange?: (selection: SelectionRect | null) => void;
  onCursorChange?: (point: CanvasPoint | null) => void;
};

type Gesture = {
  pointerId: number;
  start: CanvasPoint;
  last: CanvasPoint;
  color: string;
  button: number;
  panOrigin?: { x: number; y: number; left: number; top: number };
};

function parseHex(color: string): [number, number, number, number] {
  if (!color) return [0, 0, 0, 0];
  const raw = color.startsWith("#") ? color.slice(1) : color;
  if (raw.length === 3 || raw.length === 4) {
    const values = raw.split("").map((part) => Number.parseInt(part + part, 16));
    return [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0, values[3] ?? 255];
  }
  if (raw.length === 6 || raw.length === 8) {
    return [
      Number.parseInt(raw.slice(0, 2), 16),
      Number.parseInt(raw.slice(2, 4), 16),
      Number.parseInt(raw.slice(4, 6), 16),
      raw.length === 8 ? Number.parseInt(raw.slice(6, 8), 16) : 255,
    ];
  }
  return [0, 0, 0, 255];
}

function blendPixel(
  target: Uint8ClampedArray,
  offset: number,
  source: [number, number, number, number],
) {
  const alpha = source[3] / 255;
  const inverse = 1 - alpha;
  target[offset] = Math.round(source[0] * alpha + target[offset] * inverse);
  target[offset + 1] = Math.round(source[1] * alpha + target[offset + 1] * inverse);
  target[offset + 2] = Math.round(source[2] * alpha + target[offset + 2] * inverse);
  target[offset + 3] = Math.round((alpha + (target[offset + 3] / 255) * inverse) * 255);
}

function rasterLine(start: CanvasPoint, end: CanvasPoint): CanvasPoint[] {
  const points: CanvasPoint[] = [];
  let x = start.x;
  let y = start.y;
  const dx = Math.abs(end.x - start.x);
  const sx = start.x < end.x ? 1 : -1;
  const dy = -Math.abs(end.y - start.y);
  const sy = start.y < end.y ? 1 : -1;
  let error = dx + dy;

  while (true) {
    points.push({ x, y });
    if (x === end.x && y === end.y) break;
    const doubled = error * 2;
    if (doubled >= dy) {
      error += dy;
      x += sx;
    }
    if (doubled <= dx) {
      error += dx;
      y += sy;
    }
  }
  return points;
}

function rasterRectangle(start: CanvasPoint, end: CanvasPoint): CanvasPoint[] {
  const left = Math.min(start.x, end.x);
  const right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const bottom = Math.max(start.y, end.y);
  const points: CanvasPoint[] = [];
  for (let x = left; x <= right; x += 1) {
    points.push({ x, y: top }, { x, y: bottom });
  }
  for (let y = top + 1; y < bottom; y += 1) {
    points.push({ x: left, y }, { x: right, y });
  }
  return points;
}

function rasterEllipse(start: CanvasPoint, end: CanvasPoint): CanvasPoint[] {
  const left = Math.min(start.x, end.x);
  const right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const bottom = Math.max(start.y, end.y);
  const rx = Math.max(0.5, (right - left) / 2);
  const ry = Math.max(0.5, (bottom - top) / 2);
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;
  const steps = Math.max(16, Math.ceil(Math.PI * 2 * Math.max(rx, ry) * 2));
  const unique = new Map<string, CanvasPoint>();
  for (let index = 0; index < steps; index += 1) {
    const angle = (index / steps) * Math.PI * 2;
    const point = {
      x: Math.round(cx + Math.cos(angle) * rx),
      y: Math.round(cy + Math.sin(angle) * ry),
    };
    unique.set(`${point.x}:${point.y}`, point);
  }
  return [...unique.values()];
}

function rectFromPoints(start: CanvasPoint, end: CanvasPoint): SelectionRect {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  return {
    x,
    y,
    width: Math.abs(end.x - start.x) + 1,
    height: Math.abs(end.y - start.y) + 1,
  };
}

export function PixelCanvas({
  width,
  height,
  pixels,
  previousPixels,
  nextPixels,
  zoom,
  showGrid,
  onionSkin,
  tool,
  primaryColor,
  secondaryColor,
  brushSize,
  symmetryX,
  symmetryY,
  selection,
  disabled,
  onCommit,
  onPickColor,
  onSelectionChange,
  onCursorChange,
}: PixelCanvasProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const gestureRef = React.useRef<Gesture | null>(null);
  const previewRef = React.useRef<Map<number, string>>(new Map());
  const [previewVersion, setPreviewVersion] = React.useState(0);
  const [draftSelection, setDraftSelection] = React.useState<SelectionRect | null>(null);

  const pointFromEvent = React.useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>): CanvasPoint => {
      const bounds = event.currentTarget.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(width - 1, Math.floor(((event.clientX - bounds.left) / bounds.width) * width))),
        y: Math.max(0, Math.min(height - 1, Math.floor(((event.clientY - bounds.top) / bounds.height) * height))),
      };
    },
    [height, width],
  );

  const expandBrush = React.useCallback(
    (points: CanvasPoint[]) => {
      const expanded = new Map<string, CanvasPoint>();
      const radiusBefore = Math.floor((brushSize - 1) / 2);
      const radiusAfter = Math.ceil((brushSize - 1) / 2);
      const add = (x: number, y: number) => {
        if (x < 0 || x >= width || y < 0 || y >= height) return;
        expanded.set(`${x}:${y}`, { x, y });
      };
      for (const point of points) {
        for (let offsetY = -radiusBefore; offsetY <= radiusAfter; offsetY += 1) {
          for (let offsetX = -radiusBefore; offsetX <= radiusAfter; offsetX += 1) {
            const x = point.x + offsetX;
            const y = point.y + offsetY;
            add(x, y);
            if (symmetryX) add(width - 1 - x, y);
            if (symmetryY) add(x, height - 1 - y);
            if (symmetryX && symmetryY) add(width - 1 - x, height - 1 - y);
          }
        }
      }
      return [...expanded.values()];
    },
    [brushSize, height, symmetryX, symmetryY, width],
  );

  const writePreview = React.useCallback(
    (points: CanvasPoint[], color: string, replace = false) => {
      if (replace) previewRef.current.clear();
      for (const point of expandBrush(points)) {
        previewRef.current.set(point.y * width + point.x, color);
      }
      setPreviewVersion((value) => value + 1);
    },
    [expandBrush, width],
  );

  const fillAt = React.useCallback(
    (origin: CanvasPoint, color: string) => {
      const target = pixels[origin.y * width + origin.x] ?? "";
      if (target.toLowerCase() === color.toLowerCase()) return [];
      const queue = [origin];
      const visited = new Uint8Array(width * height);
      const patches: PixelPatch[] = [];
      while (queue.length) {
        const point = queue.pop();
        if (!point) break;
        const index = point.y * width + point.x;
        if (visited[index]) continue;
        visited[index] = 1;
        if ((pixels[index] ?? "").toLowerCase() !== target.toLowerCase()) continue;
        patches.push({ ...point, color });
        if (point.x > 0) queue.push({ x: point.x - 1, y: point.y });
        if (point.x + 1 < width) queue.push({ x: point.x + 1, y: point.y });
        if (point.y > 0) queue.push({ x: point.x, y: point.y - 1 });
        if (point.y + 1 < height) queue.push({ x: point.x, y: point.y + 1 });
      }
      return patches;
    },
    [height, pixels, width],
  );

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;
    context.imageSmoothingEnabled = false;
    const image = context.createImageData(width, height);
    const drawBuffer = (buffer: string[] | null | undefined, tint?: [number, number, number, number]) => {
      if (!buffer) return;
      for (let index = 0; index < width * height; index += 1) {
        const color = buffer[index] ?? "";
        if (!color) continue;
        const rgba = tint ?? parseHex(color);
        blendPixel(image.data, index * 4, rgba);
      }
    };

    if (onionSkin) drawBuffer(previousPixels, [255, 90, 105, 58]);
    if (onionSkin) drawBuffer(nextPixels, [72, 194, 255, 52]);
    drawBuffer(pixels);
    for (const [index, color] of previewRef.current) {
      const offset = index * 4;
      image.data[offset] = 0;
      image.data[offset + 1] = 0;
      image.data[offset + 2] = 0;
      image.data[offset + 3] = 0;
      if (color) blendPixel(image.data, offset, parseHex(color));
    }
    context.putImageData(image, 0, 0);
  }, [height, nextPixels, onionSkin, pixels, previousPixels, previewVersion, width]);

  const finishGesture = React.useCallback(() => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    if (tool === "select") {
      const nextSelection = draftSelection ?? rectFromPoints(gesture.start, gesture.last);
      onSelectionChange?.(nextSelection);
      setDraftSelection(null);
    } else if (previewRef.current.size > 0) {
      const patches = [...previewRef.current].map(([index, color]) => ({
        x: index % width,
        y: Math.floor(index / width),
        color,
      }));
      onCommit(patches, tool === "eraser" ? "Erase pixels" : `Draw with ${tool}`);
    }
    previewRef.current.clear();
    gestureRef.current = null;
    setPreviewVersion((value) => value + 1);
  }, [draftSelection, onCommit, onSelectionChange, tool, width]);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || (event.button !== 0 && event.button !== 2)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    const color = tool === "eraser" ? "" : event.button === 2 ? secondaryColor : primaryColor;
    gestureRef.current = {
      pointerId: event.pointerId,
      start: point,
      last: point,
      color,
      button: event.button,
    };

    if (tool === "picker") {
      const picked = pixels[point.y * width + point.x];
      if (picked) onPickColor(picked);
      gestureRef.current = null;
      return;
    }
    if (tool === "fill") {
      const patches = fillAt(point, color);
      if (patches.length) onCommit(patches, "Flood fill");
      gestureRef.current = null;
      return;
    }
    if (tool === "hand") {
      const scroller = scrollerRef.current;
      if (scroller) {
        gestureRef.current.panOrigin = {
          x: event.clientX,
          y: event.clientY,
          left: scroller.scrollLeft,
          top: scroller.scrollTop,
        };
      }
      return;
    }
    if (tool === "select") {
      setDraftSelection({ x: point.x, y: point.y, width: 1, height: 1 });
      return;
    }
    writePreview([point], color, true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = pointFromEvent(event);
    onCursorChange?.(point);
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    if (tool === "hand" && gesture.panOrigin && scrollerRef.current) {
      scrollerRef.current.scrollLeft = gesture.panOrigin.left - (event.clientX - gesture.panOrigin.x);
      scrollerRef.current.scrollTop = gesture.panOrigin.top - (event.clientY - gesture.panOrigin.y);
      return;
    }
    const previousPoint = gesture.last;
    gesture.last = point;
    if (tool === "select") {
      setDraftSelection(rectFromPoints(gesture.start, point));
      return;
    }
    if (tool === "pencil" || tool === "eraser") {
      writePreview(rasterLine(previousPoint, point), gesture.color);
    } else if (tool === "line") {
      writePreview(rasterLine(gesture.start, point), gesture.color, true);
    } else if (tool === "rectangle") {
      writePreview(rasterRectangle(gesture.start, point), gesture.color, true);
    } else if (tool === "ellipse") {
      writePreview(rasterEllipse(gesture.start, point), gesture.color, true);
    }
  };

  const visibleSelection = draftSelection ?? selection;
  const canvasWidth = width * zoom;
  const canvasHeight = height * zoom;

  return (
    <div
      ref={scrollerRef}
      className="pixel-scrollbar relative flex h-full min-h-0 w-full items-center justify-center overflow-auto bg-[#07090e] p-8 sm:p-12"
      aria-label="Pixel canvas workspace"
    >
      <div
        className="pixel-checker relative shrink-0 shadow-[0_18px_64px_rgba(0,0,0,.55),0_0_0_1px_#30384a]"
        style={{ width: canvasWidth, height: canvasHeight }}
      >
        <canvas
          ref={canvasRef}
          className="pixel-canvas absolute inset-0 h-full w-full"
          style={{ cursor: tool === "hand" ? "grab" : tool === "picker" ? "copy" : "crosshair" }}
          aria-label={`${width} by ${height} pixel drawing canvas`}
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishGesture}
          onPointerCancel={finishGesture}
          onPointerLeave={() => onCursorChange?.(null)}
        />
        {showGrid && zoom >= 8 ? (
          <div
            className="pointer-events-none absolute inset-0 opacity-45"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(105,120,148,.42) 1px, transparent 1px), linear-gradient(to bottom, rgba(105,120,148,.42) 1px, transparent 1px)",
              backgroundSize: `${zoom}px ${zoom}px`,
            }}
          />
        ) : null}
        {visibleSelection ? (
          <div
            className="pointer-events-none absolute border border-white shadow-[0_0_0_1px_#12151e,0_0_0_2px_rgba(255,255,255,.42)]"
            style={{
              left: visibleSelection.x * zoom,
              top: visibleSelection.y * zoom,
              width: visibleSelection.width * zoom,
              height: visibleSelection.height * zoom,
              backgroundImage:
                "linear-gradient(45deg, rgba(255,255,255,.22) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.22) 50%, rgba(255,255,255,.22) 75%, transparent 75%, transparent)",
              backgroundSize: "8px 8px",
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
