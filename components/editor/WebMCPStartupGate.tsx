"use client";

import * as React from "react";
import { CheckCircle2, ExternalLink, Loader2, RefreshCw, Sparkles, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PixelForgeStudio } from "./PixelForgeStudio";

type WebMCPState = "checking" | "ready" | "missing";

type WebMCPDocument = Document & {
  modelContext?: {
    registerTool?: unknown;
  };
};

function hasWebMCPHost(): boolean {
  if (typeof document === "undefined") return false;
  const host = (document as WebMCPDocument).modelContext;
  return typeof host?.registerTool === "function";
}

/**
 * Startup gate for AI/WebMCP workflows.
 * PixelForge checks the browser before the editor can be used. If WebMCP is
 * disabled or unavailable, the user gets a blocking mobile-friendly guide and
 * the page keeps re-checking until a compatible host appears.
 */
export function WebMCPStartupGate() {
  const [state, setState] = React.useState<WebMCPState>("checking");
  const [checkCount, setCheckCount] = React.useState(0);

  const checkWebMCP = React.useCallback(() => {
    const available = hasWebMCPHost();
    setCheckCount((count) => count + 1);
    setState(available ? "ready" : "missing");
    return available;
  }, []);

  React.useEffect(() => {
    let disposed = false;

    const check = () => {
      if (disposed) return;
      checkWebMCP();
    };

    check();
    const timer = window.setInterval(check, 1500);
    const onFocus = () => check();
    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [checkWebMCP]);

  return (
    <>
      <PixelForgeStudio />

      <Dialog open={state !== "ready"} onOpenChange={() => undefined}>
        <DialogContent
          className="w-[calc(100vw-1.5rem)] max-w-[520px] border-white/10 bg-[#11131b] p-5 text-white sm:p-6"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader className="text-left">
            <DialogTitle className="flex items-center gap-2 font-mono text-base sm:text-lg">
              {state === "checking" ? (
                <Loader2 className="size-5 animate-spin text-violet-400" />
              ) : (
                <TriangleAlert className="size-5 text-amber-400" />
              )}
              {state === "checking" ? "Checking WebMCP" : "WebMCP needs to be enabled"}
            </DialogTitle>
            <DialogDescription className="text-sm leading-6 text-slate-400">
              {state === "checking"
                ? "PixelForge is checking whether this browser exposes a compatible WebMCP host before starting."
                : "PixelForge could not detect browser WebMCP. Enable WebMCP in your browser or compatible host, then return to this tab. PixelForge will continue automatically as soon as the connection is detected."}
            </DialogDescription>
          </DialogHeader>

          {state === "missing" && (
            <div className="space-y-3">
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
                <p className="text-sm font-medium text-amber-100">Before starting</p>
                <ol className="mt-2 space-y-2 text-xs leading-5 text-slate-300 sm:text-sm">
                  <li>1. Enable WebMCP in the browser or the compatible AI host you are using.</li>
                  <li>2. Return to this PixelForge tab. A reload may be required by the browser.</li>
                  <li>3. Press “Check again” if the editor does not unlock automatically.</li>
                </ol>
              </div>

              <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-5 text-slate-400">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-violet-300" />
                <p>
                  Detection is based on the browser-native <code className="font-mono text-violet-200">document.modelContext.registerTool</code> API. PixelForge does not guess from browser name alone.
                </p>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <CheckCircle2 className="size-3.5" />
                Automatic checks: {checkCount}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            {state === "missing" && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full border-white/15 sm:w-auto"
                  asChild
                >
                  <a href="https://webmcp.dev" target="_blank" rel="noreferrer">
                    WebMCP guide
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
                <Button
                  type="button"
                  className="h-11 w-full sm:w-auto"
                  onClick={checkWebMCP}
                >
                  <RefreshCw className="size-4" />
                  Check again
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
