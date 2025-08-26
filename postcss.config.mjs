// Configuración mínima de PostCSS usada por Next.js
// para aplicar plugins como Tailwind CSS durante el build.
/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    // Habilita Tailwind para el procesamiento de estilos
    tailwindcss: {},
  },
};

export default config;
