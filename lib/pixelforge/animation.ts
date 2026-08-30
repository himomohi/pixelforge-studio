import { pixelizeRaster, type PixelizeOptions } from "./pixelize";
import { createProject } from "./project";
import { MAX_PROJECT_PIXEL_CELLS } from "./presets";
import type { Cel, Frame, Layer, PixelProject } from "./types";

export interface AnimationSequenceOptions extends PixelizeOptions {
  duration?: number;
  fps?: number;
  loopMode?: "loop" | "once" | "ping-pong";
  separateLayers?: boolean;
  sourceNames?: string[];
}

function uid(prefix: string, index: number): string {
  return `${prefix}-${Date.now().toString(36)}-${index}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

function paletteFromFrames(projects: PixelProject[], limit: number): string[] {
  const frequency = new Map<string, number>();
  for (const project of projects) {
    const cel = Object.values(project.cels)[0];
    for (const color of cel?.pixels ?? []) {
      if (!color) continue;
      frequency.set(color, (frequency.get(color) ?? 0) + 1);
    }
  }
  return [...frequency.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, Math.max(2, Math.min(256, limit)))
    .map(([color]) => color);
}

function commonPixels(frames: string[][]): string[] {
  const first = frames[0] ?? [];
  return first.map((color, index) => {
    if (!color) return "";
    return frames.every((frame) => frame[index] === color) ? color : "";
  });
}

export async function createAnimationProjectFromRasters(
  blobs: Blob[],
  name: string,
  options: AnimationSequenceOptions,
  signal?: AbortSignal,
): Promise<PixelProject> {
  if (blobs.length < 2) {
    throw new Error("Select at least two images to create an animation.");
  }
  if (blobs.length > 120) {
    throw new Error("Animation imports support up to 120 source images.");
  }
  const duration = Math.max(
    20,
    Math.min(
      10_000,
      Math.round(options.duration ?? 1000 / Math.max(1, options.fps ?? 8)),
    ),
  );
  const projects: PixelProject[] = [];
  for (let index = 0; index < blobs.length; index += 1) {
    if (signal?.aborted) {
      throw new DOMException("Animation conversion was cancelled.", "AbortError");
    }
    projects.push(
      await pixelizeRaster(
        blobs[index],
        `${name} ${index + 1}`,
        options,
        signal,
      ),
    );
  }

  const framePixels = projects.map(
    (project) => Object.values(project.cels)[0]?.pixels ?? [],
  );
  const requestedSplit = options.separateLayers !== false;
  const splitLayers =
    requestedSplit &&
    options.width *
      options.height *
      blobs.length *
      2 <=
      MAX_PROJECT_PIXEL_CELLS;
  const base = createProject(options.width, options.height, name);
  const frames: Frame[] = framePixels.map((_, index) => ({
    id: uid("frame", index),
    index,
    duration,
  }));
  const layers: Layer[] = splitLayers
    ? [
        {
          id: uid("layer-common", 0),
          name: "Common body",
          visible: true,
          locked: false,
          opacity: 1,
          frameIds: [],
        },
        {
          id: uid("layer-motion", 1),
          name: "Motion details",
          visible: true,
          locked: false,
          opacity: 1,
          frameIds: [],
        },
      ]
    : [
        {
          id: uid("layer-frames", 0),
          name: "Animation frames",
          visible: true,
          locked: false,
          opacity: 1,
          frameIds: [],
        },
      ];
  const cels: Record<string, Cel> = {};
  const common = splitLayers ? commonPixels(framePixels) : [];

  frames.forEach((frame, frameIndex) => {
    layers.forEach((layer, layerIndex) => {
      const celId = uid("cel", frameIndex * layers.length + layerIndex);
      const source = framePixels[frameIndex] ?? [];
      const pixels =
        splitLayers && layerIndex === 0
          ? [...common]
          : splitLayers
            ? source.map((color, index) => (common[index] ? "" : color))
            : [...source];
      cels[celId] = {
        id: celId,
        frameId: frame.id,
        layerId: layer.id,
        pixels,
        duration,
      };
      layer.frameIds.push(celId);
    });
  });

  const fps = Math.max(1, Math.min(60, Math.round(1000 / duration)));
  base.frames = frames;
  base.layers = layers;
  base.cels = cels;
  base.activeFrameId = frames[0].id;
  base.activeLayerId = layers.at(-1)?.id ?? layers[0].id;
  base.palettes = [
    {
      id: "palette-animation",
      name: "Animation source",
      colors: paletteFromFrames(projects, options.maxColors ?? 32),
    },
  ];
  base.tool.color = base.palettes[0]?.colors[0] ?? "#ffffff";
  base.onionSkin.enabled = true;
  base.animation = {
    fps,
    loopMode: options.loopMode ?? "loop",
    pivot: {
      x: options.width / 2,
      y: Math.max(0, options.height - 1),
      preset: "bottom-center",
    },
    tags: [
      {
        name: "default",
        from: 0,
        to: frames.length - 1,
        loop: (options.loopMode ?? "loop") !== "once",
      },
    ],
    sourceNames: options.sourceNames?.slice(0, blobs.length),
    generatedFromSequence: true,
    layerSeparation: splitLayers ? "common-motion" : "none",
  };
  return base;
}
