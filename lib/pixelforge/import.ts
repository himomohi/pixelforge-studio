import { createProject, ensureCel, validateProject } from "./project";
import { quantizePalette, type RGB } from "./palettes";
import { MAX_CANVAS_DIMENSION } from "./presets";
import type { PixelProject } from "./types";

function cloneProject(project: PixelProject): PixelProject {
  return JSON.parse(JSON.stringify(project)) as PixelProject;
}

export function importProjectJson(input: string | unknown): PixelProject {
  let value: unknown;
  try {
    value = typeof input === "string" ? JSON.parse(input) : input;
  } catch {
    throw new Error("This file does not contain valid JSON.");
  }

  if (!validateProject(value)) {
    throw new Error("This is not a valid PixelForge project.");
  }

  const project = cloneProject(value);
  const expectedPixels = project.width * project.height;
  const celsValid = Object.values(project.cels).every(
    (cel) =>
      Array.isArray(cel.pixels) &&
      cel.pixels.length === expectedPixels &&
      project.layers.some((layer) => layer.id === cel.layerId) &&
      project.frames.some((frame) => frame.id === cel.frameId),
  );

  if (!celsValid) {
    throw new Error("The project contains damaged or mismatched cels.");
  }
  return project;
}

function byteToHex(value: number): string {
  return value.toString(16).padStart(2, "0");
}

export async function importRaster(
  file: Blob,
  name = "Imported image",
): Promise<PixelProject> {
  if (typeof document === "undefined" || typeof createImageBitmap !== "function") {
    throw new Error("Raster import is unavailable in this browser.");
  }

  const bitmap = await createImageBitmap(file);
  if (bitmap.width < 1 || bitmap.height < 1 || bitmap.width > MAX_CANVAS_DIMENSION || bitmap.height > MAX_CANVAS_DIMENSION) {
    bitmap.close();
    throw new Error(`Images must be between 1×1 and ${MAX_CANVAS_DIMENSION}×${MAX_CANVAS_DIMENSION} pixels.`);
  }

  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    bitmap.close();
    throw new Error("Unable to read image pixels.");
  }

  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const colors: RGB[] = [];
  const pixels: string[] = [];

  for (let offset = 0; offset < data.length; offset += 4) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const alpha = data[offset + 3];
    colors.push({ r: red, g: green, b: blue, a: alpha });
    pixels.push(
      alpha === 0
        ? ""
        : `#${byteToHex(red)}${byteToHex(green)}${byteToHex(blue)}${
            alpha === 255 ? "" : byteToHex(alpha)
          }`,
    );
  }

  const project = createProject(canvas.width, canvas.height, name);
  const cel = ensureCel(project, project.activeLayerId, project.activeFrameId);
  cel.pixels = pixels;
  const palette = quantizePalette(colors.filter((color) => color.a !== 0), 32);
  project.palettes = [{ id: "palette-imported", name: "Imported", colors: palette }];
  if (palette[0]) project.tool.color = palette[0];
  return project;
}
