import { useEffect, useState } from 'react';
import { getDataStore } from './dataStore';

const MAX_EDGE = 800;

function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image'));
    };
    image.src = url;
  });
}

/**
 * Resize to at most 800px on the long edge and encode as WebP (alpha preserved).
 * Falls back to PNG if WebP is unavailable.
 */
export async function prepareImageUpload(file: File): Promise<File> {
  const image = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error('Image encode failed'));
      },
      'image/webp',
      0.9,
    );
  }).catch(
    () =>
      new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (result) resolve(result);
            else reject(new Error('Image encode failed'));
          },
          'image/png',
        );
      }),
  );

  const extension = blob.type === 'image/png' ? 'png' : 'webp';
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
  return new File([blob], `${baseName}.${extension}`, { type: blob.type });
}

/** Resolve a storage key to a display URL; returns null while loading or on error. */
export function useImageUrl(key: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!key) {
      setUrl(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const resolved = await getDataStore().resolveImageUrl(key);
        if (!cancelled) setUrl(resolved);
      } catch {
        if (!cancelled) setUrl(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key]);

  return url;
}
