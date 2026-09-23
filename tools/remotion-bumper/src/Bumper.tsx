import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { loadFont } from "@remotion/google-fonts/Montserrat";
import { BRAND } from "./brand";

const { fontFamily } = loadFont();

export const bumperSchema = z.object({
  brand: z.string(),
  tagline: z.string(),
  cta: z.string(),
  handle: z.string(),
  url: z.string(),
});

type Props = z.infer<typeof bumperSchema>;

// Small helper: spring that starts at a given frame.
const useEntrance = (delay: number, damping = 200) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping } });
};

export const Bumper: React.FC<Props> = ({
  brand,
  tagline,
  cta,
  handle,
  url,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Background decoration: zodiac wheel slowly rotates + breathes.
  const wheelRotate = interpolate(frame, [0, durationInFrames], [-8, 8]);
  const wheelScale = interpolate(frame, [0, durationInFrames], [1.05, 1.18]);

  // Entrances.
  const brandIn = useEntrance(6);
  const lineIn = useEntrance(14);
  const taglineIn = useEntrance(20);
  const ctaIn = useEntrance(34, 14); // a touch bouncier for the CTA
  const footIn = useEntrance(48);

  const fade = (s: number) => interpolate(s, [0, 1], [0, 1]);
  const rise = (s: number, px = 40) => `translateY(${interpolate(s, [0, 1], [px, 0])}px)`;

  return (
    <AbsoluteFill style={{ fontFamily, backgroundColor: BRAND.ink }}>
      {/* Radial wine gradient base */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(120% 90% at 50% 38%, ${BRAND.ink} 0%, ${BRAND.inkDeep} 70%, #1c0d11 100%)`,
        }}
      />

      {/* Zodiac wheel decoration, bleeding off the top-right */}
      <AbsoluteFill style={{ opacity: 0.16, mixBlendMode: "screen" }}>
        <Img
          src={staticFile("zodiac-wheel-half.png")}
          style={{
            position: "absolute",
            top: "-18%",
            left: "50%",
            width: "150%",
            transform: `translateX(-50%) rotate(${wheelRotate}deg) scale(${wheelScale})`,
            filter: "saturate(0.6) brightness(1.4)",
          }}
        />
      </AbsoluteFill>

      {/* Soft vignette for legibility */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(80% 60% at 50% 55%, transparent 40%, rgba(20,9,12,0.55) 100%)",
        }}
      />

      {/* Centered content */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          padding: "0 120px",
        }}
      >
        {/* Brand name */}
        <div
          style={{
            opacity: fade(brandIn),
            transform: `${rise(brandIn, 30)} scale(${interpolate(brandIn, [0, 1], [0.9, 1])})`,
            color: BRAND.white,
            fontSize: 96,
            fontWeight: 700,
            letterSpacing: "0.02em",
            lineHeight: 1.05,
          }}
        >
          {brand}
        </div>

        {/* Accent hairline that "draws" in */}
        <div
          style={{
            marginTop: 36,
            height: 2,
            width: interpolate(lineIn, [0, 1], [0, 220]),
            backgroundColor: BRAND.accent,
            opacity: fade(lineIn),
          }}
        />

        {/* Tagline */}
        <div
          style={{
            opacity: fade(taglineIn),
            transform: rise(taglineIn, 30),
            color: BRAND.accentSoft,
            fontSize: 40,
            fontWeight: 400,
            letterSpacing: "0.04em",
            marginTop: 36,
            maxWidth: 760,
          }}
        >
          {tagline}
        </div>

        {/* CTA pill */}
        <div
          style={{
            opacity: fade(ctaIn),
            transform: `${rise(ctaIn, 50)} scale(${interpolate(ctaIn, [0, 1], [0.85, 1])})`,
            marginTop: 90,
            backgroundColor: BRAND.accent,
            color: BRAND.white,
            fontSize: 44,
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            padding: "32px 64px",
            borderRadius: 100,
            boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          }}
        >
          {cta}
        </div>
      </AbsoluteFill>

      {/* Footer: handle + url */}
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          paddingBottom: 150,
        }}
      >
        <div
          style={{
            opacity: fade(footIn),
            transform: rise(footIn, 24),
            color: BRAND.white,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: "0.05em" }}>
            {handle}
          </div>
          <div
            style={{
              fontSize: 34,
              fontWeight: 400,
              letterSpacing: "0.08em",
              color: BRAND.accentSoft,
            }}
          >
            {url}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
