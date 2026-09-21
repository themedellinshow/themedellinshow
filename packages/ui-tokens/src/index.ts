export const colors = {
  brand: {
    50: '#fdf4f2',
    100: '#fbe4df',
    200: '#f6c8bd',
    300: '#efa493',
    400: '#e57a60',
    500: '#d95a3c',
    600: '#c04a2e',
    700: '#a03d29',
    800: '#853626',
    900: '#6f3025',
  },
  neutral: {
    0: '#ffffff',
    50: '#faf9f8',
    100: '#f2f0ef',
    200: '#e5e1df',
    300: '#d0c9c6',
    400: '#ad9f9a',
    500: '#8c7e79',
    600: '#6f645f',
    700: '#5a504c',
    800: '#463f3c',
    900: '#2e2a28',
    950: '#191614',
  },
  success: '#1b7f3b',
  warning: '#b26a00',
  danger: '#c0392b',
} as const;

export const spacing = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
  '2xl': '3rem',
  '3xl': '4rem',
} as const;

export const radius = {
  sm: '0.375rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  full: '9999px',
} as const;

export const typography = {
  fontFamily:
    '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
  size: {
    xs: '0.75rem',
    sm: '0.875rem',
    md: '1rem',
    lg: '1.25rem',
    xl: '1.5rem',
    '2xl': '2rem',
    '3xl': '2.5rem',
  },
  weight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
} as const;

export const shadows = {
  card: '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)',
  elevated: '0 6px 16px rgba(0, 0, 0, 0.12)',
  modal: '0 20px 40px rgba(0, 0, 0, 0.2)',
} as const;

export const zIndex = {
  dropdown: 1000,
  sticky: 1020,
  modal: 1300,
  toast: 1500,
} as const;

export const tokens = {
  colors,
  spacing,
  radius,
  typography,
  shadows,
  zIndex,
} as const;

export default tokens;