import { createElement } from 'react';
import { fields } from '@keystatic/core';

// Keystatic image field that shrinks photos in the browser before they are saved
// (big originals make the GitHub commit fail with "failed to fetch").
const MAX_SIDE = 2400; // px, longest side
const QUALITY = 0.82;
const SKIP_BELOW = 1_200_000; // bytes: small enough files that are already within MAX_SIDE stay untouched

type ImageValue = { data: Uint8Array; extension: string; filename: string } | null;

export async function shrink(value: ImageValue): Promise<ImageValue> {
  if (!value || !/^(jpe?g|png|webp)$/i.test(value.extension)) return value;
  const bitmap = await createImageBitmap(new Blob([value.data as BlobPart]));
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && value.data.byteLength < SKIP_BELOW) return value;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', QUALITY));
  if (!blob || blob.size >= value.data.byteLength) return value;

  return {
    data: new Uint8Array(await blob.arrayBuffer()),
    extension: 'webp',
    filename: value.filename.replace(/\.[^.]+$/, '') + '.webp',
  };
}

/** "3a Nome Ação.JPG" -> "3a-nome-acao.jpg" (keeps the 1_/3a_ prefix, safe for URLs). */
export function safeName(name: string) {
  const dot = name.lastIndexOf('.');
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\w-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'image';
  return dot > 0 ? `${base}.${name.slice(dot + 1).toLowerCase()}` : base;
}

export function compressedImage(opts: Parameters<typeof fields.image>[0]) {
  const base = fields.image(opts);
  return {
    ...base,
    Input(props: Parameters<typeof base.Input>[0]) {
      const onChange = (input: ImageValue) => {
        const v = input && { ...input, filename: safeName(input.filename) };
        shrink(v).then(props.onChange as (v: ImageValue) => void, () => props.onChange(v as never));
      };
      return createElement(base.Input, { ...props, onChange } as typeof props);
    },
    // Keep the uploaded file's own name instead of Keystatic's "gallery/0/image.jpg".
    serialize(value: Parameters<typeof base.serialize>[0], args: Parameters<typeof base.serialize>[1]) {
      return base.serialize(value, { ...args, suggestedFilenamePrefix: undefined });
    },
  } as typeof base;
}
