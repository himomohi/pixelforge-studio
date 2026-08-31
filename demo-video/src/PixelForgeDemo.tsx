import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
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
  purple: "#8b5cf6",
  cyan: "#5ee8ff",
  orange: "#ffb454",
  black: "#09090f",
};

const siteUrl = "pixelforge-studio.appcaster.chatgpt.site";
const githubUrl = "github.com/himomohi/pixelforge-studio";
const cloudflareUrl = "pixelforge-studio.himomohi.workers.dev";

const fade = (frame: number, duration: number) =>
  interpolate(frame, [0, 10, duration - 12, duration], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const PixelGrid = () => (
  <AbsoluteFill
    style={{
      opacity: 0.16,
      backgroundImage:
        "linear-gradient(rgba(94,232,255,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(94,232,255,.18) 1px, transparent 1px)",
      backgroundSize: "32px 32px",
      pointerEvents: "none",
    }}
  />
);

const Brand = ({compact = false}: {compact?: boolean}) => (
  <div
    style={{
      alignItems: "center",
      color: colors.ink,
      display: "flex",
      fontFamily: "Arial, sans-serif",
      fontSize: compact ? 27 : 56,
      fontWeight: 900,
      gap: compact ? 13 : 20,
      letterSpacing: compact ? 1.1 : 2.4,
    }}
  >
    <div
      style={{
        background: colors.purple,
        boxShadow: `${compact ? 7 : 11}px ${compact ? 7 : 11}px 0 ${colors.cyan}`,
        height: compact ? 33 : 62,
        width: compact ? 33 : 62,
      }}
    />
    PIXELFORGE <span style={{color: colors.cyan}}>STUDIO</span>
  </div>
);

const Header = ({tag}: {tag: string}) => (
  <div
    style={{
      alignItems: "center",
      display: "flex",
      justifyContent: "space-between",
      left: 54,
      position: "absolute",
      right: 54,
      top: 42,
      zIndex: 4,
    }}
  >
    <Brand compact />
    <div
      style={{
        color: colors.cyan,
        font: "800 19px Arial, sans-serif",
        letterSpacing: 1.7,
        textAlign: "right",
      }}
    >
      {tag}
    </div>
  </div>
);

const EditorImage = ({src, dim = false}: {src: string; dim?: boolean}) => (
  <AbsoluteFill style={{background: colors.black}}>
    <Img
      src={staticFile(src)}
      style={{height: "100%", objectFit: "cover", objectPosition: "center top", width: "100%"}}
    />
    {dim ? <AbsoluteFill style={{background: "rgba(4, 5, 12, .52)"}} /> : null}
  </AbsoluteFill>
);

const Callout = ({
  children,
  accent = colors.cyan,
  style,
}: {
  children: React.ReactNode;
  accent?: string;
  style?: React.CSSProperties;
}) => (
  <div
    style={{
      background: "rgba(10, 11, 22, .9)",
      border: `1px solid ${accent}`,
      boxShadow: "0 14px 42px rgba(0, 0, 0, .45)",
      color: colors.ink,
      fontFamily: "Arial, sans-serif",
      padding: "15px 19px",
      ...style,
    }}
  >
    {children}
  </div>
);

const ProofOpen = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{opacity: fade(frame, 150)}}>
      <EditorImage src="captures-v3/12-human-redo.png" />
      <Header tag="REAL EDITOR · DRAW_PIXELS" />
      <Callout style={{bottom: 46, left: 54, maxWidth: 800, position: "absolute", zIndex: 5}}>
        <div style={{color: colors.cyan, font: "800 18px Arial", letterSpacing: 1.5}}>
          LIVE WEBMCP RESULT
        </div>
        <div style={{font: "700 28px monospace", marginTop: 8}}>
          draw_pixels {'{ color: \"#5EE8FF\", pixels: 10 }'}
        </div>
        <div style={{color: colors.muted, fontSize: 20, marginTop: 8}}>Pixels drawn · 5 frames · 2 layers</div>
      </Callout>
    </AbsoluteFill>
  );
};

const ProductScene = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 15, stiffness: 90}});
  return (
    <AbsoluteFill style={{background: colors.black, opacity: fade(frame, 240)}}>
      <EditorImage src="captures-v3/10-final-wide.png" dim />
      <PixelGrid />
      <div style={{left: 76, position: "absolute", top: 260, transform: `translateY(${32 - enter * 32}px)`, width: 970}}>
        <Brand />
        <div style={{color: colors.ink, font: "900 60px Arial", lineHeight: 1.03, marginTop: 48}}>
          Pixel art for people and agents, in one real editor.
        </div>
        <div style={{color: colors.muted, font: "400 28px Arial", lineHeight: 1.35, marginTop: 28}}>
          Draw, animate, layer, undo, review, and export without leaving the browser.
        </div>
      </div>
      <Callout style={{bottom: 52, position: "absolute", right: 64}}>
        <div style={{color: colors.cyan, font: "800 19px Arial", letterSpacing: 1.2}}>HUMAN + AGENT SHARED STATE</div>
      </Callout>
    </AbsoluteFill>
  );
};

const PlatformScene = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: colors.black, opacity: fade(frame, 210)}}>
      <EditorImage src="captures-v3/01-cloudflare-before.png" dim />
      <PixelGrid />
      <Header tag="BROWSER-NATIVE · CLOUDFLARE COMPATIBLE" />
      <div style={{left: 76, position: "absolute", top: 270, width: 760}}>
        <div style={{color: colors.cyan, font: "800 22px Arial", letterSpacing: 2}}>THE PRODUCT SURFACE</div>
        <div style={{color: colors.ink, font: "900 76px Arial", lineHeight: 0.98, marginTop: 22}}>
          65 typed WebMCP tools.
        </div>
        <div style={{color: colors.muted, font: "400 29px Arial", lineHeight: 1.38, marginTop: 32}}>
          Project state, frames, layers, pixels, references, playback, fidelity checks, and exports — all named product operations.
        </div>
      </div>
      <Callout accent={colors.purple} style={{bottom: 54, left: 76, position: "absolute"}}>
        <span style={{color: colors.purple, font: "800 18px Arial", letterSpacing: 1.2}}>CLOUDFLARE</span>
        <span style={{font: "700 20px Arial", marginLeft: 14}}>deployed browser-native experience</span>
      </Callout>
    </AbsoluteFill>
  );
};

const PromptScene = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: colors.black, opacity: fade(frame, 150)}}>
      <EditorImage src="captures-v3/02-live-run-baseline.png" dim />
      <Header tag="EXACT REQUEST · NO SCREEN-COORDINATE GUESSING" />
      <Callout style={{bottom: 60, left: 74, maxWidth: 1280, position: "absolute"}}>
        <div style={{color: colors.cyan, font: "800 18px Arial", letterSpacing: 1.5}}>REQUEST SENT TO CHATGPT + CODEX</div>
        <div style={{font: "600 25px Arial", lineHeight: 1.34, marginTop: 12}}>
          Inspect the project. Add a frame, undo it, duplicate a frame, set it to 180 ms, add and name a layer “Agent Highlights,” then draw ten #5EE8FF pixels.
        </div>
      </Callout>
    </AbsoluteFill>
  );
};

const executedCalls = [
  "get_project_state  →  4 frames · 1 layer",
  "add_frame  4 → 5",
  "undo  5 → 4",
  "duplicate_frame  4 → 5",
  "set_frame_duration  { ms: 180 }",
  "add_layer  1 → 2",
  "rename_layer  { name: 'Agent Highlights' }",
  "draw_pixels  { color: '#5EE8FF', pixels: 10 }",
];

const LiveRunScene = () => {
  const frame = useCurrentFrame();
  const active = Math.min(executedCalls.length - 1, Math.floor(frame / 120));
  return (
    <AbsoluteFill style={{background: colors.black}}>
      <OffthreadVideo
        src={staticFile("webmcp-execution-v3.mp4")}
        style={{height: "100%", objectFit: "contain", objectPosition: "right top", width: "100%"}}
      />
      <div
        style={{
          background: "linear-gradient(90deg, rgba(4,5,12,.92), rgba(4,5,12,.66), transparent)",
          bottom: 0,
          left: 0,
          position: "absolute",
          top: 0,
          width: 650,
        }}
      />
      <Callout style={{left: 34, padding: "13px 15px", position: "absolute", top: 34, width: 510, zIndex: 3}}>
        <div style={{color: colors.cyan, font: "800 16px Arial", letterSpacing: 1.5}}>CHATGPT + CODEX</div>
        <div style={{font: "800 21px Arial", marginTop: 5}}>LIVE WEBMCP RUN</div>
      </Callout>
      <div style={{left: 34, position: "absolute", top: 147, width: 570, zIndex: 3}}>
        {executedCalls.map((call, index) => {
          const visible = index <= active;
          return (
            <div
              key={call}
              style={{
                background: index === active ? "rgba(94, 232, 255, .16)" : "rgba(12, 13, 25, .83)",
                borderLeft: `4px solid ${index === active ? colors.cyan : "#3c3e50"}`,
                color: visible ? colors.ink : "#77798b",
                font: "600 18px monospace",
                marginBottom: 7,
                opacity: visible ? 1 : 0.46,
                padding: "10px 12px",
              }}
            >
              <span style={{color: visible ? colors.cyan : "#77798b"}}>✓ </span>{call}
            </div>
          );
        })}
      </div>
      <div style={{bottom: 28, color: colors.muted, font: "600 16px Arial", left: 36, position: "absolute", zIndex: 3}}>
        UNINTERRUPTED 32-SECOND CAPTURE · ACTUAL EDITOR STATE
      </div>
    </AbsoluteFill>
  );
};

const HumanControlScene = () => {
  const frame = useCurrentFrame();
  const isRedo = frame >= 180;
  const src = isRedo ? "captures-v3/12-human-redo.png" : "captures-v3/11-human-undo.png";
  const label = isRedo ? "HUMAN REDO" : "HUMAN UNDO";
  const detail = isRedo ? "The edit returns when the artist chooses." : "The artist can reverse the change instantly.";
  return (
    <AbsoluteFill style={{background: colors.black, opacity: fade(frame, 360)}}>
      <EditorImage src={src} />
      <Header tag="SHARED STATE · HUMAN REMAINS IN CONTROL" />
      <Callout style={{bottom: 52, left: 62, position: "absolute"}}>
        <div style={{color: colors.orange, font: "800 18px Arial", letterSpacing: 1.4}}>{label}</div>
        <div style={{font: "700 27px Arial", marginTop: 7}}>{detail}</div>
      </Callout>
    </AbsoluteFill>
  );
};

const ToolProofScene = () => {
  const frame = useCurrentFrame();
  const visible = interpolate(frame, [20, 58], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
  return (
    <AbsoluteFill style={{background: colors.black, opacity: fade(frame, 330)}}>
      <EditorImage src="captures-v3/10-final-wide.png" dim />
      <PixelGrid />
      <Header tag="TYPED PRODUCT TOOLS · IMMEDIATE UI SYNC" />
      <div style={{left: 70, position: "absolute", top: 245, width: 780}}>
        <div style={{color: colors.ink, font: "900 62px Arial", lineHeight: 1.02}}>Tools that speak the editor’s language.</div>
        <div style={{color: colors.muted, font: "400 27px Arial", lineHeight: 1.38, marginTop: 25}}>
          Reliable actions return state the person can immediately see, inspect, continue, or undo.
        </div>
        <div style={{display: "flex", flexWrap: "wrap", gap: 12, marginTop: 30, opacity: visible}}>
          {["projects", "frames", "layers", "pixels", "references", "exports"].map((tool) => (
            <Callout key={tool} style={{font: "700 20px monospace", padding: "12px 15px"}}>
              {tool}
            </Callout>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const ExportScene = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: colors.black, opacity: fade(frame, 480)}}>
      <EditorImage src="captures-v3/13-export-dialog.png" />
      <Header tag="ACTUAL EXPORT DIALOG" />
      <Callout accent={colors.orange} style={{bottom: 48, left: 58, maxWidth: 930, position: "absolute"}}>
        <div style={{color: colors.orange, font: "800 18px Arial", letterSpacing: 1.4}}>FROM EDITS TO SHIPPABLE ASSETS</div>
        <div style={{font: "700 29px Arial", lineHeight: 1.22, marginTop: 8}}>PNG · animated GIF · sprite sheet + metadata · editable project · game bundle</div>
      </Callout>
    </AbsoluteFill>
  );
};

const CtaScene = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const scale = spring({frame, fps, config: {damping: 16, stiffness: 82}});
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        background: "radial-gradient(circle at center, #29204b 0%, #09090f 70%)",
        color: colors.ink,
        fontFamily: "Arial, sans-serif",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <PixelGrid />
      <div style={{transform: `scale(${0.93 + scale * 0.07})`}}>
        <Brand />
        <div style={{font: "900 58px Arial", marginTop: 54}}>See WebMCP edit pixels live.</div>
        <div style={{display: "grid", gap: 16, margin: "42px auto 0", textAlign: "left", width: 1040}}>
          <div style={{color: colors.cyan, font: "800 27px Arial"}}>CLOUDFLARE · {cloudflareUrl}</div>
          <div style={{color: colors.ink, font: "700 25px Arial"}}>GITHUB · {githubUrl}</div>
          <div style={{color: colors.muted, font: "600 21px Arial"}}>SITES BACKUP · {siteUrl}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const PixelForgeDemo = () => (
  <AbsoluteFill style={{background: colors.black}}>
    <Audio src={staticFile("narration-v3.wav")} volume={0.96} />
    <Sequence from={0} durationInFrames={150}><ProofOpen /></Sequence>
    <Sequence from={150} durationInFrames={240}><ProductScene /></Sequence>
    <Sequence from={390} durationInFrames={210}><PlatformScene /></Sequence>
    <Sequence from={600} durationInFrames={150}><PromptScene /></Sequence>
    <Sequence from={750} durationInFrames={960}><LiveRunScene /></Sequence>
    <Sequence from={1710} durationInFrames={360}><HumanControlScene /></Sequence>
    <Sequence from={2070} durationInFrames={330}><ToolProofScene /></Sequence>
    <Sequence from={2400} durationInFrames={480}><ExportScene /></Sequence>
    <Sequence from={2880} durationInFrames={360}><CtaScene /></Sequence>
  </AbsoluteFill>
);

export const PixelForgeThumbnail = () => (
  <AbsoluteFill style={{background: colors.black, fontFamily: "Arial, sans-serif", overflow: "hidden"}}>
    <Img
      src={staticFile("captures-v3/12-human-redo.png")}
      style={{height: "100%", objectFit: "cover", objectPosition: "center top", width: "100%"}}
    />
    <AbsoluteFill style={{background: "linear-gradient(90deg, rgba(5,6,14,.72), rgba(5,6,14,.04) 52%)"}} />
    <div style={{left: 38, position: "absolute", top: 36, width: 430}}>
      <div style={{color: colors.cyan, font: "900 23px Arial", letterSpacing: 1.6}}>PIXELFORGE STUDIO · REAL EDITOR</div>
      <div style={{color: colors.ink, font: "900 54px Arial", letterSpacing: -1.5, lineHeight: 0.94, marginTop: 19}}>
        WEBMCP<br />EDITS LIVE
      </div>
    </div>
    <div
      style={{
        background: "rgba(9,9,15,.92)",
        border: `1px solid ${colors.cyan}`,
        bottom: 36,
        color: colors.ink,
        left: 38,
        padding: "13px 16px",
        position: "absolute",
        width: 510,
      }}
    >
      <div style={{color: colors.cyan, font: "900 18px monospace"}}>draw_pixels</div>
      <div style={{font: "700 19px monospace", marginTop: 5}}>{'{ color: "#5EE8FF", pixels: 10 }'}</div>
      <div style={{color: "#9ef7bf", font: "800 17px Arial", marginTop: 8}}>✓ Pixels drawn · 5 frames · 2 layers</div>
    </div>
  </AbsoluteFill>
);
