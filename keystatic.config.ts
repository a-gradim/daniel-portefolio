import { config, collection, singleton, fields } from '@keystatic/core';

// Bilingual text helper: every user-facing string has an EN and a PT version.
const i18nText = (label: string, multiline = false) =>
  fields.object(
    {
      en: fields.text({ label: 'English', multiline }),
      pt: fields.text({ label: 'Português', multiline }),
    },
    { label },
  );

const image = (label: string) =>
  fields.image({
    label,
    directory: 'src/assets/projects',
    publicPath: '../../assets/projects/',
  });

export default config({
  storage: import.meta.env.PROD
    ? { kind: 'github', repo: 'a-gradim/daniel-portefolio' }
    : { kind: 'local' },
  ui: {
    brand: { name: 'Daniel Neto' },
    navigation: { Content: ['projects', 'sections'], Site: ['settings'] },
  },
  collections: {
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
        discipline: i18nText('Discipline (e.g. Photography / Video)'),
        client: fields.text({ label: 'Client / note' }),
        cover: image('Cover image'),
        gallery: fields.array(
          fields.object({ image: image('Image'), alt: fields.text({ label: 'Alt text' }) }),
          { label: 'Gallery', itemLabel: (p) => p.fields.alt.value || 'Image' },
        ),
        videos: fields.array(
          fields.object({
            youtube: fields.url({ label: 'YouTube URL' }),
            title: fields.text({ label: 'Title' }),
            vertical: fields.checkbox({ label: 'Vertical (9:16)', defaultValue: false }),
            poster: image('Poster (optional)'),
          }),
          { label: 'Videos', itemLabel: (p) => p.fields.title.value || 'Video' },
        ),
        credits: fields.text({ label: 'Credits (e.g. Concept · Photography · Editing)' }),
        body: i18nText('Case study text', true),
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
