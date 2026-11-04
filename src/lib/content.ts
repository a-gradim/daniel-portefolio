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

/** All images of a project in sequence order (see projectMedia). */
export function projectImages(p: Project) {
  return projectMedia(p).map((m) => ({ src: m.src, alt: m.alt }));
}

export type MediaItem = {
  kind: 'image' | 'video';
  src: ImageMetadata;
  alt: string;
  /** Sequence key, e.g. "3a". Same number = parallel branch (same rank). */
  seq: string;
  rank: number;
  youtube: string | null;
  vertical: boolean;
};

/** "3a" / "3a_name.jpg" / "01-name.webp" -> { rank: 3, branch: 'a' }. */
export function parseSeq(s?: string | null) {
  const m = s?.trim().match(/^(\d+)([a-z]?)(?=[_\-. ]|$)/i);
  return m ? { rank: Number(m[1]), branch: m[2].toLowerCase() } : null;
}

/** Original file name (without hash/extension) of an imported image. */
const fileName = (img: ImageMetadata) =>
  decodeURIComponent(img.src.split('?')[0].split('/').pop() ?? '').split('.')[0];

/**
 * All media of a project (cover, gallery, videos with a poster) sorted into a sequence graph.
 * Order comes from the "Position" field, else the file-name prefix (1_, 2_, 3a_, 3b_), else list order.
 * Use `mediaEdges` to get the lines between consecutive ranks.
 */
const folderImages = import.meta.glob<ImageMetadata>('/src/assets/projects/*/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP}', {
  eager: true,
  import: 'default',
});

export function projectMedia(p: Project): MediaItem[] {
  const list: (Omit<MediaItem, 'seq' | 'rank'> & { seqField?: string | null })[] = [];
  // Skip the cover when it is also a video poster (video-only projects): the video tile represents it.
  const posterSrcs = new Set(p.data.videos.flatMap((v) => (v.poster ? [v.poster.src] : [])));
  if (p.data.cover && !posterSrcs.has(p.data.cover.src))
    list.push({ kind: 'image', src: p.data.cover, alt: p.data.title, youtube: null, vertical: false });
  for (const g of p.data.gallery)
    list.push({ kind: 'image', src: g.image, alt: g.alt || p.data.title, youtube: null, vertical: false, seqField: g.seq });
  for (const v of p.data.videos)
    if (v.poster)
      list.push({ kind: 'video', src: v.poster, alt: v.title || p.data.title, youtube: v.youtube ?? null, vertical: v.vertical, seqField: v.seq });
  // Images dropped straight into src/assets/projects/<slug>/ (e.g. bulk upload on GitHub) join the gallery automatically.
  const known = new Set(list.map((m) => m.src.src.split('?')[0]));
  for (const [path, img] of Object.entries(folderImages))
    if (path.startsWith(`/src/assets/projects/${p.id}/`) && !known.has(img.src.split('?')[0]))
      list.push({ kind: 'image', src: img, alt: p.data.title, youtube: null, vertical: false, seqField: null });
  const items = list.map((m, i) => {
    const parsed = parseSeq(m.seqField) ?? parseSeq(fileName(m.src));
    const { seqField: _seq, ...rest } = m;
    return parsed
      ? { ...rest, rank: parsed.rank, seq: `${parsed.rank}${parsed.branch}`, i }
      : { ...rest, rank: Number.MAX_SAFE_INTEGER, seq: '', i };
  });
  // The cover has no Position field: if its file-name number collides with another item, it goes first.
  const cover = list[0] && !('seqField' in list[0]) ? items[0] : null;
  if (cover && items.some((m) => m !== cover && m.rank === cover.rank)) {
    const min = Math.min(...items.filter((m) => m !== cover).map((m) => m.rank));
    cover.rank = Math.max(0, min - 1);
    cover.seq = String(cover.rank);
  }
  // Items without any sequence keep list order after the numbered ones.
  items.sort((a, b) => a.rank - b.rank || a.seq.localeCompare(b.seq) || a.i - b.i);
  let last = 0;
  return items.map(({ i: _i, ...m }) => {
    if (m.rank === Number.MAX_SAFE_INTEGER) m = { ...m, rank: ++last, seq: String(last) };
    else last = m.rank;
    return m;
  });
}

/** Edges (index pairs into projectMedia) linking every item of a rank to every item of the next rank. */
export function mediaEdges(media: MediaItem[]): [number, number][] {
  const ranks = [...new Set(media.map((m) => m.rank))].sort((a, b) => a - b);
  const byRank = new Map(ranks.map((r) => [r, media.flatMap((m, i) => (m.rank === r ? [i] : []))]));
  const edges: [number, number][] = [];
  for (let k = 0; k < ranks.length - 1; k++)
    for (const a of byRank.get(ranks[k])!) for (const b of byRank.get(ranks[k + 1])!) edges.push([a, b]);
  return edges;
}

/** YouTube URL -> video id (supports watch?v=, youtu.be/, shorts/, embed/). */
export function youtubeId(url?: string | null) {
  if (!url) return null;
  const m = url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/);
  return m ? m[1] : null;
}
