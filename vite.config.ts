import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub project Pages serves this repository under /meal-log/.
const base = '/meal-log/';

export default defineConfig({
  base,
  plugins: [react(), VitePWA({
    base,
    scope: base,
    registerType: 'prompt',
    includeAssets: ['icons/*.png', 'favicon.svg'],
    manifest: {
      name: 'Meal Log — カロリー・PFC記録',
      short_name: 'Meal Log',
      description: '毎日の食事と体重を、あなたの端末に。',
      lang: 'ja',
      id: base,
      start_url: base,
      scope: base,
      display: 'standalone',
      orientation: 'portrait-primary',
      background_color: '#f5f7f4',
      theme_color: '#f5f7f4',
      icons: [
        { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: `${base}icons/icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: { globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2,json}'], maximumFileSizeToCacheInBytes: 6 * 1024 * 1024, navigateFallback: `${base}index.html` },
  })],
});
