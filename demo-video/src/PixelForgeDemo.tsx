import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const colors = {
  ink: "#f7f5ff",
  muted: "#a9acc1",
  panel: "#151521",
  purple: "#8b5cf6",
  cyan: "#5ee8ff",
  orange: "#ffb454",
};

const fade = (frame: number, duration: number) =>
  interpolate(frame, [0, 14, duration - 14, duration], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const PixelGrid = () => (
  <AbsoluteFill
    style={{
      opacity: 0.2,
      backgroundImage:
        "linear-gradient(rgba(94,232,255,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(94,232,255,.18) 1px, transparent 1px)",
      backgroundSize: "32px 32px",
    }}
  />
);

const Logo = ({small = false}: {small?: boolean}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: small ? 14 : 22,
      fontFamily: "Arial, sans-serif",
      fontWeight: 900,
      letterSpacing: small ? 1 : 3,
      fontSize: small ? 28 : 64,
      color: colors.ink,
    }}
  >
    <div
      style={{
        width: small ? 38 : 72,
        height: small ? 38 : 72,
        background: colors.purple,
        boxShadow: `12px 12px 0 ${colors.cyan}`,
      }}
    />
    PIXELFORGE <span style={{color: colors.cyan}}>STUDIO</span>
  </div>
);

const TitleScene = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const rise = spring({frame, fps, config: {damping: 14, stiffness: 90}});
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at 50% 45%, #252040 0%, #09090f 68%)",
        opacity: fade(frame, 180),
      }}
    >
      <PixelGrid />
      <div
        style={{
          transform: `translateY(${40 - rise * 40}px) scale(${0.94 + rise * 0.06})`,
          textAlign: "center",
        }}
      >
        <Logo />
        <div
          style={{
            marginTop: 56,
            color: colors.ink,
            font: "700 42px Arial, sans-serif",
          }}
        >
          Pixel art, built by people and agents together.
        </div>
        <div
          style={{
            marginTop: 22,
            color: colors.muted,
            font: "500 28px Arial, sans-serif",
          }}
        >
          A browser-native WebMCP creative studio
        </div>
      </div>
    </AbsoluteFill>
  );
};

const BrowserFrame = ({
  src,
  title,
  subtitle,
  accent = colors.cyan,
  duration = 600,
}: {
  src: string;
  title: string;
  subtitle: string;
  accent?: string;
  duration?: number;
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 16, stiffness: 85}});
  return (
    <AbsoluteFill
      style={{
        background: "#09090f",
        opacity: fade(frame, duration),
        padding: "54px 72px 64px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <PixelGrid />
      <div style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
        <Logo small />
        <div style={{color: colors.muted, fontSize: 22}}>pixelforge-studio.appcaster.chatgpt.site</div>
      </div>
      <div style={{display: "flex", gap: 54, flex: 1, alignItems: "center"}}>
        <div style={{width: 520}}>
          <div style={{width: 72, height: 8, background: accent, marginBottom: 30}} />
          <div style={{color: colors.ink, fontWeight: 900, fontSize: 56, lineHeight: 1.05}}>
            {title}
          </div>
          <div style={{color: colors.muted, fontSize: 30, lineHeight: 1.45, marginTop: 28}}>
            {subtitle}
          </div>
        </div>
        <div
          style={{
            flex: 1,
            borderRadius: 18,
            padding: 12,
            background: "linear-gradient(135deg, rgba(139,92,246,.9), rgba(94,232,255,.8))",
            boxShadow: "0 30px 100px rgba(0,0,0,.5)",
            transform: `translateX(${80 - enter * 80}px) scale(${0.96 + enter * 0.04})`,
          }}
        >
          <div style={{borderRadius: 11, overflow: "hidden", background: "#0d0d15"}}>
            <Img src={staticFile(src)} style={{width: "100%", display: "block"}} />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const AgentScene = ({duration = 360}: {duration?: number}) => {
  const frame = useCurrentFrame();
  const actions = [
    "duplicate_project",
    "rename_project",
    "duplicate_frame",
    "add_layer",
    "draw_pixels",
  ];
  return (
    <AbsoluteFill
      style={{
        background: "#09090f",
        opacity: fade(frame, duration),
        padding: "54px 72px 64px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <PixelGrid />
      <div style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
        <Logo small />
          <div style={{color: colors.cyan, fontSize: 22, fontWeight: 800}}>LIVE WEBMCP RESULT</div>
      </div>
      <div style={{display: "flex", gap: 52, alignItems: "center", flex: 1}}>
        <div style={{flex: 1}}>
          <div style={{color: colors.ink, fontWeight: 900, fontSize: 54, lineHeight: 1.08}}>
            One agent workflow. Five exact edits.
          </div>
          <div style={{color: colors.muted, fontSize: 25, lineHeight: 1.4, marginTop: 20}}>
            Project, frame, layer, timing, and pixels update in the live editor — without coordinate guessing.
          </div>
          <div style={{marginTop: 24, display: "grid", gap: 12}}>
            {actions.map((action, index) => {
              const show = interpolate(frame, [40 + index * 28, 58 + index * 28], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              return (
                <div
                  key={action}
                  style={{
                    opacity: show,
                    transform: `translateX(${24 - show * 24}px)`,
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    color: colors.ink,
                    font: "700 25px monospace",
                    background: colors.panel,
                    border: "1px solid #313142",
                    padding: "12px 18px",
                  }}
                >
                  <span style={{color: colors.cyan}}>✓</span> {action}
                </div>
              );
            })}
          </div>
        </div>
        <div
          style={{
            width: 1050,
            border: "12px solid #211f31",
            borderRadius: 18,
            overflow: "hidden",
            boxShadow: "0 30px 100px rgba(0,0,0,.55)",
          }}
        >
          <Img src={staticFile("captures/03-agent-edited.png")} style={{width: "100%", display: "block"}} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const BeforeAfterScene = ({duration = 420}: {duration?: number}) => {
  const frame = useCurrentFrame();
  const reveal = interpolate(frame, [28, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        background: "#09090f",
        opacity: fade(frame, duration),
        padding: "46px 64px 56px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <PixelGrid />
      <div style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
        <Logo small />
        <div style={{color: colors.orange, fontSize: 22, fontWeight: 800}}>SHARED STATE · HUMAN REVIEW</div>
      </div>
      <div style={{color: colors.ink, fontWeight: 900, fontSize: 48, marginTop: 28}}>
        The agent accelerates the work. The artist keeps control.
      </div>
      <div style={{display: "flex", gap: 28, flex: 1, alignItems: "center", marginTop: 20}}>
        {[
          {label: "BEFORE", src: "captures/01-editor.png", accent: colors.muted},
          {label: "AFTER WEBMCP", src: "captures/03-agent-edited.png", accent: colors.cyan},
        ].map((item, index) => (
          <div
            key={item.label}
            style={{
              flex: 1,
              opacity: index === 0 ? 1 : reveal,
              transform: index === 0 ? "none" : `translateX(${32 - reveal * 32}px)`,
            }}
          >
            <div style={{color: item.accent, font: "800 21px Arial", marginBottom: 12}}>{item.label}</div>
            <div
              style={{
                border: `8px solid ${index === 0 ? "#2a2a38" : colors.cyan}`,
                borderRadius: 14,
                overflow: "hidden",
                boxShadow: "0 24px 70px rgba(0,0,0,.5)",
              }}
            >
              <Img src={staticFile(item.src)} style={{width: "100%", display: "block"}} />
            </div>
          </div>
        ))}
      </div>
      <div style={{color: colors.muted, fontSize: 24, textAlign: "center"}}>
        Review every change visually, continue drawing, or undo instantly.
      </div>
    </AbsoluteFill>
  );
};

const EndScene = ({duration = 150}: {duration?: number}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const scale = spring({frame, fps, config: {damping: 18}});
  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(circle at center, #241d3e, #09090f 70%)",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        fontFamily: "Arial, sans-serif",
        opacity: fade(frame, duration),
      }}
    >
      <PixelGrid />
      <div style={{transform: `scale(${0.94 + scale * 0.06})`}}>
        <Logo />
        <div style={{color: colors.ink, fontWeight: 900, fontSize: 52, marginTop: 54}}>
          Build pixels. Animate ideas. Ship anywhere.
        </div>
        <div style={{color: colors.cyan, fontSize: 30, marginTop: 38}}>
          pixelforge-studio.appcaster.chatgpt.site
        </div>
        <div style={{color: colors.muted, fontSize: 24, marginTop: 18}}>
          Open source on GitHub · Built for The WebMCP Challenge
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const PixelForgeDemo = () => (
  <AbsoluteFill>
    <Audio src={staticFile("narration-v2.wav")} />
    <Sequence from={0} durationInFrames={360}>
      <AgentScene duration={360} />
    </Sequence>
    <Sequence from={330} durationInFrames={330}>
      <BrowserFrame
        src="captures/01-editor.png"
        title="Built for indie game creators."
        subtitle="Artists keep drawing, palettes, references, layers, animation, undo, and browser-local projects. Agents handle the precise repetition."
        duration={330}
      />
    </Sequence>
    <Sequence from={630} durationInFrames={450}>
      <BrowserFrame
        src="captures/02-webmcp.png"
        title="65 typed tools. Real product concepts."
        subtitle="Bounded schemas expose project state, pixels, frames, layers, reference conversion, fidelity verification, playback, and exports."
        accent={colors.purple}
        duration={450}
      />
    </Sequence>
    <Sequence from={1050} durationInFrames={420}>
      <BeforeAfterScene duration={420} />
    </Sequence>
    <Sequence from={1440} durationInFrames={330}>
      <BrowserFrame
        src="captures/04-export.png"
        title="From precise edits to shippable assets."
        subtitle="Export PNG, animated GIF, sprite sheets with metadata, editable projects, or game-engine-ready bundles."
        accent={colors.orange}
        duration={330}
      />
    </Sequence>
    <Sequence from={1740} durationInFrames={150}>
      <EndScene duration={150} />
    </Sequence>
  </AbsoluteFill>
);
