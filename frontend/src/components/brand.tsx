import type { CSSProperties } from 'react';

export const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260508_064122_c4750c0e-7476-4b44-94a2-a85a65c63bf2.mp4';

export const gradientStyle: CSSProperties = {
  backgroundImage:
    'linear-gradient(to right, #091020 0%, #0B2551 12.5%, #A4F4FD 32.5%, #00d2ff 50%, #0B2551 67.5%, #091020 87.5%, #091020 100%)',
  backgroundSize: '200% auto',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
  WebkitTextFillColor: 'transparent',
  filter: 'url(#c3-noise)',
};

export function LogoMark({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 256" fill="#fff" className={className} aria-hidden="true">
      <path d="M 0 128 C 70.692 128 128 185.308 128 256 L 64 256 C 64 220.654 35.346 192 0 192 Z M 256 192 C 220.654 192 192 220.654 192 256 L 128 256 C 128 185.308 185.308 128 256 128 Z M 128 0 C 128 70.692 70.692 128 0 128 L 0 64 C 35.346 64 64 35.346 64 0 Z M 192 0 C 192 35.346 220.654 64 256 64 L 256 128 C 185.308 128 128 70.692 128 0 Z" />
    </svg>
  );
}

/** Fixed, looping full-screen video behind the whole app. `dim` darkens it for data-heavy screens. */
export function BackgroundVideo({ dim = 0 }: { dim?: number }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="pointer-events-none h-full w-full object-cover"
        src={VIDEO_URL}
      />
      {dim > 0 && <div className="absolute inset-0 bg-[#0c0c0c]" style={{ opacity: dim }} />}
    </div>
  );
}

/** Grain filter used by the shiny headline (id kept as in the Aura design). */
export function NoiseFilters() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <filter id="c3-noise">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.35 0" />
        <feComposite in2="SourceGraphic" operator="in" result="noise" />
        <feBlend in="SourceGraphic" in2="noise" mode="multiply" />
      </filter>
    </svg>
  );
}

export function SectionEyebrow({ label, tag }: { label: string; tag?: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-medium text-white/80">
      <span className="h-1.5 w-1.5 rounded-full bg-white" />
      {label}
      {tag && <span className="rounded-full border border-white/10 px-2 py-0.5 text-white/50">{tag}</span>}
    </div>
  );
}
