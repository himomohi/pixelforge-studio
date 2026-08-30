import type {
  ReferenceImageMode,
  ReferenceImageState,
  ReferenceOverlayRect,
} from "./types";

export const REFERENCE_MAX_BYTES = 16 * 1024 * 1024;
export const REFERENCE_MAX_DIMENSION = 8192;
export const REFERENCE_MAX_PIXELS = 67_108_864;
export const REFERENCE_MIN_ZOOM = 0.1;
export const REFERENCE_MAX_ZOOM = 8;
export const REFERENCE_MIN_PANEL_SIZE = 220;
export const REFERENCE_MAX_PANEL_SIZE = 720;
export const REFERENCE_MIN_OVERLAY_WIDTH = 260;
export const REFERENCE_MIN_OVERLAY_HEIGHT = 220;
export const REFERENCE_MAX_OVERLAY_WIDTH = 1600;
export const REFERENCE_MAX_OVERLAY_HEIGHT = 1200;

const allowedMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const allowedModes = new Set<ReferenceImageMode>([
  "split",
  "overlay",
  "hidden",
]);

export const DEFAULT_REFERENCE_IMAGE_STATE: ReferenceImageState = {
  version: 1,
  assetId: null,
  fileName: null,
  mimeType: null,
  sizeBytes: null,
  width: null,
  height: null,
  updatedAt: null,
  mode: "split",
  zoom: 1,
  fit: true,
  opacity: 1,
  flipX: false,
  flipY: false,
  panelSize: 320,
  collapsed: false,
  overlayRect: {
    x: 28,
    y: 28,
    width: 380,
    height: 340,
  },
  overlayPinned: false,
};

function finite(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function normalizeReferenceOverlayRect(
  value: Partial<ReferenceOverlayRect> | null | undefined,
): ReferenceOverlayRect {
  const fallback = DEFAULT_REFERENCE_IMAGE_STATE.overlayRect;
  return {
    x: Math.round(clamp(finite(value?.x, fallback.x), 0, 4096)),
    y: Math.round(clamp(finite(value?.y, fallback.y), 0, 4096)),
    width: Math.round(
      clamp(
        finite(value?.width, fallback.width),
        REFERENCE_MIN_OVERLAY_WIDTH,
        REFERENCE_MAX_OVERLAY_WIDTH,
      ),
    ),
    height: Math.round(
      clamp(
        finite(value?.height, fallback.height),
        REFERENCE_MIN_OVERLAY_HEIGHT,
        REFERENCE_MAX_OVERLAY_HEIGHT,
      ),
    ),
  };
}

export function normalizeReferenceImageState(
  value?: Partial<ReferenceImageState> | null,
): ReferenceImageState {
  const assetId = nullableString(value?.assetId);
  const mode = allowedModes.has(value?.mode as ReferenceImageMode)
    ? (value?.mode as ReferenceImageMode)
    : DEFAULT_REFERENCE_IMAGE_STATE.mode;
  const state: ReferenceImageState = {
    ...DEFAULT_REFERENCE_IMAGE_STATE,
    version: 1,
    assetId,
    fileName: assetId ? nullableString(value?.fileName) : null,
    mimeType: assetId ? nullableString(value?.mimeType) : null,
    sizeBytes: assetId ? nullableNumber(value?.sizeBytes) : null,
    width: assetId ? nullableNumber(value?.width) : null,
    height: assetId ? nullableNumber(value?.height) : null,
    updatedAt: assetId ? nullableNumber(value?.updatedAt) : null,
    mode,
    zoom: clamp(
      finite(value?.zoom, DEFAULT_REFERENCE_IMAGE_STATE.zoom),
      REFERENCE_MIN_ZOOM,
      REFERENCE_MAX_ZOOM,
    ),
    fit:
      typeof value?.fit === "boolean"
        ? value.fit
        : DEFAULT_REFERENCE_IMAGE_STATE.fit,
    opacity: clamp(
      finite(value?.opacity, DEFAULT_REFERENCE_IMAGE_STATE.opacity),
      0,
      1,
    ),
    flipX: value?.flipX === true,
    flipY: value?.flipY === true,
    panelSize: Math.round(
      clamp(
        finite(value?.panelSize, DEFAULT_REFERENCE_IMAGE_STATE.panelSize),
        REFERENCE_MIN_PANEL_SIZE,
        REFERENCE_MAX_PANEL_SIZE,
      ),
    ),
    collapsed: value?.collapsed === true,
    overlayRect: normalizeReferenceOverlayRect(value?.overlayRect),
    overlayPinned: value?.overlayPinned === true,
  };
  return state;
}

export function validateReferenceImageState(
  value: unknown,
): value is ReferenceImageState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const state = value as ReferenceImageState;
  if (state.version !== 1 || !allowedModes.has(state.mode)) return false;
  if (
    state.assetId !== null &&
    (typeof state.assetId !== "string" || state.assetId.length < 1)
  ) {
    return false;
  }
  const nullableStrings = [state.fileName, state.mimeType];
  if (
    nullableStrings.some(
      (item) => item !== null && typeof item !== "string",
    )
  ) {
    return false;
  }
  const nullableNumbers = [
    state.sizeBytes,
    state.width,
    state.height,
    state.updatedAt,
  ];
  if (
    nullableNumbers.some(
      (item) => item !== null && !Number.isFinite(item),
    )
  ) {
    return false;
  }
  if (
    !Number.isFinite(state.zoom) ||
    state.zoom < REFERENCE_MIN_ZOOM ||
    state.zoom > REFERENCE_MAX_ZOOM ||
    !Number.isFinite(state.opacity) ||
    state.opacity < 0 ||
    state.opacity > 1 ||
    !Number.isInteger(state.panelSize) ||
    state.panelSize < REFERENCE_MIN_PANEL_SIZE ||
    state.panelSize > REFERENCE_MAX_PANEL_SIZE ||
    typeof state.fit !== "boolean" ||
    typeof state.flipX !== "boolean" ||
    typeof state.flipY !== "boolean" ||
    typeof state.collapsed !== "boolean" ||
    typeof state.overlayPinned !== "boolean"
  ) {
    return false;
  }
  const rect = state.overlayRect;
  if (
    !rect ||
    !Number.isInteger(rect.x) ||
    !Number.isInteger(rect.y) ||
    !Number.isInteger(rect.width) ||
    !Number.isInteger(rect.height) ||
    rect.x < 0 ||
    rect.y < 0 ||
    rect.x > 4096 ||
    rect.y > 4096 ||
    rect.width < REFERENCE_MIN_OVERLAY_WIDTH ||
    rect.width > REFERENCE_MAX_OVERLAY_WIDTH ||
    rect.height < REFERENCE_MIN_OVERLAY_HEIGHT ||
    rect.height > REFERENCE_MAX_OVERLAY_HEIGHT
  ) {
    return false;
  }
  if (state.assetId === null) {
    return (
      state.fileName === null &&
      state.mimeType === null &&
      state.sizeBytes === null &&
      state.width === null &&
      state.height === null &&
      state.updatedAt === null
    );
  }
  return (
    typeof state.fileName === "string" &&
    allowedMimeTypes.has(state.mimeType ?? "") &&
    typeof state.sizeBytes === "number" &&
    state.sizeBytes > 0 &&
    state.sizeBytes <= REFERENCE_MAX_BYTES &&
    typeof state.width === "number" &&
    Number.isInteger(state.width) &&
    state.width > 0 &&
    state.width <= REFERENCE_MAX_DIMENSION &&
    typeof state.height === "number" &&
    Number.isInteger(state.height) &&
    state.height > 0 &&
    state.height <= REFERENCE_MAX_DIMENSION &&
    state.width * state.height <= REFERENCE_MAX_PIXELS &&
    typeof state.updatedAt === "number"
  );
}

export function assertReferenceMode(
  value: unknown,
): asserts value is ReferenceImageMode {
  if (!allowedModes.has(value as ReferenceImageMode)) {
    throw new Error("Reference mode must be split, overlay, or hidden.");
  }
}

export function assertReferenceZoom(value: unknown): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < REFERENCE_MIN_ZOOM ||
    value > REFERENCE_MAX_ZOOM
  ) {
    throw new Error("Reference zoom must be between 0.1 and 8.");
  }
}

export function assertReferenceOpacity(
  value: unknown,
): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    throw new Error("Reference opacity must be between 0 and 1.");
  }
}

export function assertReferencePanelSize(
  value: unknown,
): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < REFERENCE_MIN_PANEL_SIZE ||
    value > REFERENCE_MAX_PANEL_SIZE
  ) {
    throw new Error(
      `Reference panel width must be between ${REFERENCE_MIN_PANEL_SIZE} and ${REFERENCE_MAX_PANEL_SIZE} pixels.`,
    );
  }
}

export function assertReferenceOverlayRect(
  value: unknown,
): asserts value is ReferenceOverlayRect {
  const rect = value as ReferenceOverlayRect;
  if (
    !rect ||
    !Number.isInteger(rect.x) ||
    !Number.isInteger(rect.y) ||
    rect.x < 0 ||
    rect.y < 0 ||
    rect.x > 4096 ||
    rect.y > 4096 ||
    !Number.isInteger(rect.width) ||
    rect.width < REFERENCE_MIN_OVERLAY_WIDTH ||
    rect.width > REFERENCE_MAX_OVERLAY_WIDTH ||
    !Number.isInteger(rect.height) ||
    rect.height < REFERENCE_MIN_OVERLAY_HEIGHT ||
    rect.height > REFERENCE_MAX_OVERLAY_HEIGHT
  ) {
    throw new Error(
      `Overlay rectangles require x/y from 0 to 4096, width from ${REFERENCE_MIN_OVERLAY_WIDTH} to ${REFERENCE_MAX_OVERLAY_WIDTH}, and height from ${REFERENCE_MIN_OVERLAY_HEIGHT} to ${REFERENCE_MAX_OVERLAY_HEIGHT}.`,
    );
  }
}

export function assertReferenceBlob(blob: Blob): void {
  if (!allowedMimeTypes.has(blob.type.toLowerCase())) {
    throw new Error("Reference images must be PNG, JPEG, or WebP.");
  }
  if (blob.size < 1 || blob.size > REFERENCE_MAX_BYTES) {
    throw new Error("Reference images must be 16 MB or smaller.");
  }
}
