/**
 * Claw Universe — Design System Tokens
 * Based on: 深色主题 + Solana 品牌色 (#9945FF / #14F195)
 * Background: #0a0a1a
 */

// ─── Colors ────────────────────────────────────────────────────────────────
export const colors = {
  // Backgrounds
  bg: {
    base: '#0a0a1a',      // Page background
    card: '#111827',       // Card / panel background
    cardHover: '#1a2235',  // Card hover state
    elevated: '#1f2937',   // Elevated surfaces
    overlay: 'rgba(0,0,0,0.6)',
  },

  // Brand — Solana
  solana: {
    purple: '#9945FF',
    gradient: '#14F195',
    purpleDim: 'rgba(153,69,255,0.15)',
    gradientDim: 'rgba(20,241,149,0.15)',
  },

  // Borders
  border: {
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
    solana: '#9945FF',
  },

  // Status
  status: {
    open: { bg: 'rgba(20,241,149,0.15)', text: '#14F195', dot: '#14F195' },
    in_progress: { bg: 'rgba(234,179,8,0.15)', text: '#eab308', dot: '#eab308' },
    completed: { bg: 'rgba(107,114,128,0.15)', text: '#6b7280', dot: '#6b7280' },
    cancelled: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', dot: '#ef4444' },
  },

  // Feedback
  feedback: {
    error: '#ef4444',
    warning: '#f59e0b',
    success: '#14F195',
    info: '#3b82f6',
  },
}

// ─── Spacing ───────────────────────────────────────────────────────────────
export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '48px',
  '3xl': '64px',
}

// ─── Typography ─────────────────────────────────────────────────────────────
export const typography = {
  fontFamily: {
    sans: 'Inter, system-ui, -apple-system, sans-serif',
    mono: 'JetBrains Mono, Fira Code, monospace',
  },
  size: {
    xs: '12px',
    sm: '14px',
    base: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '30px',
    '4xl': '36px',
  },
  weight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
}

// ─── Border Radius ──────────────────────────────────────────────────────────
export const radius = {
  sm: '6px',
  md: '10px',
  lg: '14px',
  xl: '20px',
  full: '9999px',
}

// ─── Shadows ────────────────────────────────────────────────────────────────
export const shadows = {
  card: '0 4px 24px rgba(0,0,0,0.4)',
  glow: '0 0 20px rgba(153,69,255,0.3)',
  glowGreen: '0 0 20px rgba(20,241,149,0.3)',
}

// ─── Transitions ────────────────────────────────────────────────────────────
export const transitions = {
  fast: '150ms ease',
  base: '200ms ease',
  slow: '300ms ease',
  spring: 'cubic-bezier(0.34,1.56,0.64,1)',
}
