"use client";

import * as React from "react";
import {
  ChevronsLeft,
  FlipHorizontal2,
  FlipVertical2,
  Grip,
  Image as ImageIcon,
  ImagePlus,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  PinOff,
  PictureInPicture2,
  Scan,
  Sparkles,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { usePanelRef } from "react-resizable-panels";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import type { ReferenceImageController } from "@/hooks/use-reference-image";
import {
  REFERENCE_MAX_PANEL_SIZE,
  REFERENCE_MAX_ZOOM,
  REFERENCE_MIN_OVERLAY_HEIGHT,
  REFERENCE_MIN_OVERLAY_WIDTH,
  REFERENCE_MIN_PANEL_SIZE,
  REFERENCE_MIN_ZOOM,
} from "@/lib/pixelforge/reference-image";
import type {
  ReferenceImageMode,
  ReferenceOverlayRect,
} from "@/lib/pixelforge/types";

type SharedProps = {
  reference: ReferenceImageController;
  onRequestUpload: () => void;
  onClear: () => void;
  onPixelize: () => void;
  onModeChange: (mode: ReferenceImageMode) => void;
};

type PanelProps = SharedProps & {
  variant: "split" | "overlay" | "mobile";
  onCollapse?: () => void;
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function useDesktopLayout(): boolean {
  const [desktop, setDesktop] = React.useState(false);
  React.useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return desktop;
}

function SmallButton({
  active,
  className = "",
  ...props
}: React.ComponentProps<typeof Button> & { active?: boolean }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={
        "h-7 w-7 border text-[#aeb8ca] " +
        (active
          ? "border-[#b8f34a]/55 bg-[#b8f34a]/12 text-[#d9ff8d]"
          : "border-[#30394c] bg-[#111722] hover:bg-[#1b2230]") +
        " " +
        className
      }
      {...props}
    />
  );
}

function ModeControl({
  mode,
  onChange,
}: {
  mode: ReferenceImageMode;
  onChange: (mode: ReferenceImageMode) => void;
}) {
  return (
    <div
      className="grid grid-cols-3 rounded border border-[#30394c] bg-[#0a0e15] p-0.5"
      aria-label="Reference display mode"
      data-reference-mode={mode}
    >
      {(
        [
          ["split", PanelLeftOpen, "Split"],
          ["overlay", PictureInPicture2, "Float"],
          ["hidden", ChevronsLeft, "Hide"],
        ] as const
      ).map(([value, Icon, label]) => (
        <button
          key={value}
          type="button"
          className={
            "flex h-7 items-center justify-center gap-1 rounded px-2 text-[9px] font-semibold transition-colors " +
            (mode === value
              ? "bg-[#253044] text-white shadow-sm"
              : "text-[#778297] hover:text-white")
          }
          aria-pressed={mode === value}
          onClick={() => onChange(value)}
        >
          <Icon className="size-3" />
          {label}
        </button>
      ))}
    </div>
  );
}

function ReferenceImageStage({
  reference,
  onRequestUpload,
}: Pick<SharedProps, "reference" | "onRequestUpload">) {
  const { state } = reference;
  const hasImage = Boolean(state.assetId);
  const imageStyle: React.CSSProperties = {
    opacity: state.opacity,
    transform: `scaleX(${state.flipX ? -1 : 1}) scaleY(${
      state.flipY ? -1 : 1
    })`,
    transformOrigin: "center",
  };

  return (
    <div
      className="pixel-scrollbar relative min-h-0 flex-1 overflow-auto bg-[#070a10]"
      data-reference-viewport
      aria-label="Reference image viewport"
    >
      <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(45deg,#121824_25%,transparent_25%),linear-gradient(-45deg,#121824_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#121824_75%),linear-gradient(-45deg,transparent_75%,#121824_75%)] [background-position:0_0,0_6px,6px_-6px,-6px_0] [background-size:12px_12px]" />
      {reference.loading ? (
        <div className="relative flex h-full min-h-48 items-center justify-center text-[10px] text-[#788398]">
          Loading local reference…
        </div>
      ) : reference.imageUrl ? (
        state.fit ? (
          <div className="relative flex h-full min-h-48 w-full items-center justify-center p-4">
            {/* Object URLs are generated only from validated browser-local files. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={reference.imageUrl}
              alt={state.fileName ?? "Reference image"}
              draggable={false}
              className="pointer-events-none max-h-full max-w-full select-none object-contain"
              style={imageStyle}
              data-reference-image
            />
          </div>
        ) : (
          <div className="relative flex min-h-full min-w-full items-center justify-center p-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={reference.imageUrl}
              alt={state.fileName ?? "Reference image"}
              draggable={false}
              className="pointer-events-none max-w-none shrink-0 select-none"
              style={{
                ...imageStyle,
                width: Math.max(1, (state.width ?? 1) * state.zoom),
                height: Math.max(1, (state.height ?? 1) * state.zoom),
              }}
              data-reference-image
            />
          </div>
        )
      ) : hasImage ? (
        <div className="relative flex h-full min-h-48 flex-col items-center justify-center gap-3 p-6 text-center">
          <ImageIcon className="size-8 text-amber-300/70" />
          <div>
            <p className="text-xs font-semibold text-[#d7deea]">
              Source unavailable on this device
            </p>
            <p className="mt-1 max-w-56 text-[10px] leading-4 text-[#788398]">
              The project kept its view settings, but the original image never
              leaves browser-local storage.
            </p>
          </div>
          <Button
            size="sm"
            className="h-8 bg-[#b8f34a] text-[10px] text-[#111608] hover:bg-[#c9ff62]"
            onClick={onRequestUpload}
          >
            <ImagePlus className="size-3.5" />
            Choose again
          </Button>
        </div>
      ) : (
        <div className="relative flex h-full min-h-48 flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="grid size-12 place-items-center rounded border border-dashed border-[#536079] bg-[#121824]">
            <ImagePlus className="size-5 text-[#9ba7bc]" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#d7deea]">
              Add a reference image
            </p>
            <p className="mt-1 max-w-56 text-[10px] leading-4 text-[#788398]">
              PNG, JPEG, or WebP · up to 16 MB · processed only in this browser
            </p>
          </div>
          <Button
            size="sm"
            className="h-8 bg-[#b8f34a] text-[10px] text-[#111608] hover:bg-[#c9ff62]"
            onClick={onRequestUpload}
            data-reference-upload
          >
            <ImagePlus className="size-3.5" />
            Upload image
          </Button>
        </div>
      )}
    </div>
  );
}

function ReferencePanelContent({
  reference,
  onRequestUpload,
  onClear,
  onPixelize,
  onModeChange,
  onCollapse,
  variant,
}: PanelProps) {
  const { state } = reference;
  const hasImage = Boolean(state.assetId);
  const isSplit = variant === "split";
  const showMode = variant !== "mobile";
  const setZoom = (value: number) =>
    reference.update({
      zoom: clamp(value, REFERENCE_MIN_ZOOM, REFERENCE_MAX_ZOOM),
      fit: false,
    });

  return (
    <section
      className="flex h-full min-h-0 flex-col overflow-hidden bg-[#0c1018]"
      aria-label="Reference image"
      data-reference-panel={variant}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerMove={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <div className="border-b border-[#273044] bg-[#111722] px-2.5 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="grid size-7 shrink-0 place-items-center rounded border border-[#39445a] bg-[#171e2a]">
            <ImageIcon className="size-3.5 text-[#66d9ef]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-semibold text-[#e7ebf2]">
              {state.fileName ?? "Reference"}
            </p>
            <p className="mt-0.5 truncate font-mono text-[8px] text-[#69758a]">
              {hasImage
                ? `${state.width ?? "?"}×${state.height ?? "?"} · ${formatBytes(
                    state.sizeBytes,
                  )}`
                : "Browser-local source"}
            </p>
          </div>
          <SmallButton
            aria-label={hasImage ? "Replace reference image" : "Upload reference image"}
            title={hasImage ? "Replace" : "Upload"}
            onClick={onRequestUpload}
          >
            <ImagePlus className="size-3.5" />
          </SmallButton>
          <SmallButton
            aria-label="Remove reference image"
            title="Remove"
            disabled={!hasImage}
            onClick={onClear}
          >
            <Trash2 className="size-3.5" />
          </SmallButton>
          {isSplit && onCollapse ? (
            <SmallButton
              aria-label="Collapse reference panel"
              title="Collapse panel"
              onClick={onCollapse}
            >
              <PanelLeftClose className="size-3.5" />
            </SmallButton>
          ) : null}
        </div>
        {showMode ? (
          <div className="mt-2">
            <ModeControl mode={state.mode} onChange={onModeChange} />
          </div>
        ) : null}
      </div>

      <ReferenceImageStage
        reference={reference}
        onRequestUpload={onRequestUpload}
      />

      <div className="space-y-2.5 border-t border-[#273044] bg-[#0f141e] p-2.5">
        <div className="flex items-center gap-1.5">
          <SmallButton
            aria-label="Zoom reference out"
            title="Zoom out"
            disabled={!hasImage}
            onClick={() => setZoom(state.zoom / 1.25)}
          >
            <ZoomOut className="size-3.5" />
          </SmallButton>
          <span className="min-w-11 text-center font-mono text-[9px] text-[#aeb8ca]">
            {state.fit ? "FIT" : `${Math.round(state.zoom * 100)}%`}
          </span>
          <SmallButton
            aria-label="Zoom reference in"
            title="Zoom in"
            disabled={!hasImage}
            onClick={() => setZoom(state.zoom * 1.25)}
          >
            <ZoomIn className="size-3.5" />
          </SmallButton>
          <Button
            variant="outline"
            size="sm"
            className="ml-1 h-7 border-[#30394c] bg-[#111722] px-2 text-[9px]"
            disabled={!hasImage}
            onClick={() => reference.update({ fit: true })}
          >
            <Scan className="size-3" />
            Fit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 border-[#30394c] bg-[#111722] px-2 text-[9px]"
            disabled={!hasImage}
            onClick={() => reference.update({ fit: false, zoom: 1 })}
          >
            100%
          </Button>
          <div className="ml-auto flex gap-1">
            <SmallButton
              active={state.flipX}
              aria-label="Flip reference horizontally"
              aria-pressed={state.flipX}
              title="Flip horizontally"
              disabled={!hasImage}
              onClick={() => reference.update({ flipX: !state.flipX })}
            >
              <FlipHorizontal2 className="size-3.5" />
            </SmallButton>
            <SmallButton
              active={state.flipY}
              aria-label="Flip reference vertically"
              aria-pressed={state.flipY}
              title="Flip vertically"
              disabled={!hasImage}
              onClick={() => reference.update({ flipY: !state.flipY })}
            >
              <FlipVertical2 className="size-3.5" />
            </SmallButton>
          </div>
        </div>

        <label className="grid grid-cols-[62px_1fr_34px] items-center gap-2 text-[9px] text-[#7f8a9e]">
          Opacity
          <Slider
            min={0}
            max={100}
            step={1}
            value={[Math.round(state.opacity * 100)]}
            disabled={!hasImage}
            onValueChange={(values) =>
              reference.update({ opacity: (values[0] ?? 100) / 100 })
            }
            aria-label="Reference image opacity"
          />
          <span className="text-right font-mono text-[#aeb8ca]">
            {Math.round(state.opacity * 100)}%
          </span>
        </label>

        {isSplit ? (
          <label className="grid grid-cols-[62px_1fr_34px] items-center gap-2 text-[9px] text-[#7f8a9e]">
            Panel
            <Slider
              min={REFERENCE_MIN_PANEL_SIZE}
              max={REFERENCE_MAX_PANEL_SIZE}
              step={1}
              value={[state.panelSize]}
              onValueChange={(values) =>
                reference.update({
                  panelSize: Math.round(values[0] ?? state.panelSize),
                })
              }
              aria-label="Reference panel width"
            />
            <span className="text-right font-mono text-[#aeb8ca]">
              {state.panelSize}
            </span>
          </label>
        ) : null}

        <Button
          variant="outline"
          size="sm"
          className="h-8 w-full border-[#3a465d] bg-[#161d29] text-[10px] text-[#dfe5ef] hover:border-[#b8f34a]/45 hover:bg-[#202a38]"
          disabled={!reference.assetAvailable}
          onClick={onPixelize}
          data-reference-pixelize
        >
          <Sparkles className="size-3.5 text-[#b8f34a]" />
          Convert this reference to pixels
        </Button>
      </div>
    </section>
  );
}

type FloatingProps = SharedProps & {
  workspaceRef: React.RefObject<HTMLDivElement | null>;
};

type PointerSession = {
  kind: "move" | "resize";
  pointerId: number;
  startX: number;
  startY: number;
  rect: ReferenceOverlayRect;
};

function FloatingReference({
  reference,
  workspaceRef,
  onRequestUpload,
  onClear,
  onPixelize,
  onModeChange,
}: FloatingProps) {
  const sessionRef = React.useRef<PointerSession | null>(null);
  const { state } = reference;

  const start = (
    kind: PointerSession["kind"],
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    if (state.overlayPinned) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    sessionRef.current = {
      kind,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      rect: { ...state.overlayRect },
    };
  };

  const move = (event: React.PointerEvent<HTMLButtonElement>) => {
    const session = sessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const bounds = workspaceRef.current?.getBoundingClientRect();
    const deltaX = event.clientX - session.startX;
    const deltaY = event.clientY - session.startY;
    let next: ReferenceOverlayRect;
    if (session.kind === "move") {
      const maxX = Math.max(0, (bounds?.width ?? 4096) - session.rect.width);
      const maxY = Math.max(0, (bounds?.height ?? 4096) - session.rect.height);
      next = {
        ...session.rect,
        x: Math.round(clamp(session.rect.x + deltaX, 0, maxX)),
        y: Math.round(clamp(session.rect.y + deltaY, 0, maxY)),
      };
    } else {
      const maxWidth = Math.max(
        REFERENCE_MIN_OVERLAY_WIDTH,
        (bounds?.width ?? 1600) - session.rect.x,
      );
      const maxHeight = Math.max(
        REFERENCE_MIN_OVERLAY_HEIGHT,
        (bounds?.height ?? 1200) - session.rect.y,
      );
      next = {
        ...session.rect,
        width: Math.round(
          clamp(
            session.rect.width + deltaX,
            REFERENCE_MIN_OVERLAY_WIDTH,
            maxWidth,
          ),
        ),
        height: Math.round(
          clamp(
            session.rect.height + deltaY,
            REFERENCE_MIN_OVERLAY_HEIGHT,
            maxHeight,
          ),
        ),
      };
    }
    reference.update({ overlayRect: next });
  };

  const finish = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (sessionRef.current?.pointerId === event.pointerId) {
      sessionRef.current = null;
      event.stopPropagation();
    }
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-30 hidden md:block">
      <div
        className="pointer-events-auto absolute flex min-h-0 flex-col overflow-hidden rounded border border-[#43516a] bg-[#0c1018] shadow-[0_22px_70px_rgba(0,0,0,.62),0_0_0_1px_rgba(184,243,74,.08)]"
        style={{
          left: state.overlayRect.x,
          top: state.overlayRect.y,
          width: state.overlayRect.width,
          height: state.overlayRect.height,
          maxWidth: "calc(100% - 8px)",
          maxHeight: "calc(100% - 8px)",
        }}
        data-reference-overlay
        onPointerDown={(event) => event.stopPropagation()}
        onPointerMove={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
      >
        <div className="flex h-8 shrink-0 items-center gap-1 border-b border-[#313b4f] bg-[#171e2b] px-1.5">
          <button
            type="button"
            className={
              "flex h-6 min-w-0 flex-1 items-center gap-1.5 rounded px-1.5 text-left text-[9px] text-[#9da8ba] " +
              (state.overlayPinned
                ? "cursor-default"
                : "cursor-move hover:bg-white/[.04]")
            }
            aria-label="Move floating reference"
            onPointerDown={(event) => start("move", event)}
            onPointerMove={move}
            onPointerUp={finish}
            onPointerCancel={finish}
          >
            <Grip className="size-3 shrink-0" />
            <span className="truncate">{state.fileName ?? "Floating reference"}</span>
          </button>
          <SmallButton
            active={state.overlayPinned}
            aria-label={state.overlayPinned ? "Unpin floating reference" : "Pin floating reference"}
            aria-pressed={state.overlayPinned}
            title={state.overlayPinned ? "Unpin" : "Pin"}
            onClick={() =>
              reference.update({ overlayPinned: !state.overlayPinned })
            }
          >
            {state.overlayPinned ? (
              <Pin className="size-3.5" />
            ) : (
              <PinOff className="size-3.5" />
            )}
          </SmallButton>
        </div>
        <div className="min-h-0 flex-1">
          <ReferencePanelContent
            reference={reference}
            onRequestUpload={onRequestUpload}
            onClear={onClear}
            onPixelize={onPixelize}
            onModeChange={onModeChange}
            variant="overlay"
          />
        </div>
        {!state.overlayPinned ? (
          <button
            type="button"
            className="absolute bottom-0 right-0 z-10 grid size-6 cursor-nwse-resize place-items-center text-[#7f8a9e] hover:text-white"
            aria-label="Resize floating reference"
            onPointerDown={(event) => start("resize", event)}
            onPointerMove={move}
            onPointerUp={finish}
            onPointerCancel={finish}
          >
            <span className="size-3 border-b-2 border-r-2 border-current" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function ReferenceWorkspace({
  reference,
  onRequestUpload,
  onClear,
  onPixelize,
  onModeChange,
  children,
}: SharedProps & { children: React.ReactNode }) {
  const panelRef = usePanelRef();
  const workspaceRef = React.useRef<HTMLDivElement>(null);
  const desktop = useDesktopLayout();
  const { state } = reference;
  const splitVisible = state.mode === "split" && !state.collapsed;

  React.useEffect(() => {
    if (!splitVisible) return;
    panelRef.current?.resize(state.panelSize);
  }, [panelRef, splitVisible, state.panelSize]);

  return (
    <div
      ref={workspaceRef}
      className="relative h-full min-h-0 w-full overflow-hidden"
      data-reference-workspace
    >
      {desktop ? (
        <div className="h-full min-h-0">
        {splitVisible ? (
          <ResizablePanelGroup orientation="horizontal" className="min-h-0">
            <ResizablePanel
              id="reference-image-panel"
              panelRef={panelRef}
              defaultSize={state.panelSize}
              minSize={REFERENCE_MIN_PANEL_SIZE}
              maxSize={REFERENCE_MAX_PANEL_SIZE}
              groupResizeBehavior="preserve-pixel-size"
              onResize={(size, _id, previous) => {
                if (
                  previous &&
                  Math.abs(size.inPixels - state.panelSize) >= 1
                ) {
                  reference.update({
                    panelSize: Math.round(size.inPixels),
                  });
                }
              }}
            >
              <ReferencePanelContent
                reference={reference}
                onRequestUpload={onRequestUpload}
                onClear={onClear}
                onPixelize={onPixelize}
                onModeChange={onModeChange}
                onCollapse={() => reference.update({ collapsed: true })}
                variant="split"
              />
            </ResizablePanel>
            <ResizableHandle
              withHandle
              className="z-20 w-px bg-[#354056] after:w-3 hover:bg-[#b8f34a]/60"
            />
            <ResizablePanel id="pixel-canvas-panel" minSize="30%">
              {children}
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div className="relative h-full min-h-0">{children}</div>
        )}
        </div>
      ) : (
        <div className="h-full min-h-0">{children}</div>
      )}

      {desktop && state.mode === "overlay" ? (
        <FloatingReference
          reference={reference}
          workspaceRef={workspaceRef}
          onRequestUpload={onRequestUpload}
          onClear={onClear}
          onPixelize={onPixelize}
          onModeChange={onModeChange}
        />
      ) : null}

      {desktop && state.mode === "split" && state.collapsed ? (
        <button
          type="button"
          className="absolute left-2 top-2 z-20 hidden h-8 items-center gap-1.5 rounded border border-[#3c4960] bg-[#151c28]/95 px-2 text-[9px] text-[#d5dce8] shadow-lg backdrop-blur md:flex"
          onClick={() => reference.update({ collapsed: false })}
          data-reference-expand
        >
          <PanelLeftOpen className="size-3.5 text-[#66d9ef]" />
          Reference
        </button>
      ) : null}
    </div>
  );
}

export function MobileReferenceViewer({
  open,
  onOpenChange,
  fullscreen,
  onFullscreenChange,
  reference,
  onRequestUpload,
  onClear,
  onPixelize,
  onModeChange,
}: SharedProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fullscreen: boolean;
  onFullscreenChange: (fullscreen: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={
          "mobile-reference-panel flex max-h-none flex-col border-[#344057] bg-[#0c1018] p-0 text-white transition-[height] " +
          (fullscreen ? "h-[100dvh]" : "h-[76dvh]")
        }
        data-reference-mobile
        onPointerDown={(event) => event.stopPropagation()}
        onPointerMove={(event) => event.stopPropagation()}
      >
        <SheetHeader className="flex-row items-center gap-3 border-b border-[#2a3345] pr-12 text-left">
          <div className="min-w-0 flex-1">
            <SheetTitle className="font-mono text-sm">
              Reference image
            </SheetTitle>
            <SheetDescription className="text-xs">
              A local viewer that stays separate from canvas input
            </SheetDescription>
          </div>
          <Button
            variant="outline"
            size="icon-sm"
            className="border-[#354158] bg-[#151c28]"
            aria-label={fullscreen ? "Use bottom sheet" : "Use full screen"}
            onClick={() => onFullscreenChange(!fullscreen)}
          >
            {fullscreen ? (
              <Minimize2 className="size-4" />
            ) : (
              <Maximize2 className="size-4" />
            )}
          </Button>
        </SheetHeader>
        <div className="min-h-0 flex-1">
          <ReferencePanelContent
            reference={reference}
            onRequestUpload={onRequestUpload}
            onClear={onClear}
            onPixelize={onPixelize}
            onModeChange={onModeChange}
            variant="mobile"
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
