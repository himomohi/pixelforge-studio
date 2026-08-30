export type RGB = { r: number; g: number; b: number; a?: number };
export const hexToRgb = (hex: string): RGB => { const s = hex.replace("#", ""); const n = s.length === 3 ? s.split("").map(x => x + x).join("") : s; const v = Number.parseInt(n.slice(0, 6), 16); return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255, a: 255 }; };
export const rgbToHex = ({ r, g, b }: RGB): string => `#${[r,g,b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
export const curatedPalettes: Record<string, string[]> = {
  "PICO-8": ["#000000","#1d2b53","#7e2553","#008751","#ab5236","#5f574f","#c2c3c7","#fff1e8","#ff004d","#ffa300","#ffec27","#00e436","#29adff","#83769c","#ff77a8","#ffccaa"],
  "Game Boy": ["#0f380f","#306230","#8bac0f","#9bbc0f"],
  Playdate: ["#000000", "#ffffff"],
  "NES-like": ["#000000","#fcfcfc","#f83800","#ac7c00","#0078f8","#00a800","#b800b8","#6844fc"],
  Synthwave: ["#120458","#321450","#5f1a72","#b42e8a","#f45b9a","#ffb3cb","#fdf6e3"],
  Grayscale: ["#000000","#404040","#808080","#bfbfbf","#ffffff"],
  "Solarized": ["#002b36","#073642","#586e75","#657b83","#839496","#93a1a1","#eee8d5","#fdf6e3"],
  "Pastel Pop": ["#ffadad","#ffd6a5","#fdffb6","#caffbf","#9bf6ff","#a0c4ff","#bdb2ff","#ffc6ff"],
  "Arcade": ["#1a1c2c","#5d275d","#b13e53","#ef7d57","#ffcd75","#a7f070","#38b764","#257179","#29366f","#3b5dc9","#41a6f6","#73eff7"],
};
export function quantizePalette(pixels: Iterable<RGB>, maxColors = 32): string[] { const counts = new Map<string, number>(); for (const p of pixels) { const key = rgbToHex(p); counts.set(key, (counts.get(key) ?? 0) + 1); } return [...counts.entries()].sort((a,b) => b[1]-a[1]).slice(0, Math.max(1, maxColors)).map(([c]) => c); }
