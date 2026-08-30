export const MAX_CANVAS_DIMENSION = 4096;
export const MAX_PROJECT_PIXEL_CELLS = 16_777_216;

export type ProjectPresetCategory =
  | "sprites"
  | "tiles-ui"
  | "web-games"
  | "classic-systems";

export interface ProjectPreset {
  id: string;
  label: string;
  width: number;
  height: number;
  category: ProjectPresetCategory;
  description: string;
  paletteName?: string;
  reference?: string;
}

export const projectPresetCategories: Array<{
  id: ProjectPresetCategory;
  label: string;
}> = [
  { id: "sprites", label: "Sprites" },
  { id: "tiles-ui", label: "Tiles & UI" },
  { id: "web-games", label: "Web games" },
  { id: "classic-systems", label: "Classic" },
];

export const projectPresets: ProjectPreset[] = [
  {
    id: "sprite-micro-8",
    label: "Micro sprite",
    width: 8,
    height: 8,
    category: "sprites",
    description: "Cursor, pickup, or fantasy-console tile",
    paletteName: "PICO-8",
  },
  {
    id: "sprite-tiny-16",
    label: "Tiny character",
    width: 16,
    height: 16,
    category: "sprites",
    description: "Compact RPG, platformer, and game-jam sprite",
    paletteName: "Arcade",
  },
  {
    id: "sprite-indie-32",
    label: "Indie character",
    width: 32,
    height: 32,
    category: "sprites",
    description: "General-purpose character and prop canvas",
    paletteName: "Arcade",
  },
  {
    id: "sprite-detailed-48",
    label: "Detailed character",
    width: 48,
    height: 48,
    category: "sprites",
    description: "More room for faces, clothing, and animation",
    paletteName: "Arcade",
  },
  {
    id: "sprite-large-64",
    label: "Large character",
    width: 64,
    height: 64,
    category: "sprites",
    description: "Hero, boss, or fighting-game sprite",
    paletteName: "Arcade",
  },
  {
    id: "portrait-96",
    label: "Dialogue portrait",
    width: 96,
    height: 96,
    category: "sprites",
    description: "Expressive UI portrait with a controlled palette",
    paletteName: "Pastel Pop",
  },
  {
    id: "portrait-128",
    label: "Detailed portrait",
    width: 128,
    height: 128,
    category: "sprites",
    description: "High-detail character art and inventory cards",
    paletteName: "Pastel Pop",
  },
  {
    id: "tile-8",
    label: "8 px tile",
    width: 8,
    height: 8,
    category: "tiles-ui",
    description: "Hardware-style micro tile and bitmap glyph",
    paletteName: "PICO-8",
  },
  {
    id: "tile-16",
    label: "16 px tile",
    width: 16,
    height: 16,
    category: "tiles-ui",
    description: "Standard terrain, item, and UI icon grid",
    paletteName: "Arcade",
  },
  {
    id: "tile-32",
    label: "32 px tile",
    width: 32,
    height: 32,
    category: "tiles-ui",
    description: "Detailed terrain and modern pixel-game UI",
    paletteName: "Arcade",
  },
  {
    id: "icon-48",
    label: "Web game icon",
    width: 48,
    height: 48,
    category: "tiles-ui",
    description: "Inventory, toolbar, and HUD icon",
    paletteName: "Arcade",
  },
  {
    id: "pwa-icon-192",
    label: "PWA icon",
    width: 192,
    height: 192,
    category: "tiles-ui",
    description: "Installable web-game icon master",
    paletteName: "Arcade",
  },
  {
    id: "pwa-icon-512",
    label: "PWA icon large",
    width: 512,
    height: 512,
    category: "tiles-ui",
    description: "Large app icon and store-art source",
    paletteName: "Arcade",
  },
  {
    id: "web-retro-320x180",
    label: "Retro 16:9",
    width: 320,
    height: 180,
    category: "web-games",
    description: "Godot and Unity-friendly integer-scale baseline",
    paletteName: "Arcade",
    reference: "Godot and Unity pixel-perfect documentation",
  },
  {
    id: "web-retro-384x216",
    label: "Wide pixel scene",
    width: 384,
    height: 216,
    category: "web-games",
    description: "16:9 scene with extra environment detail",
    paletteName: "Arcade",
  },
  {
    id: "web-indie-480x270",
    label: "Indie 16:9",
    width: 480,
    height: 270,
    category: "web-games",
    description: "Balanced browser viewport for richer scenes",
    paletteName: "Arcade",
  },
  {
    id: "web-detailed-640x360",
    label: "Detailed 16:9",
    width: 640,
    height: 360,
    category: "web-games",
    description: "Fine-detail pixel backgrounds and cutscenes",
    paletteName: "Arcade",
  },
  {
    id: "pico8-screen",
    label: "PICO-8 screen",
    width: 128,
    height: 128,
    category: "classic-systems",
    description: "Native fantasy-console display",
    paletteName: "PICO-8",
    reference: "Lexaloffle PICO-8 manual",
  },
  {
    id: "tic80-screen",
    label: "TIC-80 screen",
    width: 240,
    height: 136,
    category: "classic-systems",
    description: "Native TIC-80 virtual resolution",
    paletteName: "PICO-8",
    reference: "TIC-80 Learn documentation",
  },
  {
    id: "gameboy-screen",
    label: "Game Boy screen",
    width: 160,
    height: 144,
    category: "classic-systems",
    description: "Native handheld LCD canvas",
    paletteName: "Game Boy",
    reference: "Pan Docs graphics specification",
  },
  {
    id: "gba-screen",
    label: "Game Boy Advance",
    width: 240,
    height: 160,
    category: "classic-systems",
    description: "Native GBA display resolution",
    paletteName: "Arcade",
    reference: "Nintendo AGB programming manual",
  },
  {
    id: "nes-frame",
    label: "NES frame",
    width: 256,
    height: 240,
    category: "classic-systems",
    description: "Full PPU picture canvas",
    paletteName: "NES-like",
    reference: "NES technical documentation",
  },
  {
    id: "snes-frame",
    label: "SNES NTSC frame",
    width: 256,
    height: 224,
    category: "classic-systems",
    description: "Common NTSC gameplay viewport",
    paletteName: "Arcade",
    reference: "Nintendo SNES development manual",
  },
  {
    id: "playdate-screen",
    label: "Playdate screen",
    width: 400,
    height: 240,
    category: "classic-systems",
    description: "Native 1-bit handheld display",
    paletteName: "Playdate",
    reference: "Panic Playdate design guide",
  },
];

export function getProjectPreset(id: string): ProjectPreset | undefined {
  return projectPresets.find((preset) => preset.id === id);
}

export function recommendedZoom(width: number, height: number): number {
  const longest = Math.max(width, height);
  if (longest <= 16) return 32;
  if (longest <= 32) return 16;
  if (longest <= 64) return 10;
  if (longest <= 128) return 5;
  if (longest <= 256) return 3;
  if (longest <= 512) return 2;
  return 1;
}
