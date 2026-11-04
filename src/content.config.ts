import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const i18n = z.object({ en: z.string().default(''), pt: z.string().default('') });

const disciplines = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/disciplines' }),
  schema: z.object({ name: z.string(), pt: z.string().default('') }),
});

const sections = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/sections' }),
  schema: z.object({ title: z.string(), order: z.number().default(50) }),
});

const projects = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/projects' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      section: z.string().nullable().optional(),
      year: z.number().nullable().optional(),
      discipline: z.string().nullable().optional(),
      client: z.string().default(''),
      cover: image().nullable().optional(),
      gallery: z.array(z.object({ image: image(), alt: z.string().default(''), seq: z.string().nullable().optional(), order: z.number().nullable().optional() })).default([]),
      videos: z
        .array(
          z.object({
            youtube: z.string().nullable().optional(),
            title: z.string().default(''),
            vertical: z.boolean().default(false),
            poster: image().nullable().optional(),
            seq: z.string().nullable().optional(),
            order: z.number().nullable().optional(),
          }),
        )
        .default([]),
      credits: z.string().default(''),
      body: i18n,
      featured: z.boolean().default(true),
      order: z.number().default(50),
    }),
});

const settings = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/settings' }),
  schema: z.object({
    defaultTheme: z.enum(['dark', 'light']).default('dark'),
    name: z.string(),
    role: i18n,
    bio: i18n,
    availability: i18n,
    skills: z.array(z.string()).default([]),
    location: z.string().default(''),
    email: z.string().default(''),
    socials: z.array(z.object({ label: z.string(), url: z.string() })).default([]),
  }),
});

export const collections = { disciplines, sections, projects, settings };
