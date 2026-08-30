import type { Project } from "./types";
import { quantizePalette, type RGB } from "./palettes";

export function validateProject(value: unknown): value is Project {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<Project>;
  const width = p.width; const height = p.height;
  return typeof p.name === "string" && typeof width === "number" && Number.isInteger(width) && width > 0 && typeof height === "number" && Number.isInteger(height) && height > 0 && Array.isArray(p.cels) && p.cels.length > 0 && p.cels.every(c => c && Number.isInteger(c.width) && Number.isInteger(c.height) && Array.isArray(c.pixels));
}
export function importProjectJson(input: string | unknown): Project {
  let value: unknown; try { value = typeof input === "string" ? JSON.parse(input) : input; } catch { throw new Error("Invalid project JSON"); }
  if (!validateProject(value)) throw new Error("Invalid project structure");
  return JSON.parse(JSON.stringify(value)) as Project;
}
export async function importRaster(file: Blob, name = "Imported image"): Promise<Project> {
  if (typeof createImageBitmap !== "function") throw new Error("Raster import is unavailable in this browser");
  const bitmap = await createImageBitmap(file); const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height;
  const context = canvas.getContext("2d", { willReadFrequently: true }); if (!context) throw new Error("Unable to read image pixels");
  context.drawImage(bitmap, 0, 0); bitmap.close(); const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const pixels: number[] = []; const colors: RGB[] = []; for (let i = 0; i < data.length; i += 4) { pixels.push(((data[i + 3] << 24) | (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]) >>> 0); colors.push({ r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] }); }
  return { name, width: canvas.width, height: canvas.height, cels: [{ width: canvas.width, height: canvas.height, pixels }], palette: quantizePalette(colors) };
}
