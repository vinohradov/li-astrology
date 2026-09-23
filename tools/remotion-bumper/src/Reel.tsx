import {
  AbsoluteFill,
  OffthreadVideo,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Montserrat";
import { BRAND } from "./brand";
import captionsData from "./captions.json";

const { fontFamily } = loadFont();

type Token = { text: string; start: number; end: number };
type Page = { start: number; end: number; tokens: Token[] };

const PAGES = captionsData.pages as Page[];

// Vertical position of the caption block (fraction of height from the top).
// Footage frames the face in the upper ~55%, dark shirt below — captions sit
// over the dark area so they never cover her face.
const CAPTION_Y = 0.74;

const Word: React.FC<{ token: Token; t: number; fps: number }> = ({
  token,
  t,
  fps,
}) => {
  const active = t >= token.start && t <= token.end;
  const since = (t - token.start) * fps;
  const pop = active
    ? spring({ frame: since, fps, config: { damping: 14, stiffness: 200 }, durationInFrames: 10 })
    : 0;
  const scale = 1 + 0.1 * pop;
  return (
    <span
      style={{
        display: "inline-block",
        margin: "0 0.16em",
        transform: `scale(${scale})`,
        color: BRAND.white,
        backgroundColor: active ? BRAND.accent : "transparent",
        borderRadius: 14,
        padding: active ? "2px 14px" : "2px 0",
        transition: "none",
        boxShadow: active ? "0 10px 30px rgba(76,39,47,0.45)" : "none",
      }}
    >
      {token.text}
    </span>
  );
};

const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const t = frame / fps;

  // Find the active page (small lead-in so the line appears just before speech).
  const LEAD = 0.12;
  const page = PAGES.find((p) => t >= p.start - LEAD && t <= p.end + 0.35);
  if (!page) return null;

  // Page entrance: fade + slight rise over the first 6 frames after it appears.
  const since = (t - (page.start - LEAD)) * fps;
  const enter = interpolate(since, [0, 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rise = interpolate(enter, [0, 1], [26, 0]);

  return (
    <AbsoluteFill
      style={{
        fontFamily,
        justifyContent: "flex-start",
        alignItems: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: height * CAPTION_Y,
          left: 0,
          right: 0,
          padding: "0 90px",
          textAlign: "center",
          fontSize: 84,
          fontWeight: 800,
          lineHeight: 1.18,
          letterSpacing: "-0.01em",
          opacity: enter,
          transform: `translateY(${rise}px)`,
          // Strong legibility over moving video.
          textShadow:
            "0 4px 22px rgba(0,0,0,0.85), 0 0 3px rgba(0,0,0,0.9), 0 2px 2px rgba(0,0,0,0.9)",
          WebkitTextStroke: "2px rgba(20,9,12,0.55)",
        }}
      >
        {page.tokens.map((tok, i) => (
          <Word key={i} token={tok} t={t} fps={fps} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const Reel: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <OffthreadVideo
        src={staticFile("footage.mp4")}
        // Footage is 720x1280; the canvas is 1080x1920 — fill it (cover).
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
        muted
      />
      <Captions />
    </AbsoluteFill>
  );
};
