// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
import markdoc from '@astrojs/markdoc';
import sitemap from '@astrojs/sitemap';
import keystatic from '@keystatic/astro';

export default defineConfig({
  site: 'https://danielneto.vercel.app',
  adapter: vercel({
    // Images are resized on demand by Vercel (cached), so deployments only carry the originals.
    imageService: true,
    imagesConfig: { sizes: [160, 320, 640, 960, 1280, 1920], domains: [], formats: ['image/avif', 'image/webp'], minimumCacheTTL: 2678400 },
  }),
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  integrations: [
    react(),
    markdoc(),
    keystatic(),
    sitemap({
      i18n: {
        defaultLocale: 'en',
        locales: { en: 'en', pt: 'pt-PT' },
      },
      filter: (page) => !new URL(page).pathname.startsWith('/keystatic'),
    }),
  ],
  i18n: {
    locales: ['en', 'pt'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: false },
  },
  image: { responsiveStyles: true },
});
