import {
  exportFramePng,
  exportSpriteSheet,
  sanitizeFilename,
} from "./export";
import type { PixelProject } from "./types";

export type GameExportEngine =
  | "universal"
  | "unity"
  | "godot"
  | "phaser"
  | "unreal"
  | "libgdx"
  | "gamemaker"
  | "rpg-maker"
  | "love2d";

export interface GameBundleOptions {
  engine?: GameExportEngine;
  scale?: number;
  columns?: number;
  gap?: number;
  includeFrameSequence?: boolean;
}

type ZipEntry = { name: string; bytes: Uint8Array };

const encoder = new TextEncoder();

function u16(value: number): Uint8Array {
  return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff);
}

function u32(value: number): Uint8Array {
  return Uint8Array.of(
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  );
}

function join(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

let crcTable: Uint32Array | null = null;

function table(): Uint32Array {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    crcTable[index] = value >>> 0;
  }
  return crcTable;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  const lookup = table();
  for (const byte of bytes) {
    crc = lookup[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

function textEntry(name: string, text: string): ZipEntry {
  return { name, bytes: encoder.encode(text) };
}

export function createStoredZip(entries: ZipEntry[]): Blob {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name.replace(/\\/g, "/"));
    const crc = crc32(entry.bytes);
    const local = join([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(entry.bytes.length),
      u32(entry.bytes.length),
      u16(name.length),
      u16(0),
      name,
      entry.bytes,
    ]);
    localParts.push(local);
    centralParts.push(
      join([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(entry.bytes.length),
        u32(entry.bytes.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name,
      ]),
    );
    offset += local.length;
  }
  const central = join(centralParts);
  const end = join([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(central.length),
    u32(offset),
    u16(0),
  ]);
  const archive = join([...localParts, central, end]);
  return new Blob([
    archive.buffer.slice(
      archive.byteOffset,
      archive.byteOffset + archive.byteLength,
    ) as ArrayBuffer,
  ], {
    type: "application/zip",
  });
}

function atlasJson(
  project: PixelProject,
  image: string,
  frames: Array<{
    index: number;
    id: string;
    duration: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }>,
  scale: number,
) {
  const base = sanitizeFilename(project.name);
  return {
    meta: {
      app: "PixelForge Studio",
      image,
      format: "RGBA8888",
      scale: String(scale),
      logicalSize: { width: project.width, height: project.height },
      pivot: project.animation?.pivot ?? {
        x: project.width / 2,
        y: project.height - 1,
        preset: "bottom-center",
      },
    },
    frames: Object.fromEntries(
      frames.map((frame) => [
        `${base}_${String(frame.index).padStart(3, "0")}`,
        {
          frame: {
            x: frame.x,
            y: frame.y,
            w: frame.width,
            h: frame.height,
          },
          rotated: false,
          trimmed: false,
          duration: frame.duration,
          sourceSize: { w: frame.width, h: frame.height },
          spriteSourceSize: {
            x: 0,
            y: 0,
            w: frame.width,
            h: frame.height,
          },
        },
      ]),
    ),
    animations: Object.fromEntries(
      (project.animation?.tags ?? [
        {
          name: "default",
          from: 0,
          to: Math.max(0, project.frames.length - 1),
          loop: true,
        },
      ]).map((tag) => [
        tag.name,
        frames
          .slice(tag.from, tag.to + 1)
          .map(
            (frame) =>
              `${base}_${String(frame.index).padStart(3, "0")}`,
          ),
      ]),
    ),
  };
}

function godotResource(
  project: PixelProject,
  image: string,
  frames: ReturnType<typeof atlasJson>["frames"],
): string {
  const entries = Object.entries(frames);
  const resources = entries
    .map(
      ([, value], index) =>
        `[sub_resource type="AtlasTexture" id="AtlasTexture_${index}"]\n` +
        `atlas = ExtResource("1")\nregion = Rect2(${value.frame.x}, ${value.frame.y}, ${value.frame.w}, ${value.frame.h})`,
    )
    .join("\n\n");
  const animationFrames = entries
    .map(
      ([, value], index) =>
        `{"duration": ${Math.max(0.02, value.duration / 1000)}, "texture": SubResource("AtlasTexture_${index}")}`,
    )
    .join(", ");
  const fps = project.animation?.fps ?? Math.round(
    1000 / Math.max(20, project.frames[0]?.duration ?? 100),
  );
  return `[gd_resource type="SpriteFrames" load_steps=${entries.length + 2} format=3]\n\n` +
    `[ext_resource type="Texture2D" path="res://${image}" id="1"]\n\n` +
    `${resources}\n\n[resource]\nanimations = [{"frames": [${animationFrames}], "loop": true, "name": &"default", "speed": ${fps}}]\n`;
}

function libgdxAtlas(
  image: string,
  frames: ReturnType<typeof atlasJson>["frames"],
): string {
  return `${image}\nsize: 0,0\nformat: RGBA8888\nfilter: Nearest,Nearest\nrepeat: none\n` +
    Object.entries(frames)
      .map(
        ([name, value], index) =>
          `${name}\n  rotate: false\n  xy: ${value.frame.x}, ${value.frame.y}\n  size: ${value.frame.w}, ${value.frame.h}\n  orig: ${value.frame.w}, ${value.frame.h}\n  offset: 0, 0\n  index: ${index}`,
      )
      .join("\n");
}

function readme(
  project: PixelProject,
  engine: GameExportEngine,
  scale: number,
): string {
  return `# ${project.name}\n\n` +
    `PixelForge Studio game-ready export.\n\n` +
    `- Logical canvas: ${project.width}x${project.height}\n` +
    `- Frames: ${project.frames.length}\n` +
    `- Layers: ${project.layers.length}\n` +
    `- Export scale: ${scale}x\n` +
    `- Engine preset: ${engine}\n` +
    `- Alpha: transparent RGBA\n` +
    `- Texture filtering: use Nearest/Point and disable smoothing\n\n` +
    `## Files\n\n` +
    `- images/sprite-sheet.png: packed animation frames\n` +
    `- metadata/atlas.json: TexturePacker/Phaser-compatible atlas data\n` +
    `- metadata/manifest.json: project, pivot, timing, and tag metadata\n` +
    `- frames/: individual PNG frames when included\n` +
    `- engine/: import helpers for common game engines\n\n` +
    `Keep the sheet unfiltered and use integer display scaling for crisp pixels.\n`;
}

export async function exportUniversalGameBundle(
  project: PixelProject,
  options: GameBundleOptions = {},
): Promise<{ blob: Blob; filename: string; files: string[] }> {
  const engine = options.engine ?? "universal";
  const scale = Math.max(1, Math.min(16, Math.floor(options.scale ?? 1)));
  const output = await exportSpriteSheet(project, {
    layout: "grid",
    columns: options.columns,
    gap: options.gap,
    scale,
  });
  const base = sanitizeFilename(project.name);
  const sheetName = "sprite-sheet.png";
  const atlas = atlasJson(project, sheetName, output.metadata.frames, scale);
  const manifest = {
    app: "PixelForge Studio",
    project: {
      id: project.id,
      name: project.name,
      width: project.width,
      height: project.height,
      frames: project.frames.map((frame) => ({
        index: frame.index,
        id: frame.id,
        duration: frame.duration,
      })),
      layers: project.layers.map((layer) => ({
        id: layer.id,
        name: layer.name,
        opacity: layer.opacity,
        visible: layer.visible,
      })),
      animation: project.animation ?? null,
    },
    export: { engine, scale, alpha: true, filtering: "nearest" },
  };
  const entries: ZipEntry[] = [
    { name: "images/" + sheetName, bytes: await blobBytes(output.png) },
    textEntry("metadata/atlas.json", JSON.stringify(atlas, null, 2)),
    textEntry("metadata/manifest.json", JSON.stringify(manifest, null, 2)),
    textEntry("README.md", readme(project, engine, scale)),
    textEntry(
      "engine/unity-import.json",
      JSON.stringify(
        {
          textureType: "Sprite",
          spriteMode: "Multiple",
          filterMode: "Point",
          compression: "None",
          pixelsPerUnit: project.width,
          pivot: project.animation?.pivot ?? { preset: "bottom-center" },
          frames: output.metadata.frames,
        },
        null,
        2,
      ),
    ),
    textEntry(
      "engine/godot-sprite-frames.tres",
      godotResource(project, "../../images/" + sheetName, atlas.frames),
    ),
    textEntry(
      "engine/phaser-atlas.json",
      JSON.stringify(atlas, null, 2),
    ),
    textEntry(
      "engine/libgdx.atlas",
      libgdxAtlas("../../images/" + sheetName, atlas.frames),
    ),
    textEntry(
      "engine/love2d-frames.lua",
      `return {\n${output.metadata.frames
        .map(
          (frame) =>
            `  { x = ${frame.x}, y = ${frame.y}, w = ${frame.width}, h = ${frame.height}, duration = ${frame.duration / 1000} },`,
        )
        .join("\n")}\n}\n`,
    ),
    textEntry(
      "engine/unreal-paper2d.csv",
      [
        "Name,X,Y,Width,Height,DurationMs",
        ...output.metadata.frames.map(
          (frame) =>
            `${base}_${frame.index},${frame.x},${frame.y},${frame.width},${frame.height},${frame.duration}`,
        ),
      ].join("\n"),
    ),
  ];
  if (options.includeFrameSequence !== false) {
    for (const frame of project.frames) {
      const frameBlob = await exportFramePng(project, frame.id, scale);
      entries.push({
        name: `frames/${base}_${String(frame.index).padStart(3, "0")}.png`,
        bytes: await blobBytes(frameBlob),
      });
    }
  }
  return {
    blob: createStoredZip(entries),
    filename: `${base}-${engine}-game-bundle.zip`,
    files: entries.map((entry) => entry.name),
  };
}
