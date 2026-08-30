import { createProject, ensureCel } from "./project";
import { rgbToHex } from "./palettes";
import { MAX_CANVAS_DIMENSION } from "./presets";
import type { PixelProject } from "./types";

export type PixelDither = "none" | "ordered-4x4" | "floyd-steinberg";
export type PixelFit = "contain" | "cover" | "stretch";
export type PixelSampling = "smooth" | "nearest";

export interface PixelizeOptions {
  width: number;
  height: number;
  maxColors?: number;
  dither?: PixelDither;
  alphaThreshold?: number;
  preserveAlpha?: boolean;
  fit?: PixelFit;
  sampling?: PixelSampling;
  trimTransparent?: boolean;
  targetOccupancy?: number;
  hardAlpha?: boolean;
}

export interface PixelizeResult {
  pixels: string[];
  palette: string[];
  transparentPixels: number;
}

type WeightedColor = {
  r: number;
  g: number;
  b: number;
  count: number;
};

const BAYER_4X4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
];

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function channelRanges(colors: WeightedColor[]) {
  let minR = 255;
  let minG = 255;
  let minB = 255;
  let maxR = 0;
  let maxG = 0;
  let maxB = 0;
  let total = 0;
  for (const color of colors) {
    minR = Math.min(minR, color.r);
    minG = Math.min(minG, color.g);
    minB = Math.min(minB, color.b);
    maxR = Math.max(maxR, color.r);
    maxG = Math.max(maxG, color.g);
    maxB = Math.max(maxB, color.b);
    total += color.count;
  }
  return {
    ranges: [maxR - minR, maxG - minG, maxB - minB],
    total,
  };
}

function histogram(rgba: Uint8ClampedArray, alphaThreshold: number): WeightedColor[] {
  const buckets = new Map<
    number,
    { red: number; green: number; blue: number; count: number }
  >();
  const pixelCount = rgba.length / 4;
  const stride = Math.max(1, Math.ceil(pixelCount / 131_072));
  for (let pixel = 0; pixel < pixelCount; pixel += stride) {
    const offset = pixel * 4;
    if (rgba[offset + 3] < alphaThreshold) continue;
    const red = rgba[offset];
    const green = rgba[offset + 1];
    const blue = rgba[offset + 2];
    const key = ((red >> 3) << 10) | ((green >> 3) << 5) | (blue >> 3);
    const bucket = buckets.get(key) ?? { red: 0, green: 0, blue: 0, count: 0 };
    bucket.red += red;
    bucket.green += green;
    bucket.blue += blue;
    bucket.count += 1;
    buckets.set(key, bucket);
  }
  return [...buckets.values()].map((bucket) => ({
    r: bucket.red / bucket.count,
    g: bucket.green / bucket.count,
    b: bucket.blue / bucket.count,
    count: bucket.count,
  }));
}

export function medianCutPalette(
  rgba: Uint8ClampedArray,
  requestedColors = 16,
  alphaThreshold = 8,
): string[] {
  const colors = histogram(rgba, alphaThreshold);
  if (!colors.length) return ["#000000", "#ffffff"];
  const requested = Number.isFinite(requestedColors)
    ? Math.floor(requestedColors)
    : 16;
  const maxColors = Math.max(2, Math.min(64, requested));
  const boxes: WeightedColor[][] = [colors];

  while (boxes.length < maxColors) {
    let selected = -1;
    let selectedScore = -1;
    boxes.forEach((box, index) => {
      if (box.length < 2) return;
      const { ranges, total } = channelRanges(box);
      const score = Math.max(...ranges) * total;
      if (score > selectedScore) {
        selected = index;
        selectedScore = score;
      }
    });
    if (selected < 0) break;

    const box = boxes[selected];
    const { ranges, total } = channelRanges(box);
    const channel = ranges.indexOf(Math.max(...ranges)) as 0 | 1 | 2;
    const key: "r" | "g" | "b" = channel === 0 ? "r" : channel === 1 ? "g" : "b";
    box.sort((left, right) => left[key] - right[key]);
    let running = 0;
    let split = 1;
    for (; split < box.length; split += 1) {
      running += box[split - 1].count;
      if (running >= total / 2) break;
    }
    boxes.splice(selected, 1, box.slice(0, split), box.slice(split));
  }

  const unique = new Set<string>();
  for (const box of boxes) {
    let red = 0;
    let green = 0;
    let blue = 0;
    let total = 0;
    for (const color of box) {
      red += color.r * color.count;
      green += color.g * color.count;
      blue += color.b * color.count;
      total += color.count;
    }
    if (total > 0) {
      unique.add(rgbToHex({ r: red / total, g: green / total, b: blue / total }));
    }
  }
  return [...unique].slice(0, maxColors);
}

function parsePalette(palette: string[]) {
  return palette.map((hex) => {
    const raw = hex.slice(1);
    return {
      hex: hex.slice(0, 7).toLowerCase(),
      r: Number.parseInt(raw.slice(0, 2), 16),
      g: Number.parseInt(raw.slice(2, 4), 16),
      b: Number.parseInt(raw.slice(4, 6), 16),
    };
  });
}

function nearestColor(
  red: number,
  green: number,
  blue: number,
  palette: ReturnType<typeof parsePalette>,
) {
  let best = palette[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of palette) {
    const redDelta = red - candidate.r;
    const greenDelta = green - candidate.g;
    const blueDelta = blue - candidate.b;
    const distance =
      redDelta * redDelta * 0.299 +
      greenDelta * greenDelta * 0.587 +
      blueDelta * blueDelta * 0.114;
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

function pixelValue(hex: string, alpha: number, preserveAlpha: boolean): string {
  if (!preserveAlpha || alpha >= 255) return hex;
  return hex + clampByte(alpha).toString(16).padStart(2, "0");
}

export function pixelizeRgba(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  options: Omit<PixelizeOptions, "width" | "height" | "fit" | "sampling"> = {},
): PixelizeResult {
  if (rgba.length !== width * height * 4) {
    throw new Error("Pixel buffer dimensions do not match the image.");
  }
  const requestedThreshold = options.alphaThreshold ?? 8;
  const alphaThreshold = Number.isFinite(requestedThreshold)
    ? Math.max(0, Math.min(255, requestedThreshold))
    : 8;
  const preserveAlpha = options.preserveAlpha ?? true;
  const dither = options.dither ?? "none";
  const palette = medianCutPalette(rgba, options.maxColors ?? 16, alphaThreshold);
  const parsedPalette = parsePalette(palette);
  const output = Array<string>(width * height).fill("");
  let transparentPixels = 0;

  if (dither === "floyd-steinberg") {
    const work = new Float32Array(width * height * 3);
    for (let pixel = 0; pixel < width * height; pixel += 1) {
      work[pixel * 3] = rgba[pixel * 4];
      work[pixel * 3 + 1] = rgba[pixel * 4 + 1];
      work[pixel * 3 + 2] = rgba[pixel * 4 + 2];
    }
    const diffuse = (
      x: number,
      y: number,
      redError: number,
      greenError: number,
      blueError: number,
      weight: number,
    ) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const pixel = y * width + x;
      if (rgba[pixel * 4 + 3] < alphaThreshold) return;
      const offset = pixel * 3;
      work[offset] += redError * weight;
      work[offset + 1] += greenError * weight;
      work[offset + 2] += blueError * weight;
    };
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const pixel = y * width + x;
        const alpha = rgba[pixel * 4 + 3];
        if (alpha < alphaThreshold) {
          transparentPixels += 1;
          continue;
        }
        const offset = pixel * 3;
        const red = clampByte(work[offset]);
        const green = clampByte(work[offset + 1]);
        const blue = clampByte(work[offset + 2]);
        const nearest = nearestColor(red, green, blue, parsedPalette);
        output[pixel] = pixelValue(nearest.hex, alpha, preserveAlpha);
        const redError = red - nearest.r;
        const greenError = green - nearest.g;
        const blueError = blue - nearest.b;
        diffuse(x + 1, y, redError, greenError, blueError, 7 / 16);
        diffuse(x - 1, y + 1, redError, greenError, blueError, 3 / 16);
        diffuse(x, y + 1, redError, greenError, blueError, 5 / 16);
        diffuse(x + 1, y + 1, redError, greenError, blueError, 1 / 16);
      }
    }
    return { pixels: output, palette, transparentPixels };
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      const offset = pixel * 4;
      const alpha = rgba[offset + 3];
      if (alpha < alphaThreshold) {
        transparentPixels += 1;
        continue;
      }
      const threshold =
        dither === "ordered-4x4"
          ? (BAYER_4X4[(y % 4) * 4 + (x % 4)] / 15 - 0.5) * 44
          : 0;
      const nearest = nearestColor(
        clampByte(rgba[offset] + threshold),
        clampByte(rgba[offset + 1] + threshold),
        clampByte(rgba[offset + 2] + threshold),
        parsedPalette,
      );
      output[pixel] = pixelValue(nearest.hex, alpha, preserveAlpha);
    }
  }
  return { pixels: output, palette, transparentPixels };
}

function assertActive(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("Image conversion was cancelled.", "AbortError");
  }
}

function validateTarget(options: PixelizeOptions): void {
  if (
    !Number.isInteger(options.width) ||
    !Number.isInteger(options.height) ||
    options.width < 1 ||
    options.height < 1 ||
    options.width > MAX_CANVAS_DIMENSION ||
    options.height > MAX_CANVAS_DIMENSION
  ) {
    throw new Error(`Pixel output must be between 1 and ${MAX_CANVAS_DIMENSION} pixels.`);
  }
}

async function decodeRaster(blob: Blob): Promise<ImageBitmap> {
  if (blob.size > 16 * 1024 * 1024) {
    throw new Error("Images must be 16 MB or smaller.");
  }
  if (typeof createImageBitmap !== "function") {
    throw new Error("Image conversion is unavailable in this browser.");
  }
  try {
    return await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    throw new Error("The selected file could not be decoded as an image.");
  }
}

function validateSourceDimensions(width: number, height: number): void {
  if (
    width < 1 ||
    height < 1 ||
    width > 8192 ||
    height > 8192 ||
    width * height > 67_108_864
  ) {
    throw new Error("Source images may not exceed 8192 pixels per side or 64 megapixels.");
  }
}

type SourceBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function clampUnit(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0.1, Math.min(1, Number(value)));
}

function detectContentBounds(
  bitmap: ImageBitmap,
  alphaThreshold: number,
): SourceBounds {
  const longest = Math.max(bitmap.width, bitmap.height);
  const analysisScale = Math.min(1, 1024 / longest);
  const width = Math.max(1, Math.round(bitmap.width * analysisScale));
  const height = Math.max(1, Math.round(bitmap.height * analysisScale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
  }
  context.clearRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  const rgba = context.getImageData(0, 0, width, height).data;
  let minimumX = width;
  let minimumY = height;
  let maximumX = -1;
  let maximumY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (rgba[(y * width + x) * 4 + 3] < alphaThreshold) continue;
      minimumX = Math.min(minimumX, x);
      minimumY = Math.min(minimumY, y);
      maximumX = Math.max(maximumX, x);
      maximumY = Math.max(maximumY, y);
    }
  }
  if (maximumX < minimumX || maximumY < minimumY) {
    return { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
  }
  const inverse = 1 / analysisScale;
  const x = Math.max(0, Math.floor(minimumX * inverse));
  const y = Math.max(0, Math.floor(minimumY * inverse));
  const right = Math.min(bitmap.width, Math.ceil((maximumX + 1) * inverse));
  const bottom = Math.min(bitmap.height, Math.ceil((maximumY + 1) * inverse));
  return {
    x,
    y,
    width: Math.max(1, right - x),
    height: Math.max(1, bottom - y),
  };
}

export async function inspectRaster(blob: Blob): Promise<{ width: number; height: number }> {
  const bitmap = await decodeRaster(blob);
  const dimensions = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  validateSourceDimensions(dimensions.width, dimensions.height);
  return dimensions;
}

export async function pixelizeRaster(
  blob: Blob,
  name: string,
  options: PixelizeOptions,
  signal?: AbortSignal,
): Promise<PixelProject> {
  validateTarget(options);
  assertActive(signal);
  const bitmap = await decodeRaster(blob);
  try {
    validateSourceDimensions(bitmap.width, bitmap.height);
    assertActive(signal);
  } catch (error) {
    bitmap.close();
    throw error;
  }
  const canvas = document.createElement("canvas");
  canvas.width = options.width;
  canvas.height = options.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    bitmap.close();
    throw new Error("The browser could not prepare the image canvas.");
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = (options.sampling ?? "smooth") === "smooth";
  if ("imageSmoothingQuality" in context) context.imageSmoothingQuality = "high";

  const requestedThreshold = Number.isFinite(options.alphaThreshold)
    ? Number(options.alphaThreshold)
    : 8;
  const alphaThreshold = Math.max(0, Math.min(255, requestedThreshold));
  const source = options.trimTransparent
    ? detectContentBounds(bitmap, Math.max(1, alphaThreshold))
    : { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
  const occupancy = clampUnit(options.targetOccupancy, 1);
  let destinationX = 0;
  let destinationY = 0;
  let destinationWidth = canvas.width * occupancy;
  let destinationHeight = canvas.height * occupancy;
  const fit = options.fit ?? "contain";
  if (fit !== "stretch") {
    const scale =
      fit === "cover"
        ? Math.max(
            (canvas.width * occupancy) / source.width,
            (canvas.height * occupancy) / source.height,
          )
        : Math.min(
            (canvas.width * occupancy) / source.width,
            (canvas.height * occupancy) / source.height,
          );
    destinationWidth = source.width * scale;
    destinationHeight = source.height * scale;
    destinationX = (canvas.width - destinationWidth) / 2;
    destinationY = (canvas.height - destinationHeight) / 2;
  } else {
    destinationX = (canvas.width - destinationWidth) / 2;
    destinationY = (canvas.height - destinationHeight) / 2;
  }
  context.drawImage(
    bitmap,
    source.x,
    source.y,
    source.width,
    source.height,
    destinationX,
    destinationY,
    destinationWidth,
    destinationHeight,
  );
  bitmap.close();
  assertActive(signal);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  if (options.hardAlpha) {
    for (let offset = 3; offset < imageData.data.length; offset += 4) {
      imageData.data[offset] =
        imageData.data[offset] < alphaThreshold ? 0 : 255;
    }
  }
  const rgba = imageData.data;
  const converted = pixelizeRgba(rgba, canvas.width, canvas.height, options);
  assertActive(signal);
  const project = createProject(canvas.width, canvas.height, name || "Pixelized image");
  const cel = ensureCel(project, project.activeLayerId, project.activeFrameId);
  cel.pixels = converted.pixels;
  project.palettes = [
    { id: "palette-pixelized", name: "Pixelized", colors: converted.palette },
  ];
  if (converted.palette[0]) project.tool.color = converted.palette[0];
  return project;
}

export function imageDataUrlToBlob(dataUrl: string): Blob {
  if (dataUrl.length > 22_400_000) {
    throw new Error("Encoded images must be 16 MB or smaller.");
  }
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([a-z0-9+/=\s]+)$/i.exec(dataUrl);
  if (!match) {
    throw new Error("Use a base64 PNG, JPEG, or WebP data URL.");
  }
  let binary: string;
  try {
    binary = atob(match[2].replace(/\s/g, ""));
  } catch {
    throw new Error("The image data URL contains invalid base64 data.");
  }
  if (binary.length > 16 * 1024 * 1024) {
    throw new Error("Decoded images must be 16 MB or smaller.");
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: match[1].toLowerCase() });
}
