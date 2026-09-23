import {
  AbsoluteFill,
  Img,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { loadFont } from "@remotion/google-fonts/Montserrat";
import { BRAND } from "./brand";
import { LM } from "./leadmagnet-copy";

const { fontFamily } = loadFont();

export const leadMagnetSchema = z.object({});

// ── shared bits ──────────────────────────────────────────────────────
const Diamond: React.FC<{ size?: number; color?: string }> = ({
  size = 12,
  color = BRAND.accent,
}) => (
  <div
    style={{
      width: size,
      height: size,
      backgroundColor: color,
      transform: "rotate(45deg)",
      flexShrink: 0,
    }}
  />
);

// Persistent background across all scenes.
const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const wheelRotate = interpolate(frame, [0, durationInFrames], [-6, 10]);
  const wheelScale = interpolate(frame, [0, durationInFrames], [1.05, 1.22]);
  return (
    <AbsoluteFill style={{ backgroundColor: BRAND.ink }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(120% 90% at 50% 35%, ${BRAND.ink} 0%, ${BRAND.inkDeep} 68%, #170a0d 100%)`,
        }}
      />
      <AbsoluteFill style={{ opacity: 0.14, mixBlendMode: "screen" }}>
        <Img
          src={staticFile("zodiac-wheel-half.png")}
          style={{
            position: "absolute",
            top: "-20%",
            left: "50%",
            width: "155%",
            transform: `translateX(-50%) rotate(${wheelRotate}deg) scale(${wheelScale})`,
            filter: "saturate(0.6) brightness(1.4)",
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(85% 65% at 50% 50%, transparent 38%, rgba(18,8,11,0.6) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

// Wraps scene content, fading it in on entry and out before it ends.
const Scene: React.FC<{ durationInFrames: number; children: React.ReactNode }> = ({
  durationInFrames,
  children,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, 8, durationInFrames - 8, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return (
    <AbsoluteFill
      style={{
        opacity,
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        padding: "0 110px",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

const useRise = (delay: number, px = 40, damping = 200) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping } });
  return { opacity: s, transform: `translateY(${interpolate(s, [0, 1], [px, 0])}px)` };
};

// ── Scene 1: hook ────────────────────────────────────────────────────
const Hook: React.FC = () => {
  const l1 = useRise(2, 36);
  const l2 = useRise(8, 36);
  const l3 = useRise(14, 36);
  const sub = useRise(26, 24);
  return (
    <div style={{ fontFamily }}>
      <div style={{ color: BRAND.white, fontSize: 88, fontWeight: 700, lineHeight: 1.12 }}>
        <div style={l1}>{LM.hookLine1}</div>
        <div style={l2}>{LM.hookLine2}</div>
        <div style={{ ...l3, color: BRAND.accent }}>{LM.hookLine3}</div>
      </div>
      <div
        style={{
          ...sub,
          marginTop: 44,
          color: BRAND.accentSoft,
          fontSize: 38,
          fontWeight: 400,
          letterSpacing: "0.03em",
        }}
      >
        {LM.hookSub}
      </div>
    </div>
  );
};

// ── Scene 2: curiosity / teasers ─────────────────────────────────────
const Tease: React.FC = () => {
  const title = useRise(2, 30);
  const hook = useRise(70, 20);
  return (
    <div style={{ fontFamily, width: "100%" }}>
      <div
        style={{
          ...title,
          color: BRAND.white,
          fontSize: 50,
          fontWeight: 600,
          lineHeight: 1.25,
          whiteSpace: "pre-line",
          marginBottom: 70,
        }}
      >
        {LM.teaseTitle}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 30, alignItems: "stretch" }}>
        {LM.teasers.map((t, i) => (
          <TeaserRow key={t.sign} sign={t.sign} line={t.line} delay={18 + i * 11} />
        ))}
      </div>
      <div
        style={{
          ...hook,
          marginTop: 64,
          color: BRAND.accent,
          fontSize: 44,
          fontWeight: 600,
          fontStyle: "italic",
        }}
      >
        {LM.teaseHook}
      </div>
    </div>
  );
};

const TeaserRow: React.FC<{ sign: string; line: string; delay: number }> = ({
  sign,
  line,
  delay,
}) => {
  const r = useRise(delay, 30);
  return (
    <div
      style={{
        ...r,
        display: "flex",
        alignItems: "center",
        gap: 22,
        textAlign: "left",
        backgroundColor: "rgba(178,145,160,0.12)",
        border: `1px solid rgba(178,145,160,0.28)`,
        borderRadius: 18,
        padding: "22px 30px",
      }}
    >
      <Diamond size={14} />
      <div style={{ color: BRAND.white, fontSize: 38, fontWeight: 600, minWidth: 200 }}>
        {sign}
      </div>
      <div style={{ color: BRAND.accentSoft, fontSize: 34, fontWeight: 400 }}>— {line}</div>
    </div>
  );
};

// ── Scene 3: the free guide ──────────────────────────────────────────
const Offer: React.FC = () => {
  const card = useRise(2, 60, 16);
  return (
    <div style={{ fontFamily, width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* Guide "cover" mockup */}
      <div
        style={{
          ...card,
          width: 620,
          padding: "54px 50px",
          background: "linear-gradient(160deg, #f6eef0 0%, #efe2e6 100%)",
          borderRadius: 26,
          boxShadow: "0 40px 90px rgba(0,0,0,0.45)",
          transform: `${card.transform} rotate(-2deg)`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", right: -90, top: -90, opacity: 0.18 }}>
          <Img src={staticFile("zodiac-wheel-half.png")} style={{ width: 360 }} />
        </div>
        <div
          style={{
            display: "inline-block",
            backgroundColor: BRAND.accent,
            color: BRAND.white,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "0.14em",
            padding: "10px 22px",
            borderRadius: 60,
          }}
        >
          {LM.offerLabel}
        </div>
        <div
          style={{
            marginTop: 30,
            color: BRAND.ink,
            fontSize: 52,
            fontWeight: 700,
            lineHeight: 1.15,
            whiteSpace: "pre-line",
            textAlign: "left",
          }}
        >
          {LM.offerTitle}
        </div>
        <div style={{ marginTop: 16, color: BRAND.accent, fontSize: 30, fontWeight: 600, textAlign: "left" }}>
          {LM.offerSub}
        </div>
      </div>

      {/* What's inside */}
      <div style={{ marginTop: 56, display: "flex", flexDirection: "column", gap: 26, alignSelf: "stretch" }}>
        {LM.bullets.map((b, i) => (
          <Bullet key={b} text={b} delay={24 + i * 10} />
        ))}
      </div>
    </div>
  );
};

const Bullet: React.FC<{ text: string; delay: number }> = ({ text, delay }) => {
  const r = useRise(delay, 26);
  return (
    <div style={{ ...r, display: "flex", alignItems: "center", gap: 22, textAlign: "left" }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 60,
          backgroundColor: BRAND.accent,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 14,
            height: 8,
            borderLeft: `3px solid ${BRAND.white}`,
            borderBottom: `3px solid ${BRAND.white}`,
            transform: "rotate(-45deg) translate(0,-2px)",
            marginTop: -4,
          }}
        />
      </div>
      <div style={{ color: BRAND.white, fontSize: 36, fontWeight: 400 }}>{text}</div>
    </div>
  );
};

// ── Scene 4: CTA ─────────────────────────────────────────────────────
const Cta: React.FC = () => {
  const lead = useRise(2, 30);
  const pill = useRise(12, 50, 13);
  const hand = useRise(28, 22);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Subtle pulse on the pill to pull the eye.
  const pulse = 1 + 0.03 * Math.sin((frame / fps) * Math.PI * 2.2);
  return (
    <div style={{ fontFamily }}>
      <div style={{ ...lead, color: BRAND.white, fontSize: 64, fontWeight: 700, lineHeight: 1.15 }}>
        {LM.ctaLead}
      </div>
      <div
        style={{
          ...pill,
          transform: `${pill.transform} scale(${pulse})`,
          marginTop: 60,
          display: "inline-block",
          backgroundColor: BRAND.accent,
          color: BRAND.white,
          fontSize: 46,
          fontWeight: 600,
          letterSpacing: "0.02em",
          padding: "34px 58px",
          borderRadius: 100,
          boxShadow: "0 24px 70px rgba(0,0,0,0.4)",
        }}
      >
        {LM.ctaAction}
      </div>
      <div style={{ ...hand, marginTop: 80, display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
        <div style={{ color: BRAND.white, fontSize: 46, fontWeight: 700, letterSpacing: "0.04em" }}>
          {LM.handle}
        </div>
        <div style={{ color: BRAND.accentSoft, fontSize: 34, letterSpacing: "0.06em" }}>
          {LM.url}
        </div>
      </div>
    </div>
  );
};

// ── Composition ──────────────────────────────────────────────────────
// Scene boundaries (frames @30fps).
const S1 = 78; // hook
const S2 = 132; // tease
const S3 = 132; // offer
const S4 = 90; // cta

export const LeadMagnet: React.FC = () => {
  return (
    <AbsoluteFill>
      <Background />
      <Sequence durationInFrames={S1}>
        <Scene durationInFrames={S1}>
          <Hook />
        </Scene>
      </Sequence>
      <Sequence from={S1} durationInFrames={S2}>
        <Scene durationInFrames={S2}>
          <Tease />
        </Scene>
      </Sequence>
      <Sequence from={S1 + S2} durationInFrames={S3}>
        <Scene durationInFrames={S3}>
          <Offer />
        </Scene>
      </Sequence>
      <Sequence from={S1 + S2 + S3} durationInFrames={S4}>
        <Scene durationInFrames={S4}>
          <Cta />
        </Scene>
      </Sequence>
    </AbsoluteFill>
  );
};

export const LEAD_MAGNET_DURATION = S1 + S2 + S3 + S4;
