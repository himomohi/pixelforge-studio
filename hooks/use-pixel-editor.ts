"use client";

import * as React from "react";
import { createDemoProject } from "@/lib/pixelforge/demo";
import { createProject, ensureCel } from "@/lib/pixelforge/project";
import { projectReducer } from "@/lib/pixelforge/reducer";
import {
  createProjectRepository,
  getActiveProjectKey,
  setActiveProjectKey,
} from "@/lib/pixelforge/storage";
import { curatedPalettes } from "@/lib/pixelforge/palettes";
import type {
  PixelPatch,
  PixelProject,
  ProjectAction,
  ToolId,
} from "@/lib/pixelforge/types";

type HistoryState = {
  past: PixelProject[];
  present: PixelProject;
  future: PixelProject[];
};

function projectCopy(project: PixelProject): PixelProject {
  return JSON.parse(JSON.stringify(project)) as PixelProject;
}

export type NewProjectInput = {
  name: string;
  width: number;
  height: number;
  transparent?: boolean;
  background?: string;
};

export function usePixelEditor() {
  const [history, setHistory] = React.useState<HistoryState>(() => ({
    past: [],
    present: createDemoProject(),
    future: [],
  }));
  const [secondaryColor, setSecondaryColor] = React.useState("#28324a");
  const [zoom, setZoom] = React.useState(16);
  const [showGrid, setShowGrid] = React.useState(true);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);
  const repository = React.useMemo(() => createProjectRepository(), []);
  const project = history.present;
  const projectRef = React.useRef(project);
  const historyRef = React.useRef(history);
  React.useEffect(() => {
    projectRef.current = project;
    historyRef.current = history;
  }, [history, project]);

  const dispatch = React.useCallback((action: ProjectAction, record = true) => {
    const current = historyRef.current;
    const nextProject = projectReducer(current.present, action);
    if (nextProject === current.present) return;
    const nextHistory = record
      ? {
          past: [...current.past.slice(-79), current.present],
          present: nextProject,
          future: [],
        }
      : { ...current, present: nextProject };
    historyRef.current = nextHistory;
    projectRef.current = nextProject;
    setHistory(nextHistory);
  }, []);

  const replaceProject = React.useCallback((next: PixelProject, record = true) => {
    const copy = projectCopy(next);
    const current = historyRef.current;
    const nextHistory = {
      past: record ? [...current.past.slice(-79), current.present] : [],
      present: copy,
      future: [],
    };
    historyRef.current = nextHistory;
    projectRef.current = copy;
    setHistory(nextHistory);
    setActiveProjectKey(next.id);
  }, []);

  const undo = React.useCallback(() => {
    const current = historyRef.current;
    const previous = current.past.at(-1);
    if (!previous) return;
    const nextHistory = {
      past: current.past.slice(0, -1),
      present: previous,
      future: [current.present, ...current.future.slice(0, 79)],
    };
    historyRef.current = nextHistory;
    projectRef.current = previous;
    setHistory(nextHistory);
  }, []);

  const redo = React.useCallback(() => {
    const current = historyRef.current;
    const next = current.future[0];
    if (!next) return;
    const nextHistory = {
      past: [...current.past.slice(-79), current.present],
      present: next,
      future: current.future.slice(1),
    };
    historyRef.current = nextHistory;
    projectRef.current = next;
    setHistory(nextHistory);
  }, []);

  const newProject = React.useCallback(
    (input: NewProjectInput) => {
      const next = createProject(input.width, input.height, input.name);
      const colors = curatedPalettes["PICO-8"];
      next.palettes = [{ id: "palette-pico8", name: "PICO-8", colors }];
      next.tool.color = colors[8];
      if (!input.transparent) {
        ensureCel(next, next.activeLayerId, next.activeFrameId).pixels.fill(
          input.background ?? "#111827",
        );
      }
      replaceProject(next);
      return next;
    },
    [replaceProject],
  );

  const commitPixels = React.useCallback(
    (patches: PixelPatch[]) => {
      if (!patches.length) return;
      const active = projectRef.current;
      dispatch({
        type: "pixels/patch",
        layerId: active.activeLayerId,
        frameId: active.activeFrameId,
        patches,
      });
    },
    [dispatch],
  );

  const setTool = React.useCallback(
    (tool: ToolId) => dispatch({ type: "tool/set", settings: { tool } }, false),
    [dispatch],
  );
  const setPrimaryColor = React.useCallback(
    (color: string) => dispatch({ type: "tool/set", settings: { color } }, false),
    [dispatch],
  );
  const setBrushSize = React.useCallback(
    (size: number) =>
      dispatch(
        { type: "tool/set", settings: { size: Math.max(1, Math.min(8, size)) } },
        false,
      ),
    [dispatch],
  );

  React.useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      const key = getActiveProjectKey();
      if (key) {
        const saved = await repository.load(key);
        if (!cancelled && saved?.project) {
          historyRef.current = { past: [], present: saved.project, future: [] };
          projectRef.current = saved.project;
          setHistory(historyRef.current);
        }
      }
      if (!cancelled) setHydrated(true);
    };
    void restore();
    return () => {
      cancelled = true;
    };
  }, [repository]);

  React.useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      void repository.save(project.id, project);
      setActiveProjectKey(project.id);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [hydrated, project, repository]);

  React.useEffect(() => {
    if (!isPlaying || project.frames.length < 2) return;
    const activeIndex = project.frames.findIndex(
      (frame) => frame.id === project.activeFrameId,
    );
    const activeFrame = project.frames[Math.max(0, activeIndex)];
    const timer = window.setTimeout(() => {
      const next = project.frames[(activeIndex + 1) % project.frames.length];
      if (next) dispatch({ type: "active/set", frameId: next.id }, false);
    }, Math.max(20, activeFrame?.duration ?? 100));
    return () => window.clearTimeout(timer);
  }, [dispatch, isPlaying, project.activeFrameId, project.frames]);

  return {
    project,
    projectRef,
    dispatch,
    replaceProject,
    newProject,
    commitPixels,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    secondaryColor,
    setSecondaryColor,
    setTool,
    setPrimaryColor,
    setBrushSize,
    zoom,
    setZoom: (value: number) => setZoom(Math.max(2, Math.min(32, value))),
    showGrid,
    setShowGrid,
    isPlaying,
    setIsPlaying,
    hydrated,
  };
}
