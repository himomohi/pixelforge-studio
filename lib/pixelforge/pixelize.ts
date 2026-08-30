import { createProject, ensureCel } from "./project";
import { rgbToHex } from "./palettes";
import { MAX_CANVAS_DIMENSION, MAX_PROJECT_PIXEL_CELLS } from "./presets";
import type { PixelProject } from "./types";

export type PixelDither = "none" | "ordered-4x4" | "floyd-steinberg";
export type PixelFit = "contain" | "cover" | "stretch";
export type PixelSampling = "smooth" | "nearest";
export type PixelResolutionMode = "source-exact" | "auto-faithful" | "custom";
export type PixelFidelityMode = "strict-99" | "balanced" | "manual";

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

export interface RasterBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RasterInspection {
  width: number;
  height: number;
  contentBounds: RasterBounds;
  foregroundSource: "reference-alpha" | "full-canvas";
  hasMeaningfulAlpha: boolean;
}

export interface FaithfulTarget {
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  sourceAspectRatio: number;
  targetAspectRatio: number;
  basedOnContentBounds: boolean;
  resolutionMode: PixelResolutionMode;
  fidelityMode: PixelFidelityMode;
}

export interface FidelityMetric {
  score: number | null;
  floor: number | null;
  passed: boolean | null;
  applicable: boolean;
  raw?: number | null;
}

export interface PixelFidelityReport {
  schemaVersion: "1.0";
  metricVersion: "pixelforge-fidelity-v1";
  status: "verified_99" | "degraded" | "unscorable";
  targetScore: 0.99;
  achievedScore: number | null;
  verified: boolean;
  comparison: {
    width: number;
    height: number;
    colorSpace: "srgb";
    alphaThreshold: number;
    foregroundSource: "reference-alpha" | "full-canvas";
  };
  metrics: {
    aspectRatio: FidelityMetric;
    contentBounds: FidelityMetric;
    silhouetteIoU: FidelityMetric;
    alphaIoU: FidelityMetric;
    colorSimilarity: FidelityMetric;
    edgeStructure: FidelityMetric;
  };
  invariants: Array<{ name: string; passed: boolean; details?: string }>;
  warnings: string[];
}

export interface PixelizeDetailedResult {
  project: PixelProject;
  fidelity: PixelFidelityReport;
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
  const maxColors = Math.max(2, Math.min(256, requested));
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
  let centroids = [...unique].slice(0, maxColors).map((hex) => ({
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  }));
  // Added: two deterministic weighted Lloyd passes reduce reconstruction error
  // without changing the requested palette budget.
  for (let iteration = 0; iteration < 2 && centroids.length > 1; iteration += 1) {
    const sums = centroids.map(() => ({ red: 0, green: 0, blue: 0, weight: 0 }));
    for (const color of colors) {
      let selected = 0;
      let selectedDistance = Number.POSITIVE_INFINITY;
      centroids.forEach((candidate, index) => {
        const red = color.r - candidate.r;
        const green = color.g - candidate.g;
        const blue = color.b - candidate.b;
        const distance = red * red * 0.2126 + green * green * 0.7152 + blue * blue * 0.0722;
        if (distance < selectedDistance) {
          selected = index;
          selectedDistance = distance;
        }
      });
      sums[selected].red += color.r * color.count;
      sums[selected].green += color.g * color.count;
      sums[selected].blue += color.b * color.count;
      sums[selected].weight += color.count;
    }
    centroids = centroids.map((candidate, index) => {
      const sum = sums[index];
      return sum.weight > 0
        ? {
            r: sum.red / sum.weight,
            g: sum.green / sum.weight,
            b: sum.blue / sum.weight,
          }
        : candidate;
    });
  }
  return [...new Set(centroids.map((color) => rgbToHex(color)))].slice(0, maxColors);
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
  const nearestCache = new Map<number, ReturnType<typeof parsePalette>[number]>();
  const cachedNearestColor = (red: number, green: number, blue: number) => {
    const key = ((red >> 3) << 10) | ((green >> 3) << 5) | (blue >> 3);
    const cached = nearestCache.get(key);
    if (cached) return cached;
    const selected = nearestColor(red, green, blue, parsedPalette);
    nearestCache.set(key, selected);
    return selected;
  };
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
      const nearest = cachedNearestColor(
        clampByte(rgba[offset] + threshold),
        clampByte(rgba[offset + 1] + threshold),
        clampByte(rgba[offset + 2] + threshold),
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

function clampUnit(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0.1, Math.min(1, Number(value)));
}

function detectContentBounds(
  bitmap: ImageBitmap,
  alphaThreshold: number,
): { bounds: RasterBounds; hasMeaningfulAlpha: boolean } {
  const longest = Math.max(bitmap.width, bitmap.height);
  const analysisScale = Math.min(1, 1024 / longest);
  const width = Math.max(1, Math.round(bitmap.width * analysisScale));
  const height = Math.max(1, Math.round(bitmap.height * analysisScale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return {
      bounds: { x: 0, y: 0, width: bitmap.width, height: bitmap.height },
      hasMeaningfulAlpha: false,
    };
  }
  context.clearRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  const rgba = context.getImageData(0, 0, width, height).data;
  let minimumX = width;
  let minimumY = height;
  let maximumX = -1;
  let maximumY = -1;
  let transparentPixels = 0;
  let visiblePixels = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = rgba[(y * width + x) * 4 + 3];
      if (alpha < 250) transparentPixels += 1;
      if (alpha < alphaThreshold) continue;
      visiblePixels += 1;
      minimumX = Math.min(minimumX, x);
      minimumY = Math.min(minimumY, y);
      maximumX = Math.max(maximumX, x);
      maximumY = Math.max(maximumY, y);
    }
  }
  const hasMeaningfulAlpha = transparentPixels > 0 && visiblePixels > 0;
  if (maximumX < minimumX || maximumY < minimumY) {
    return {
      bounds: { x: 0, y: 0, width: bitmap.width, height: bitmap.height },
      hasMeaningfulAlpha,
    };
  }
  const inverse = 1 / analysisScale;
  const x = Math.max(0, Math.floor(minimumX * inverse));
  const y = Math.max(0, Math.floor(minimumY * inverse));
  const right = Math.min(bitmap.width, Math.ceil((maximumX + 1) * inverse));
  const bottom = Math.min(bitmap.height, Math.ceil((maximumY + 1) * inverse));
  return {
    bounds: {
      x,
      y,
      width: Math.max(1, right - x),
      height: Math.max(1, bottom - y),
    },
    hasMeaningfulAlpha,
  };
}

export async function inspectRaster(blob: Blob): Promise<RasterInspection> {
  const bitmap = await decodeRaster(blob);
  const detected = detectContentBounds(bitmap, 8);
  const dimensions: RasterInspection = {
    width: bitmap.width,
    height: bitmap.height,
    contentBounds: detected.hasMeaningfulAlpha
      ? detected.bounds
      : { x: 0, y: 0, width: bitmap.width, height: bitmap.height },
    foregroundSource: detected.hasMeaningfulAlpha
      ? "reference-alpha"
      : "full-canvas",
    hasMeaningfulAlpha: detected.hasMeaningfulAlpha,
  };
  bitmap.close();
  validateSourceDimensions(dimensions.width, dimensions.height);
  return dimensions;
}

export function resolveFaithfulTarget(
  inspections: RasterInspection[],
  input: {
    width?: number;
    height?: number;
    resolutionMode?: PixelResolutionMode;
    fidelityMode?: PixelFidelityMode;
    trimTransparent?: boolean;
    maximumLongestSide?: number;
  } = {},
): FaithfulTarget {
  if (!inspections.length) throw new Error("At least one source image is required.");
  const resolutionMode = input.resolutionMode ?? "auto-faithful";
  const fidelityMode = input.fidelityMode ?? "strict-99";
  const trimTransparent = input.trimTransparent ?? true;
  const useContentBounds =
    inspections.length === 1 &&
    trimTransparent &&
    inspections[0].hasMeaningfulAlpha;
  const sourceWidth = useContentBounds
    ? inspections[0].contentBounds.width
    : Math.max(...inspections.map((item) => item.width));
  const sourceHeight = useContentBounds
    ? inspections[0].contentBounds.height
    : Math.max(...inspections.map((item) => item.height));

  let width: number;
  let height: number;
  if (resolutionMode === "custom") {
    if (!Number.isInteger(input.width) || !Number.isInteger(input.height)) {
      throw new Error("Custom resolution requires whole-number width and height.");
    }
    width = Number(input.width);
    height = Number(input.height);
  } else if (resolutionMode === "source-exact") {
    width = Math.max(...inspections.map((item) => item.width));
    height = Math.max(...inspections.map((item) => item.height));
  } else {
    const profileMaximum = fidelityMode === "strict-99" ? 1024 : 512;
    const maximumLongestSide = Math.max(
      1,
      Math.min(
        MAX_CANVAS_DIMENSION,
        Math.floor(input.maximumLongestSide ?? profileMaximum),
      ),
    );
    const scale = Math.min(
      1,
      maximumLongestSide / Math.max(sourceWidth, sourceHeight),
    );
    width = Math.max(1, Math.round(sourceWidth * scale));
    height = Math.max(1, Math.round(sourceHeight * scale));
  }

  if (
    width < 1 ||
    height < 1 ||
    width > MAX_CANVAS_DIMENSION ||
    height > MAX_CANVAS_DIMENSION ||
    width * height > MAX_PROJECT_PIXEL_CELLS
  ) {
    throw new Error("The faithful target exceeds the safe project pixel budget.");
  }
  return {
    width,
    height,
    sourceWidth,
    sourceHeight,
    sourceAspectRatio: sourceWidth / sourceHeight,
    targetAspectRatio: width / height,
    basedOnContentBounds: useContentBounds,
    resolutionMode,
    fidelityMode,
  };
}

export function applyFidelityProfile<T extends PixelizeOptions>(
  options: T,
  fidelityMode: PixelFidelityMode = "strict-99",
): T {
  if (fidelityMode !== "strict-99") return { ...options };
  return {
    ...options,
    maxColors: Math.max(128, Math.min(256, options.maxColors ?? 256)),
    dither: "none",
    fit: "contain",
    sampling: "smooth",
    preserveAlpha: true,
    trimTransparent: true,
    targetOccupancy: Math.max(0.98, options.targetOccupancy ?? 0.98),
    hardAlpha: false,
  } as T;
}

type RenderedReference = {
  rgba: Uint8ClampedArray;
  source: RasterBounds;
  destination: RasterBounds;
  hasMeaningfulAlpha: boolean;
};

function drawProgressively(
  context: CanvasRenderingContext2D,
  bitmap: ImageBitmap,
  source: RasterBounds,
  destination: RasterBounds,
  smooth: boolean,
): void {
  context.imageSmoothingEnabled = smooth;
  if ("imageSmoothingQuality" in context) context.imageSmoothingQuality = "high";
  if (!smooth || Math.max(source.width / destination.width, source.height / destination.height) < 2) {
    context.drawImage(
      bitmap,
      source.x,
      source.y,
      source.width,
      source.height,
      destination.x,
      destination.y,
      destination.width,
      destination.height,
    );
    return;
  }

  const initialScale = Math.min(1, 2048 / Math.max(source.width, source.height));
  let current = document.createElement("canvas");
  current.width = Math.max(destination.width, Math.round(source.width * initialScale));
  current.height = Math.max(destination.height, Math.round(source.height * initialScale));
  let currentContext = current.getContext("2d");
  if (!currentContext) {
    context.drawImage(
      bitmap,
      source.x,
      source.y,
      source.width,
      source.height,
      destination.x,
      destination.y,
      destination.width,
      destination.height,
    );
    return;
  }
  currentContext.imageSmoothingEnabled = true;
  currentContext.imageSmoothingQuality = "high";
  currentContext.drawImage(
    bitmap,
    source.x,
    source.y,
    source.width,
    source.height,
    0,
    0,
    current.width,
    current.height,
  );

  while (current.width > destination.width * 2 || current.height > destination.height * 2) {
    const next = document.createElement("canvas");
    next.width = Math.max(destination.width, Math.round(current.width / 2));
    next.height = Math.max(destination.height, Math.round(current.height / 2));
    currentContext = next.getContext("2d");
    if (!currentContext) break;
    currentContext.imageSmoothingEnabled = true;
    currentContext.imageSmoothingQuality = "high";
    currentContext.drawImage(current, 0, 0, next.width, next.height);
    current = next;
  }
  context.drawImage(
    current,
    0,
    0,
    current.width,
    current.height,
    destination.x,
    destination.y,
    destination.width,
    destination.height,
  );
}

function renderReference(
  bitmap: ImageBitmap,
  options: PixelizeOptions,
  alphaThreshold: number,
): RenderedReference {
  const canvas = document.createElement("canvas");
  canvas.width = options.width;
  canvas.height = options.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("The browser could not prepare the image canvas.");
  context.clearRect(0, 0, canvas.width, canvas.height);

  const detected = detectContentBounds(bitmap, Math.max(1, alphaThreshold));
  const source = options.trimTransparent && detected.hasMeaningfulAlpha
    ? detected.bounds
    : { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
  const occupancy = clampUnit(options.targetOccupancy, 1);
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
  }
  const destination: RasterBounds = {
    x: Math.round((canvas.width - destinationWidth) / 2),
    y: Math.round((canvas.height - destinationHeight) / 2),
    width: Math.max(1, Math.round(destinationWidth)),
    height: Math.max(1, Math.round(destinationHeight)),
  };
  drawProgressively(
    context,
    bitmap,
    source,
    destination,
    (options.sampling ?? "smooth") === "smooth",
  );
  return {
    rgba: context.getImageData(0, 0, canvas.width, canvas.height).data,
    source,
    destination,
    hasMeaningfulAlpha: detected.hasMeaningfulAlpha,
  };
}

function pixelsToRgba(pixels: string[]): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(pixels.length * 4);
  pixels.forEach((color, index) => {
    if (!color) return;
    const raw = color.startsWith("#") ? color.slice(1) : color;
    const offset = index * 4;
    rgba[offset] = Number.parseInt(raw.slice(0, 2), 16);
    rgba[offset + 1] = Number.parseInt(raw.slice(2, 4), 16);
    rgba[offset + 2] = Number.parseInt(raw.slice(4, 6), 16);
    rgba[offset + 3] = raw.length >= 8 ? Number.parseInt(raw.slice(6, 8), 16) : 255;
  });
  return rgba;
}

function alphaBounds(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  alphaThreshold: number,
): RasterBounds | null {
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
  return maximumX < minimumX
    ? null
    : {
        x: minimumX,
        y: minimumY,
        width: maximumX - minimumX + 1,
        height: maximumY - minimumY + 1,
      };
}

function boundsIou(left: RasterBounds | null, right: RasterBounds | null): number {
  if (!left || !right) return left === right ? 1 : 0;
  const intersectionWidth = Math.max(
    0,
    Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x),
  );
  const intersectionHeight = Math.max(
    0,
    Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y),
  );
  const intersection = intersectionWidth * intersectionHeight;
  const union = left.width * left.height + right.width * right.height - intersection;
  return union > 0 ? intersection / union : 1;
}

function metric(score: number, floor: number): FidelityMetric {
  const bounded = Math.max(0, Math.min(1, score));
  return { score: bounded, raw: bounded, floor, passed: bounded >= floor, applicable: true };
}

export function measurePixelFidelity(
  reference: Uint8ClampedArray,
  candidate: Uint8ClampedArray,
  width: number,
  height: number,
  input: {
    alphaThreshold?: number;
    sourceAspectRatio?: number;
    destinationAspectRatio?: number;
    foregroundSource?: "reference-alpha" | "full-canvas";
  } = {},
): PixelFidelityReport {
  if (reference.length !== candidate.length || reference.length !== width * height * 4) {
    throw new Error("Fidelity buffers must use identical dimensions.");
  }
  const alphaThreshold = Math.max(1, Math.min(255, input.alphaThreshold ?? 128));
  const foregroundSource = input.foregroundSource ?? "full-canvas";
  const stride = Math.max(1, Math.ceil(width * height / 262_144));
  let intersection = 0;
  let union = 0;
  let softIntersection = 0;
  let softUnion = 0;
  let weightedColorError = 0;
  let colorWeight = 0;
  let edgeSimilarity = 0;
  let edgeWeight = 0;
  const luminance = (rgba: Uint8ClampedArray, pixel: number) => {
    const offset = pixel * 4;
    return rgba[offset] * 0.2126 + rgba[offset + 1] * 0.7152 + rgba[offset + 2] * 0.0722;
  };

  for (let pixel = 0; pixel < width * height; pixel += stride) {
    const offset = pixel * 4;
    const referenceAlpha = reference[offset + 3] / 255;
    const candidateAlpha = candidate[offset + 3] / 255;
    const referenceVisible = reference[offset + 3] >= alphaThreshold;
    const candidateVisible = candidate[offset + 3] >= alphaThreshold;
    if (referenceVisible && candidateVisible) intersection += 1;
    if (referenceVisible || candidateVisible) union += 1;
    softIntersection += Math.min(referenceAlpha, candidateAlpha);
    softUnion += Math.max(referenceAlpha, candidateAlpha);
    const weight = Math.max(referenceAlpha, candidateAlpha);
    if (weight > 0) {
      const red = reference[offset] - candidate[offset];
      const green = reference[offset + 1] - candidate[offset + 1];
      const blue = reference[offset + 2] - candidate[offset + 2];
      weightedColorError +=
        (red * red * 0.2126 + green * green * 0.7152 + blue * blue * 0.0722) * weight;
      colorWeight += weight;
    }
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (x + 1 < width && y + 1 < height) {
      const referenceGradient =
        Math.abs(luminance(reference, pixel + 1) - luminance(reference, pixel)) +
        Math.abs(luminance(reference, pixel + width) - luminance(reference, pixel));
      const candidateGradient =
        Math.abs(luminance(candidate, pixel + 1) - luminance(candidate, pixel)) +
        Math.abs(luminance(candidate, pixel + width) - luminance(candidate, pixel));
      edgeSimilarity += 1 - Math.min(1, Math.abs(referenceGradient - candidateGradient) / 510);
      edgeWeight += 1;
    }
  }

  const sourceAspect = input.sourceAspectRatio ?? width / height;
  const destinationAspect = input.destinationAspectRatio ?? width / height;
  const aspectScore = Math.exp(-Math.abs(Math.log(destinationAspect / sourceAspect)));
  const referenceBounds = alphaBounds(reference, width, height, alphaThreshold);
  const candidateBounds = alphaBounds(candidate, width, height, alphaThreshold);
  const colorRmse = colorWeight > 0 ? Math.sqrt(weightedColorError / colorWeight) : 255;
  const metrics = {
    aspectRatio: metric(aspectScore, 0.999),
    contentBounds: metric(boundsIou(referenceBounds, candidateBounds), 0.98),
    silhouetteIoU: metric(union > 0 ? intersection / union : 0, 0.985),
    alphaIoU: metric(softUnion > 0 ? softIntersection / softUnion : 0, 0.98),
    colorSimilarity: metric(1 - colorRmse / 255, 0.97),
    edgeStructure: metric(edgeWeight > 0 ? edgeSimilarity / edgeWeight : 0, 0.98),
  };
  const weightedMetrics = [
    [metrics.aspectRatio.score ?? 0, 0.05],
    [metrics.contentBounds.score ?? 0, 0.1],
    [metrics.silhouetteIoU.score ?? 0, 0.25],
    [metrics.alphaIoU.score ?? 0, 0.1],
    [metrics.colorSimilarity.score ?? 0, 0.2],
    [metrics.edgeStructure.score ?? 0, 0.3],
  ] as const;
  const achievedScore = Math.exp(
    weightedMetrics.reduce(
      (sum, [score, weight]) => sum + weight * Math.log(Math.max(score, 1e-9)),
      0,
    ),
  );
  const metricsPassed = Object.values(metrics).every((item) => item.passed === true);
  const scorable = foregroundSource === "reference-alpha";
  const verified = scorable && achievedScore >= 0.99 && metricsPassed;
  return {
    schemaVersion: "1.0",
    metricVersion: "pixelforge-fidelity-v1",
    status: verified ? "verified_99" : scorable ? "degraded" : "unscorable",
    targetScore: 0.99,
    achievedScore,
    verified,
    comparison: {
      width,
      height,
      colorSpace: "srgb",
      alphaThreshold,
      foregroundSource,
    },
    metrics,
    invariants: [
      { name: "matching-dimensions", passed: reference.length === candidate.length },
      { name: "non-empty-output", passed: Boolean(candidateBounds) },
      { name: "no-nonuniform-scale", passed: aspectScore >= 0.999 },
    ],
    warnings:
      foregroundSource === "reference-alpha"
        ? verified
          ? []
          : ["The measured result is below the 0.99 verification gate; treat it as best effort."]
        : [
            "Opaque artwork has no verified foreground mask, so silhouette-level 99% fidelity cannot be certified.",
          ],
  };
}

export async function pixelizeRasterDetailed(
  blob: Blob,
  name: string,
  options: PixelizeOptions,
  signal?: AbortSignal,
): Promise<PixelizeDetailedResult> {
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
  const requestedThreshold = Number.isFinite(options.alphaThreshold)
    ? Number(options.alphaThreshold)
    : 8;
  const alphaThreshold = Math.max(0, Math.min(255, requestedThreshold));
  const rendered = renderReference(bitmap, options, alphaThreshold);
  bitmap.close();
  assertActive(signal);

  const imageData = new ImageData(
    new Uint8ClampedArray(rendered.rgba),
    options.width,
    options.height,
  );
  if (options.hardAlpha) {
    for (let offset = 3; offset < imageData.data.length; offset += 4) {
      imageData.data[offset] =
        imageData.data[offset] < alphaThreshold ? 0 : 255;
    }
  }
  const rgba = imageData.data;
  const converted = pixelizeRgba(rgba, options.width, options.height, options);
  assertActive(signal);
  const project = createProject(options.width, options.height, name || "Pixelized image");
  const cel = ensureCel(project, project.activeLayerId, project.activeFrameId);
  cel.pixels = converted.pixels;
  project.palettes = [
    { id: "palette-pixelized", name: "Pixelized", colors: converted.palette },
  ];
  if (converted.palette[0]) project.tool.color = converted.palette[0];
  const fidelity = measurePixelFidelity(
    rendered.rgba,
    pixelsToRgba(converted.pixels),
    options.width,
    options.height,
    {
      alphaThreshold: Math.max(1, alphaThreshold),
      sourceAspectRatio: rendered.source.width / rendered.source.height,
      destinationAspectRatio: rendered.destination.width / rendered.destination.height,
      foregroundSource: rendered.hasMeaningfulAlpha ? "reference-alpha" : "full-canvas",
    },
  );
  return { project, fidelity };
}

export async function pixelizeRaster(
  blob: Blob,
  name: string,
  options: PixelizeOptions,
  signal?: AbortSignal,
): Promise<PixelProject> {
  return (await pixelizeRasterDetailed(blob, name, options, signal)).project;
}

export async function auditRasterFidelity(
  blob: Blob,
  candidate: Uint8ClampedArray,
  width: number,
  height: number,
  options: Omit<PixelizeOptions, "width" | "height"> = {},
  signal?: AbortSignal,
): Promise<PixelFidelityReport> {
  const completeOptions: PixelizeOptions = { width, height, ...options };
  validateTarget(completeOptions);
  assertActive(signal);
  const bitmap = await decodeRaster(blob);
  try {
    validateSourceDimensions(bitmap.width, bitmap.height);
    const alphaThreshold = Math.max(
      0,
      Math.min(255, Number.isFinite(options.alphaThreshold) ? Number(options.alphaThreshold) : 8),
    );
    const rendered = renderReference(bitmap, completeOptions, alphaThreshold);
    assertActive(signal);
    return measurePixelFidelity(rendered.rgba, candidate, width, height, {
      alphaThreshold: Math.max(1, alphaThreshold),
      sourceAspectRatio: rendered.source.width / rendered.source.height,
      destinationAspectRatio: rendered.destination.width / rendered.destination.height,
      foregroundSource: rendered.hasMeaningfulAlpha ? "reference-alpha" : "full-canvas",
    });
  } finally {
    bitmap.close();
  }
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
