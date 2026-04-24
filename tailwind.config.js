/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        bg: {
          base: '#0a0a1a',
          card: '#111827',
          cardHover: '#1a2235',
          elevated: '#1f2937',
        },
        // Solana Brand
        solana: {
          purple: '#9945FF',
          gradient: '#14F195',
          'purple-dim': 'rgba(153,69,255,0.15)',
          'gradient-dim': 'rgba(20,241,149,0.15)',
        },
        // Borders
        border: {
          DEFAULT: '#1f2937',
          light: '#2d3748',
          default: '#1f2937',
          hover: 'rgba(153,69,255,0.4)',
          active: '#9945FF',
        },
        // Text
        text: {
          primary: '#ffffff',
          secondary: '#9ca3af',
          muted: '#6b7280',
          accent: '#14F195',
        },
        // Status
        status: {
          open: '#14F195',
          'in-progress': '#eab308',
          completed: '#6b7280',
          cancelled: '#ef4444',
          assigned: '#3b82f6',
          submitted: '#f59e0b',
        },
        // Feedback
        feedback: {
          error: '#ef4444',
          warning: '#f59e0b',
          success: '#14F195',
          info: '#3b82f6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '20px',
      },
      boxShadow: {
        card: '0 4px 24px rgba(0,0,0,0.4)',
        glow: '0 0 20px rgba(153,69,255,0.3)',
        'glow-green': '0 0 20px rgba(20,241,149,0.3)',
      },
    },
  },
  plugins: [],
}
