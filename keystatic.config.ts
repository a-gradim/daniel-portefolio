import { config, collection, singleton, fields } from '@keystatic/core';
import { compressedImage } from './src/lib/keystatic-image';

// Bilingual text helper: every user-facing string has an EN and a PT version.
const i18nText = (label: string, multiline = false) =>
  fields.object(
    {
      en: fields.text({ label: 'English', multiline }),
      pt: fields.text({ label: 'Português', multiline }),
    },
    { label },
  );

// Photos are resized/compressed in the browser before saving (max 2400px, WebP).
const image = (label: string) =>
  compressedImage({
    label,
    directory: 'src/assets/projects',
    publicPath: '../../assets/projects/',
  });

export default config({
  // GitHub mode in production, or locally with `npm run cms:setup` (runs the GitHub App wizard once).
  storage: import.meta.env.PROD || import.meta.env.MODE === 'github'
    ? { kind: 'github', repo: 'a-gradim/daniel-portefolio' }
    : { kind: 'local' },
  ui: {
    brand: { name: 'Daniel Neto' },
    navigation: { Content: ['projects', 'sections', 'disciplines'], Site: ['settings'] },
  },
  collections: {
    disciplines: collection({
      label: 'Disciplines',
      path: 'src/content/disciplines/*',
      format: 'yaml',
      slugField: 'name',
      columns: ['name', 'pt'],
      schema: {
        name: fields.slug({ name: { label: 'English' } }),
        pt: fields.text({ label: 'Português' }),
      },
    }),
    sections: collection({
      label: 'Sections (clients / series)',
      path: 'src/content/sections/*',
      format: 'yaml',
      slugField: 'title',
      columns: ['title', 'order'],
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        order: fields.integer({ label: 'Order', defaultValue: 0 }),
      },
    }),
    projects: collection({
      label: 'Projects',
      path: 'src/content/projects/*',
      format: 'yaml',
      slugField: 'title',
      columns: ['title', 'year'],
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        section: fields.relationship({ label: 'Section', collection: 'sections' }),
        year: fields.integer({ label: 'Year' }),
        discipline: fields.relationship({ label: 'Discipline', collection: 'disciplines' }),
        client: fields.text({ label: 'Client / note' }),
        cover: image('Cover image'),
        gallery: fields.array(
          fields.object({
            image: image('Image'),
            alt: fields.text({ label: 'Alt text' }),
            seq: fields.text({ label: 'Position (e.g. 1, 2, 3a, 3b) — empty = from file name, then list order' }),
          }),
          { label: 'Gallery', itemLabel: (p) => [p.fields.seq.value, p.fields.image.value?.filename || p.fields.alt.value || 'Image'].filter(Boolean).join(' · ') },
        ),
        videos: fields.array(
          fields.object({
            youtube: fields.url({ label: 'YouTube URL' }),
            title: fields.text({ label: 'Title' }),
            vertical: fields.checkbox({ label: 'Vertical (9:16)', defaultValue: false }),
            poster: image('Poster (optional)'),
            seq: fields.text({ label: 'Position (e.g. 1, 2, 3a, 3b) — empty = from file name, then list order' }),
          }),
          { label: 'Videos', itemLabel: (p) => [p.fields.seq.value, p.fields.title.value || p.fields.poster.value?.filename || 'Video'].filter(Boolean).join(' · ') },
        ),
        credits: fields.text({ label: 'Credits (e.g. Concept · Photography · Editing)' }),
        body: i18nText('Case study text (Markdown: ### title, - list, **bold**)', true),
        featured: fields.checkbox({ label: 'Show on home canvas', defaultValue: true }),
        order: fields.integer({ label: 'Order', defaultValue: 0 }),
      },
    }),
  },
  singletons: {
    settings: singleton({
      label: 'Site settings',
      path: 'src/content/settings/site',
      format: 'yaml',
      schema: {
        defaultTheme: fields.select({
          label: 'Default theme',
          options: [
            { label: 'Dark (current)', value: 'dark' },
            { label: 'Light (sub.global style)', value: 'light' },
          ],
          defaultValue: 'dark',
        }),
        name: fields.text({ label: 'Name' }),
        role: i18nText('Role / tagline'),
        bio: i18nText('About text', true),
        availability: i18nText('Availability'),
        skills: fields.array(fields.text({ label: 'Skill' }), {
          label: 'Skills',
          itemLabel: (p) => p.value,
        }),
        location: fields.text({ label: 'Location' }),
        email: fields.text({ label: 'Email' }),
        socials: fields.array(
          fields.object({ label: fields.text({ label: 'Label' }), url: fields.url({ label: 'URL' }) }),
          { label: 'Social links', itemLabel: (p) => p.fields.label.value },
        ),
      },
    }),
  },
});
