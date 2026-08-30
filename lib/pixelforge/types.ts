/** JSON-safe project model shared by persistence and import helpers. */
export type PixelCel = { width: number; height: number; pixels: number[] };
export type Project = {
  id?: string;
  name: string;
  width: number;
  height: number;
  cels: PixelCel[];
  [key: string]: unknown;
};
