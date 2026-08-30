import { createProject } from "./project";
import { projectReducer } from "./reducer";
import type { PixelPatch, PixelProject } from "./types";

const palette = [
  "#0b0f1a",
  "#28324a",
  "#66d9ef",
  "#b8f34a",
  "#ff9f68",
  "#f4f7fb",
  "#c792ea",
  "#ff5d73",
];

function rectangle(
  patches: PixelPatch[],
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
) {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      patches.push({ x: column, y: row, color });
    }
  }
}

function runnerFrame(pose: 0 | 1 | 2 | 3): PixelPatch[] {
  const patches: PixelPatch[] = [];
  const bob = pose === 1 || pose === 3 ? 1 : 0;
  rectangle(patches, 11, 7 + bob, 10, 2, palette[1]);
  rectangle(patches, 10, 9 + bob, 12, 7, palette[4]);
  rectangle(patches, 12, 10 + bob, 8, 3, palette[2]);
  rectangle(patches, 13, 11 + bob, 5, 1, palette[5]);
  rectangle(patches, 12, 16 + bob, 8, 7, palette[3]);
  rectangle(patches, 10, 17 + bob, 2, 5, palette[4]);
  rectangle(patches, 20, 17 + bob, 2, 5, palette[4]);
  rectangle(patches, 13, 18 + bob, 2, 2, palette[1]);
  rectangle(patches, 17, 18 + bob, 2, 2, palette[1]);

  if (pose === 0) {
    rectangle(patches, 11, 23, 4, 3, palette[2]);
    rectangle(patches, 18, 22, 3, 5, palette[2]);
  } else if (pose === 1) {
    rectangle(patches, 13, 23, 3, 5, palette[2]);
    rectangle(patches, 17, 24, 5, 3, palette[2]);
  } else if (pose === 2) {
    rectangle(patches, 12, 22, 3, 5, palette[2]);
    rectangle(patches, 18, 23, 4, 3, palette[2]);
  } else {
    rectangle(patches, 10, 24, 5, 3, palette[2]);
    rectangle(patches, 17, 23, 3, 5, palette[2]);
  }
  return patches;
}

export function createDemoProject(): PixelProject {
  let project = createProject(32, 32, "Neon Runner");
  project.palettes = [{ id: "palette-neon", name: "Neon Runner", colors: palette }];
  project.tool.color = palette[3];
  project.onionSkin.enabled = true;
  project.frames[0].duration = 130;

  for (let index = 1; index < 4; index += 1) {
    project = projectReducer(project, { type: "frame/add", duration: 130 });
  }
  project.frames.forEach((frame, index) => {
    project = projectReducer(project, {
      type: "pixels/patch",
      layerId: project.layers[0].id,
      frameId: frame.id,
      patches: runnerFrame(index as 0 | 1 | 2 | 3),
    });
  });
  project.activeFrameId = project.frames[0].id;
  return project;
}
