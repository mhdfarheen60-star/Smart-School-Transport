/** Aura-style dark theme. The default light palettes used by the app's utility classes are
 *  re-mapped so every page picks up the cinematic dark/glass look without per-class edits. */
const white = (a) => `rgba(255,255,255,${a})`;
const tint = (rgb, a) => `rgba(${rgb},${a})`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        slate: {
          50: white(0.03),
          100: white(0.06),
          200: white(0.1),
          300: white(0.16),
          400: white(0.4),
          500: white(0.55),
          600: white(0.68),
          700: white(0.8),
          800: white(0.9),
          900: '#ffffff',
        },
        navy: {
          50: white(0.06),
          100: white(0.1),
          200: white(0.16),
          500: '#9fc2f7',
          600: '#cfe3ff',
          700: '#e6eefc',
          800: '#f3f6fc',
          900: '#ffffff',
        },
        brand: {
          DEFAULT: '#3D81E3',
          50: tint('61,129,227', 0.14),
          100: tint('61,129,227', 0.22),
          500: '#5b9aee',
          600: '#3D81E3',
          700: '#8dbbff',
        },
        red: { 50: tint('239,68,68', 0.1), 100: tint('239,68,68', 0.16), 200: tint('239,68,68', 0.3), 400: '#f87171', 500: '#ef4444', 600: '#f87171', 700: '#fca5a5', 800: '#fca5a5' },
        amber: { 50: tint('245,158,11', 0.1), 100: tint('245,158,11', 0.16), 200: tint('245,158,11', 0.3), 600: '#fbbf24', 700: '#fcd34d', 800: '#fcd34d' },
        emerald: { 50: tint('16,185,129', 0.1), 100: tint('16,185,129', 0.16), 200: tint('16,185,129', 0.3), 600: '#34d399', 700: '#6ee7b7', 800: '#6ee7b7' },
        blue: { 50: tint('59,130,246', 0.1), 100: tint('59,130,246', 0.16), 200: tint('59,130,246', 0.3), 700: '#93c5fd' },
        orange: { 50: tint('249,115,22', 0.1), 200: tint('249,115,22', 0.3), 700: '#fdba74' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
