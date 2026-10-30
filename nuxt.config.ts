import tailwindcss from '@tailwindcss/vite'
export default defineNuxtConfig({
  compatibilityDate: '2026-10-24',
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  vite: { plugins: [tailwindcss()] },
  typescript: { strict: true },
  app: { head: { htmlAttrs: { lang: 'fr' }, title: "GOURMET D’ASIE — Personnel" } },
})
