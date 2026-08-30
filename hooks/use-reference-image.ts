"use client";

import * as React from "react";
import { inspectRaster, imageDataUrlToBlob } from "@/lib/pixelforge/pixelize";
import {
  assertReferenceBlob,
  normalizeReferenceImageState,
} from "@/lib/pixelforge/reference-image";
import {
  createReferenceAssetRepository,
  type ReferenceAssetRecord,
} from "@/lib/pixelforge/reference-storage";
import type { ReferenceImageState } from "@/lib/pixelforge/types";

type RuntimeAsset = ReferenceAssetRecord & { url: string };

export type ReferenceImageSnapshot = ReferenceImageState & {
  hasImage: boolean;
  assetAvailable: boolean;
  source: "browser-local" | null;
};

export type ReferenceImageController = {
  state: ReferenceImageState;
  imageUrl: string | null;
  assetAvailable: boolean;
  loading: boolean;
  update: (
    patch:
      | Partial<ReferenceImageState>
      | ((current: ReferenceImageState) => Partial<ReferenceImageState>),
  ) => ReferenceImageState;
  setFromBlob: (
    blob: Blob,
    fileName: string,
    signal?: AbortSignal,
  ) => Promise<ReferenceImageSnapshot>;
  setFromDataUrl: (
    dataUrl: string,
    fileName?: string,
    signal?: AbortSignal,
  ) => Promise<ReferenceImageSnapshot>;
  clear: () => ReferenceImageSnapshot;
  getBlob: () => Blob | null;
  getFile: () => File | null;
  getState: () => ReferenceImageState;
  getSnapshot: () => ReferenceImageSnapshot;
};

function assertActive(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("Reference image operation cancelled.", "AbortError");
  }
}

function assetId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return "reference-" + crypto.randomUUID();
  }
  return (
    "reference-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 10)
  );
}

export function useReferenceImage(
  projectState: ReferenceImageState | null | undefined,
  onStateChange: (state: ReferenceImageState) => void,
): ReferenceImageController {
  const state = normalizeReferenceImageState(projectState);
  const stateRef = React.useRef(state);
  const onStateChangeRef = React.useRef(onStateChange);
  const repository = React.useMemo(() => createReferenceAssetRepository(), []);
  const [asset, setAsset] = React.useState<RuntimeAsset | null>(null);
  const assetRef = React.useRef<RuntimeAsset | null>(null);
  const [loading, setLoading] = React.useState(Boolean(state.assetId));

  React.useEffect(() => {
    stateRef.current = state;
  }, [state]);

  React.useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  const installAsset = React.useCallback((record: ReferenceAssetRecord | null) => {
    const previous = assetRef.current;
    if (previous && previous.id !== record?.id) {
      URL.revokeObjectURL(previous.url);
    }
    const next = record
      ? {
          ...record,
          url: URL.createObjectURL(record.blob),
        }
      : null;
    if (previous?.id === next?.id) {
      URL.revokeObjectURL(next?.url ?? "");
      return previous;
    }
    assetRef.current = next;
    setAsset(next);
    return next;
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      await Promise.resolve();
      if (cancelled) return;
      const id = state.assetId;
      if (!id) {
        installAsset(null);
        setLoading(false);
        return;
      }
      if (assetRef.current?.id === id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const record = await repository.load(id);
      if (cancelled) return;
      installAsset(record);
      setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [installAsset, repository, state.assetId]);

  React.useEffect(
    () => () => {
      if (assetRef.current) URL.revokeObjectURL(assetRef.current.url);
    },
    [],
  );

  const update = React.useCallback<ReferenceImageController["update"]>(
    (patch) => {
      const current = stateRef.current;
      const changes = typeof patch === "function" ? patch(current) : patch;
      const next = normalizeReferenceImageState({
        ...current,
        ...changes,
        overlayRect: changes.overlayRect ?? current.overlayRect,
      });
      stateRef.current = next;
      onStateChangeRef.current(next);
      return next;
    },
    [],
  );

  const getSnapshot = React.useCallback((): ReferenceImageSnapshot => {
    const current = stateRef.current;
    const available =
      Boolean(current.assetId) && assetRef.current?.id === current.assetId;
    return {
      ...current,
      overlayRect: { ...current.overlayRect },
      hasImage: Boolean(current.assetId),
      assetAvailable: available,
      source: current.assetId ? "browser-local" : null,
    };
  }, []);

  const getState = React.useCallback(
    (): ReferenceImageState => ({
      ...stateRef.current,
      overlayRect: { ...stateRef.current.overlayRect },
    }),
    [],
  );

  const setFromBlob = React.useCallback(
    async (
      blob: Blob,
      fileName: string,
      signal?: AbortSignal,
    ): Promise<ReferenceImageSnapshot> => {
      assertActive(signal);
      assertReferenceBlob(blob);
      const dimensions = await inspectRaster(blob);
      assertActive(signal);
      const id = assetId();
      const record: ReferenceAssetRecord = {
        id,
        blob,
        createdAt: Date.now(),
      };
      await repository.save(record);
      assertActive(signal);
      const previousId = stateRef.current.assetId;
      installAsset(record);
      update({
        assetId: id,
        fileName: fileName.trim().slice(0, 180) || "Reference image",
        mimeType: blob.type.toLowerCase(),
        sizeBytes: blob.size,
        width: dimensions.width,
        height: dimensions.height,
        updatedAt: record.createdAt,
        mode:
          stateRef.current.mode === "hidden"
            ? "split"
            : stateRef.current.mode,
        collapsed: false,
        zoom: 1,
        fit: true,
      });
      if (previousId && previousId !== id) {
        void repository.delete(previousId);
      }
      return getSnapshot();
    },
    [getSnapshot, installAsset, repository, update],
  );

  const setFromDataUrl = React.useCallback(
    async (
      dataUrl: string,
      fileName = "Reference image",
      signal?: AbortSignal,
    ) => {
      assertActive(signal);
      const blob = imageDataUrlToBlob(dataUrl);
      assertActive(signal);
      return setFromBlob(blob, fileName, signal);
    },
    [setFromBlob],
  );

  const clear = React.useCallback(() => {
    const previousId = stateRef.current.assetId;
    installAsset(null);
    update({
      assetId: null,
      fileName: null,
      mimeType: null,
      sizeBytes: null,
      width: null,
      height: null,
      updatedAt: null,
      zoom: 1,
      fit: true,
      flipX: false,
      flipY: false,
    });
    if (previousId) void repository.delete(previousId);
    return getSnapshot();
  }, [getSnapshot, installAsset, repository, update]);

  const getBlob = React.useCallback(() => {
    const current = stateRef.current;
    return assetRef.current?.id === current.assetId
      ? assetRef.current.blob
      : null;
  }, []);

  const getFile = React.useCallback(() => {
    const blob = getBlob();
    const current = stateRef.current;
    if (!blob) return null;
    return new File([blob], current.fileName ?? "reference-image", {
      type: blob.type,
      lastModified: current.updatedAt ?? Date.now(),
    });
  }, [getBlob]);

  return {
    state,
    imageUrl: asset?.url ?? null,
    assetAvailable:
      Boolean(state.assetId) && asset?.id === state.assetId,
    loading,
    update,
    setFromBlob,
    setFromDataUrl,
    clear,
    getBlob,
    getFile,
    getState,
    getSnapshot,
  };
}
