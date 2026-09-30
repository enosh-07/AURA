/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        aura: {
          void: '#050508',
          obsidian: '#0a0b10',
          base: '#0f1118',
          card: '#151722',
          surface: '#1c1f2e',
          elevated: '#24283b',
          border: 'rgba(255, 255, 255, 0.08)',
          borderHover: 'rgba(255, 255, 255, 0.18)',
          muted: '#8b92a5',
          text: '#f1f5f9',
          cyan: '#00f2fe',
          cyanGlow: 'rgba(0, 242, 254, 0.35)',
          violet: '#9d4edd',
          violetGlow: 'rgba(157, 78, 221, 0.35)',
          amber: '#ff9e00',
          emerald: '#10b981',
          crimson: '#f72585',
        },
        midnight: {
          bg: '#0a0908',
          sidebar: '#0d0c0b',
          card: '#141312',
          cardHover: '#1c1a18',
          surface: '#181716',
          border: 'rgba(255, 255, 255, 0.07)',
          borderHover: 'rgba(255, 255, 255, 0.16)',
          peach: '#f3c5a6',
          peachHover: '#ffcca8',
          cream: '#fbf6f1',
          muted: '#8f867e',
          subtle: '#544d46',
          pill: '#241d19',
          pillActive: '#2d241f',
        }
      },
      fontFamily: {
        serif: ['"Playfair Display"', '"Cormorant Garamond"', 'Georgia', 'serif'],
        editorial: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'Outfit', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        'glow-cyan': '0 0 25px -5px rgba(0, 242, 254, 0.4)',
        'glow-violet': '0 0 25px -5px rgba(157, 78, 221, 0.4)',
        'glow-peach': '0 0 30px -5px rgba(243, 197, 166, 0.35)',
        'glow-ambient': '0 10px 40px -10px rgba(0, 0, 0, 0.8)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      },
      animation: {
        'spin-slow': 'spin 18s linear infinite',
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
