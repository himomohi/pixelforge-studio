import { celFor } from "./project";
import type { PixelProject } from "./types";

export type RGBA = [number, number, number, number];

export function parsePixel(color: string): RGBA {
  if (!color || color === "transparent") return [0, 0, 0, 0];
  const raw = color.startsWith("#") ? color.slice(1) : color;
  if (raw.length === 3 || raw.length === 4) {
    const parts = raw.split("").map((value) => Number.parseInt(value + value, 16));
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 255];
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

function blend(output: Uint8ClampedArray, offset: number, source: RGBA, opacity: number) {
  const sourceAlpha = (source[3] / 255) * opacity;
  if (sourceAlpha <= 0) return;
  const destinationAlpha = output[offset + 3] / 255;
  const finalAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);
  if (finalAlpha <= 0) return;

  output[offset] = Math.round(
    (source[0] * sourceAlpha + output[offset] * destinationAlpha * (1 - sourceAlpha)) /
      finalAlpha,
  );
  output[offset + 1] = Math.round(
    (source[1] * sourceAlpha +
      output[offset + 1] * destinationAlpha * (1 - sourceAlpha)) /
      finalAlpha,
  );
  output[offset + 2] = Math.round(
    (source[2] * sourceAlpha +
      output[offset + 2] * destinationAlpha * (1 - sourceAlpha)) /
      finalAlpha,
  );
  output[offset + 3] = Math.round(finalAlpha * 255);
}

export function compositeFrameRgba(
  project: PixelProject,
  frameId = project.activeFrameId,
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(project.width * project.height * 4);
  for (const layer of project.layers) {
    if (!layer.visible || layer.opacity <= 0) continue;
    const cel = celFor(project, layer.id, frameId);
    if (!cel) continue;
    for (let index = 0; index < cel.pixels.length; index += 1) {
      const color = cel.pixels[index];
      if (!color) continue;
      blend(output, index * 4, parsePixel(color), layer.opacity);
    }
  }
  return output;
}

export function compositeFramePixels(
  project: PixelProject,
  frameId = project.activeFrameId,
): string[] {
  const rgba = compositeFrameRgba(project, frameId);
  const pixels: string[] = [];
  for (let offset = 0; offset < rgba.length; offset += 4) {
    const alpha = rgba[offset + 3];
    if (!alpha) {
      pixels.push("");
      continue;
    }
    const channels = [rgba[offset], rgba[offset + 1], rgba[offset + 2]]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
    pixels.push(`#${channels}${alpha === 255 ? "" : alpha.toString(16).padStart(2, "0")}`);
  }
  return pixels;
}

export function adjacentFrameId(
  project: PixelProject,
  direction: -1 | 1,
): string | null {
  const index = project.frames.findIndex((frame) => frame.id === project.activeFrameId);
  if (index < 0 || project.frames.length < 2) return null;
  return project.frames[(index + direction + project.frames.length) % project.frames.length]?.id ?? null;
}

export function frameThumbnailUrl(
  project: PixelProject,
  frameId: string,
  scale = 2,
): string {
  if (typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  canvas.width = project.width * scale;
  canvas.height = project.height * scale;
  const context = canvas.getContext("2d");
  if (!context) return "";
  context.imageSmoothingEnabled = false;
  const source = document.createElement("canvas");
  source.width = project.width;
  source.height = project.height;
  const sourceContext = source.getContext("2d");
  if (!sourceContext) return "";
  sourceContext.putImageData(
    new ImageData(
      new Uint8ClampedArray(compositeFrameRgba(project, frameId)),
      project.width,
      project.height,
    ),
    0,
    0,
  );
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}
