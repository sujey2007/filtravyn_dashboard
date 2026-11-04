/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Preflight is off on purpose: src/index.css carries the console's own base styles.
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        ink: '#0F2230',
        stone: '#E3E8EB',
        sheet: '#F2F5F6',
        accent: '#2A3FD8',
      },
      fontFamily: {
        ui: ['Schibsted Grotesk', 'system-ui', 'sans-serif'],
        num: ['Azeret Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
