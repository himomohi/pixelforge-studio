import { compositeFrameRgba } from "./render";
import type { PixelProject } from "./types";

export type SpriteSheetLayout = "horizontal" | "vertical" | "grid";

export interface SpriteSheetOptions {
  layout?: SpriteSheetLayout;
  columns?: number;
  gap?: number;
  scale?: number;
}

export interface GifOptions {
  loop?: number;
  scale?: number;
}

export interface SpriteSheetMetadata {
  app: "PixelForge Studio";
  image: string;
  frameWidth: number;
  frameHeight: number;
  scale: number;
  columns: number;
  rows: number;
  frames: Array<{
    index: number;
    id: string;
    duration: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

export function sanitizeFilename(name: string, fallback = "pixelforge"): string {
  const clean = (name || fallback)
    .trim()
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return clean || fallback;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = sanitizeFilename(filename);
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function sourceCanvas(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas export is unavailable.");
  context.putImageData(
    new ImageData(new Uint8ClampedArray(rgba), width, height),
    0,
    0,
  );
  return canvas;
}

function canvasBlob(canvas: HTMLCanvasElement, type = "image/png"): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The browser could not encode this image."));
    }, type);
  });
}

export async function rgbaToPng(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  scale = 1,
): Promise<Blob> {
  const safeScale = Math.max(1, Math.min(16, Math.floor(scale)));
  const source = sourceCanvas(rgba, width, height);
  if (safeScale === 1) return canvasBlob(source);

  const output = document.createElement("canvas");
  output.width = width * safeScale;
  output.height = height * safeScale;
  const context = output.getContext("2d");
  if (!context) throw new Error("Canvas export is unavailable.");
  context.imageSmoothingEnabled = false;
  context.drawImage(source, 0, 0, output.width, output.height);
  return canvasBlob(output);
}

export function compositeFrame(
  project: PixelProject,
  frameId = project.activeFrameId,
): Uint8ClampedArray {
  return compositeFrameRgba(project, frameId);
}

export function exportFramePng(
  project: PixelProject,
  frameId = project.activeFrameId,
  scale = 1,
): Promise<Blob> {
  return rgbaToPng(
    compositeFrameRgba(project, frameId),
    project.width,
    project.height,
    scale,
  );
}

export function exportProjectJson(project: PixelProject): Blob {
  return new Blob([JSON.stringify(project, null, 2)], {
    type: "application/x-pixelforge+json",
  });
}

export function exportFrameSequence(
  project: PixelProject,
  scale = 1,
): Promise<Blob[]> {
  return Promise.all(
    project.frames.map((frame) => exportFramePng(project, frame.id, scale)),
  );
}

export async function exportSpriteSheet(
  project: PixelProject,
  options: SpriteSheetOptions = {},
): Promise<{ png: Blob; json: Blob; metadata: SpriteSheetMetadata }> {
  const frameCount = project.frames.length;
  const scale = Math.max(1, Math.min(16, Math.floor(options.scale ?? 1)));
  const gap = Math.max(0, Math.min(128, Math.floor(options.gap ?? 0))) * scale;
  const layout = options.layout ?? "grid";
  const columns =
    layout === "vertical"
      ? 1
      : layout === "horizontal"
        ? frameCount
        : Math.max(1, Math.min(frameCount, Math.floor(options.columns ?? Math.ceil(Math.sqrt(frameCount)))));
  const rows = Math.ceil(frameCount / columns);
  const frameWidth = project.width * scale;
  const frameHeight = project.height * scale;
  const sheetWidth = columns * frameWidth + Math.max(0, columns - 1) * gap;
  const sheetHeight = rows * frameHeight + Math.max(0, rows - 1) * gap;
  const canvas = document.createElement("canvas");
  canvas.width = sheetWidth;
  canvas.height = sheetHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas export is unavailable.");
  context.imageSmoothingEnabled = false;

  const frames: SpriteSheetMetadata["frames"] = [];
  project.frames.forEach((frame, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = column * (frameWidth + gap);
    const y = row * (frameHeight + gap);
    const source = sourceCanvas(
      compositeFrameRgba(project, frame.id),
      project.width,
      project.height,
    );
    context.drawImage(source, x, y, frameWidth, frameHeight);
    frames.push({
      index,
      id: frame.id,
      duration: frame.duration,
      x,
      y,
      width: frameWidth,
      height: frameHeight,
    });
  });

  const imageName = `${sanitizeFilename(project.name)}-sheet.png`;
  const metadata: SpriteSheetMetadata = {
    app: "PixelForge Studio",
    image: imageName,
    frameWidth,
    frameHeight,
    scale,
    columns,
    rows,
    frames,
  };
  return {
    png: await canvasBlob(canvas),
    json: new Blob([JSON.stringify(metadata, null, 2)], {
      type: "application/json",
    }),
    metadata,
  };
}

function littleEndian(value: number): [number, number] {
  return [value & 0xff, (value >> 8) & 0xff];
}

function scaledRgba(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  scale: number,
): Uint8ClampedArray {
  if (scale === 1) return rgba;
  const output = new Uint8ClampedArray(width * height * scale * scale * 4);
  const outputWidth = width * scale;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceOffset = (y * width + x) * 4;
      for (let offsetY = 0; offsetY < scale; offsetY += 1) {
        for (let offsetX = 0; offsetX < scale; offsetX += 1) {
          const destination =
            ((y * scale + offsetY) * outputWidth + x * scale + offsetX) * 4;
          output.set(rgba.subarray(sourceOffset, sourceOffset + 4), destination);
        }
      }
    }
  }
  return output;
}

function paletteIndex(red: number, green: number, blue: number, alpha: number): number {
  if (alpha < 128) return 0;
  const quantized = ((red >> 5) << 5) | ((green >> 5) << 2) | (blue >> 6);
  return 1 + Math.round((quantized / 255) * 254);
}

function writeCodeStream(indices: Uint8Array): number[] {
  const clearCode = 256;
  const endCode = 257;
  const output: number[] = [];
  let accumulator = 0;
  let bitCount = 0;
  let codeSize = 9;
  let nextCode = 258;
  let hasPrevious = false;

  const write = (code: number) => {
    accumulator |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      output.push(accumulator & 0xff);
      accumulator >>>= 8;
      bitCount -= 8;
    }
  };

  const reset = () => {
    codeSize = 9;
    nextCode = 258;
    hasPrevious = false;
  };

  write(clearCode);
  for (const index of indices) {
    write(index);
    if (hasPrevious) {
      nextCode += 1;
      if (nextCode === 1 << codeSize && codeSize < 12) codeSize += 1;
      if (nextCode >= 4090) {
        write(clearCode);
        reset();
        continue;
      }
    }
    hasPrevious = true;
  }
  write(endCode);
  if (bitCount > 0) output.push(accumulator & 0xff);
  return output;
}

export function exportAnimatedGif(
  project: PixelProject,
  options: GifOptions = {},
): Blob {
  const scale = Math.max(1, Math.min(8, Math.floor(options.scale ?? 1)));
  const width = project.width * scale;
  const height = project.height * scale;
  if (width > 4096 || height > 4096) {
    throw new Error("GIF dimensions cannot exceed 4096 pixels.");
  }

  const bytes: number[] = [...new TextEncoder().encode("GIF89a")];
  bytes.push(...littleEndian(width), ...littleEndian(height), 0xf7, 0, 0);
  bytes.push(0, 0, 0);
  for (let index = 1; index < 256; index += 1) {
    const quantized = Math.round(((index - 1) / 254) * 255);
    bytes.push(
      ((quantized >> 5) & 7) * 36,
      ((quantized >> 2) & 7) * 36,
      (quantized & 3) * 85,
    );
  }

  const loop = Math.max(0, Math.min(65535, Math.floor(options.loop ?? 0)));
  bytes.push(
    0x21,
    0xff,
    11,
    ...new TextEncoder().encode("NETSCAPE2.0"),
    3,
    1,
    ...littleEndian(loop),
    0,
  );

  for (const frame of project.frames) {
    const rgba = scaledRgba(
      compositeFrameRgba(project, frame.id),
      project.width,
      project.height,
      scale,
    );
    const indices = new Uint8Array(width * height);
    for (let pixel = 0; pixel < indices.length; pixel += 1) {
      const offset = pixel * 4;
      indices[pixel] = paletteIndex(
        rgba[offset],
        rgba[offset + 1],
        rgba[offset + 2],
        rgba[offset + 3],
      );
    }

    const delay = Math.max(2, Math.min(65535, Math.round(frame.duration / 10)));
    bytes.push(0x21, 0xf9, 4, 0x05, ...littleEndian(delay), 0, 0);
    bytes.push(0x2c, 0, 0, 0, 0, ...littleEndian(width), ...littleEndian(height), 0);
    bytes.push(8);
    const stream = writeCodeStream(indices);
    for (let offset = 0; offset < stream.length; offset += 255) {
      const block = stream.slice(offset, offset + 255);
      bytes.push(block.length, ...block);
    }
    bytes.push(0);
  }
  bytes.push(0x3b);
  return new Blob([new Uint8Array(bytes)], { type: "image/gif" });
}
