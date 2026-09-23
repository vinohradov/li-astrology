// Brand tokens for video — sourced from materials/components/tokens.json
// (the warm palette extracted from the PDFs Anastasia actually ships).
// On video / dark backgrounds the warm wine + mauve read better than the
// near-black website body ink, so we use the *-warm values here.

export const BRAND = {
  ink: "#4c272f", // warm wine — base of the dark gradient
  inkDeep: "#2c151a", // hand-darkened wine for gradient depth
  accent: "#b291a0", // mauve — pills, hairlines, accent text
  accentSoft: "#ceb8c2", // light decorative stroke
  white: "#ffffff",
  rule: "#d1d3d4",
  font: "Montserrat",
} as const;

// Editable copy for the bumper. Change these to retheme the end-card
// without touching the animation code (also exposed as defaultProps).
export const COPY = {
  brand: "li-astrology",
  tagline: "Астрология, которая работает на тебя",
  cta: "Курсы по астрологии",
  handle: "@li_astrology_",
  url: "li-astrology.com.ua",
} as const;
