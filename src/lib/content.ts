import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import type { Locale } from '../i18n/ui';

export type Project = CollectionEntry<'projects'>;
export type Section = CollectionEntry<'sections'>;

/** Pick the localized value of an {en, pt} field, falling back to EN. */
export const pick = (v: { en: string; pt: string } | undefined, locale: Locale) =>
  (v?.[locale] || v?.en || '').trim();

export async function getSections() {
  return (await getCollection('sections')).sort((a, b) => a.data.order - b.data.order);
}

/** Projects ordered by section order, then project order, then year desc. */
export async function getProjects() {
  const sections = await getSections();
  const sectionOrder = new Map(sections.map((s, i) => [s.id, i]));
  return (await getCollection('projects')).sort(
    (a, b) =>
      (sectionOrder.get(a.data.section ?? '') ?? 999) - (sectionOrder.get(b.data.section ?? '') ?? 999) ||
      a.data.order - b.data.order ||
      (b.data.year ?? 0) - (a.data.year ?? 0),
  );
}

export async function getSettings() {
  const s = await getEntry('settings', 'site');
  if (!s) throw new Error('Missing src/content/settings/site.yaml');
  return s.data;
}

/** All images of a project in display order (cover first, then gallery, then video posters). */
export function projectImages(p: Project) {
  const imgs = p.data.gallery.map((g) => ({ src: g.image, alt: g.alt || p.data.title }));
  if (p.data.cover) imgs.unshift({ src: p.data.cover, alt: p.data.title });
  for (const v of p.data.videos) if (v.poster) imgs.push({ src: v.poster, alt: v.title || p.data.title });
  return imgs;
}

/** YouTube URL -> video id (supports watch?v=, youtu.be/, shorts/, embed/). */
export function youtubeId(url?: string | null) {
  if (!url) return null;
  const m = url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/);
  return m ? m[1] : null;
}
