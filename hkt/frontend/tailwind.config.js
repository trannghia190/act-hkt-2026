/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#f7f7f5",
        surface: {
          DEFAULT: "#ffffff",
          secondary: "#fbfbfa",
        },
        ink: {
          DEFAULT: "#1a1a17",
          secondary: "#3f3f39",
          muted: "#73736b",
        },
        line: {
          DEFAULT: "#e6e5e0",
          soft: "#efeeea",
          focus: "#bcd9d0",
        },
        accent: {
          DEFAULT: "#17604d", // ACT Dark Emerald
          hover: "#0f4939",
          dark: "#0f4939",
          soft: "#e8f1ee",
          line: "#bcd9d0",
        },
        status: {
          ok: "#15803d",
          warn: "#a95c06",
          danger: "#b42318",
          info: "#1d4ed8",
        }
      },
      boxShadow: {
        '2xs': '0 1px 2px rgba(26,26,23,0.04)',
        'xs': '0 1px 2px rgba(26,26,23,0.06)',
      },
      backdropBlur: {
        'xs': '2px',
      }
    },
  },
  plugins: [],
}
