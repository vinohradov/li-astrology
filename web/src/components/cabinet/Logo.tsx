/** React port of components/Logo.astro (gold crescent in a zodiac ring) for cabinet islands. */
export default function Logo({ className = '', title = 'Li Astrology' }: { className?: string; title?: string }) {
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const angle = ((i * 30 - 90) * Math.PI) / 180;
    return {
      x1: 24 + Math.cos(angle) * 20,
      y1: 24 + Math.sin(angle) * 20,
      x2: 24 + Math.cos(angle) * 22,
      y2: 24 + Math.sin(angle) * 22,
    };
  });

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className={`block ${className}`} role="img" aria-label={title}>
      <defs>
        <linearGradient id="cabLogoGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f5d98f" />
          <stop offset="55%" stopColor="#e8c987" />
          <stop offset="100%" stopColor="#c9a25a" />
        </linearGradient>
        <mask id="cabLogoMoonMask">
          <rect x="0" y="0" width="48" height="48" fill="white" />
          <circle cx="31" cy="20" r="13" fill="black" />
        </mask>
      </defs>
      <circle cx="24" cy="24" r="22" fill="none" stroke="url(#cabLogoGold)" strokeWidth="0.9" opacity="0.55" />
      <circle cx="24" cy="24" r="18" fill="none" stroke="url(#cabLogoGold)" strokeWidth="0.6" opacity="0.35" />
      <circle cx="22" cy="24" r="11" fill="url(#cabLogoGold)" mask="url(#cabLogoMoonMask)" />
      <g transform="translate(33 14)">
        <path d="M0 -3.2 L0.9 -0.9 L3.2 0 L0.9 0.9 L0 3.2 L-0.9 0.9 L-3.2 0 L-0.9 -0.9 Z" fill="url(#cabLogoGold)" />
      </g>
      {ticks.map((t, i) => (
        <line key={i} {...t} stroke="url(#cabLogoGold)" strokeWidth="0.5" opacity="0.4" />
      ))}
    </svg>
  );
}
