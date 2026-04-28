/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2B4BA0',
          dark: '#1E3A7A',
          light: '#4A6BC4',
          rgb: '43, 75, 160',
        },
        accent: {
          DEFAULT: '#F5841F',
          light: '#FF9F43',
          dark: '#D4710F',
          rgb: '245, 132, 31',
        },
        success: '#2ECC71',
        warning: '#F1C40F',
        danger: '#E74C3C',
        info: '#3498DB',
        bg: {
          main: '#FFFFFF',
          secondary: '#F8F9FA',
          dark: '#1A1A2E',
        },
        text: {
          main: '#2D3436',
          body: '#636E72',
          muted: '#B2BEC3',
          light: '#FFFFFF',
        },
      },
      fontFamily: {
        display: ['Montserrat', 'sans-serif'],
        body: ['Open Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
