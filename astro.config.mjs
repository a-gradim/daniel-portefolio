// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
import markdoc from '@astrojs/markdoc';
import sitemap from '@astrojs/sitemap';
import keystatic from '@keystatic/astro';

export default defineConfig({
  site: 'https://danielneto.vercel.app',
  adapter: vercel({ imageService: false }),
  integrations: [react(), markdoc(), keystatic(), sitemap()],
  i18n: {
    locales: ['en', 'pt'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: false },
  },
  image: { responsiveStyles: true },
});
