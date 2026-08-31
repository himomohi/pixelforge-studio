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

const AgentScene = () => {
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
        opacity: fade(frame, 600),
        padding: "54px 72px 64px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <PixelGrid />
      <div style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
        <Logo small />
        <div style={{color: colors.cyan, fontSize: 22, fontWeight: 800}}>LIVE WEBMCP WORKFLOW</div>
      </div>
      <div style={{display: "flex", gap: 52, alignItems: "center", flex: 1}}>
        <div style={{flex: 1}}>
          <div style={{color: colors.ink, fontWeight: 900, fontSize: 54, lineHeight: 1.08}}>
            The agent edits the same project.
          </div>
          <div style={{marginTop: 30, display: "grid", gap: 14}}>
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
                    padding: "15px 18px",
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

const EndScene = () => {
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
        opacity: fade(frame, 255),
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
    <Audio src={staticFile("narration.wav")} />
    <Sequence from={0} durationInFrames={180}>
      <TitleScene />
    </Sequence>
    <Sequence from={165} durationInFrames={600}>
      <BrowserFrame
        src="captures/01-editor.png"
        title="A complete pixel-art studio in the browser."
        subtitle="Draw, animate, manage layers and palettes, work from references, and export production-ready assets."
      />
    </Sequence>
    <Sequence from={735} durationInFrames={600}>
      <BrowserFrame
        src="captures/02-webmcp.png"
        title="65 typed tools. Zero UI guessing."
        subtitle="WebMCP exposes project, drawing, animation, reference, verification, and export workflows directly to compatible agents."
        accent={colors.purple}
      />
    </Sequence>
    <Sequence from={1305} durationInFrames={600}>
      <AgentScene />
    </Sequence>
    <Sequence from={1875} durationInFrames={300}>
      <BrowserFrame
        src="captures/04-export.png"
        title="The human stays in control."
        subtitle="Review every change, keep editing visually, undo at any time, then export PNG, GIF, sprite sheets, projects, or game bundles."
        accent={colors.orange}
        duration={300}
      />
    </Sequence>
    <Sequence from={2145} durationInFrames={255}>
      <EndScene />
    </Sequence>
  </AbsoluteFill>
);
