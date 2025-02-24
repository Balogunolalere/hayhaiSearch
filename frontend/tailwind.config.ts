import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'primary': '#FF6B6B',
        'secondary': '#4ECDC4',
        'accent': '#FFE66D',
        'brutalist-black': '#1A1A1A',
        'brutalist-white': '#F7F7F7',
      },
      borderWidth: {
        '4': '4px',
      },
      boxShadow: {
        'brutal': '4px 4px 0 0 #1A1A1A',
        'brutal-lg': '8px 8px 0 0 #1A1A1A',
      },
      fontFamily: {
        'mono': ['var(--font-mono)', 'monospace'],
        'sans': ['var(--font-sans)', 'sans-serif'],
      },
      spacing: {
        '12': '3rem',
      },
      typography: {
        DEFAULT: {
          css: {
            'code::before': {
              content: '""',
            },
            'code::after': {
              content: '""',
            },
          },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}

export default config
