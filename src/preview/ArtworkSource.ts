export type ArtworkSource =
  | {
      type: 'url';
      url: string;
    }
  | {
      type: 'blob';
      blob: Blob;
    }
  | {
      type: 'loader';
      load: (signal: AbortSignal) => Promise<Blob>;
    };

export interface DecodedArtwork {
  resource: ImageBitmap | HTMLImageElement;
  dispose: () => void;
}

export async function decodeArtwork(
  source: ArtworkSource,
  signal: AbortSignal,
): Promise<DecodedArtwork> {
  const blob = await resolveBlob(source, signal);
  signal.throwIfAborted();

  if (blob.size === 0) {
    throw new Error('The artwork source returned an empty file.');
  }

  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob);

      if (signal.aborted) {
        bitmap.close();
        signal.throwIfAborted();
      }

      return {
        resource: bitmap,
        dispose: () => bitmap.close(),
      };
    } catch (error) {
      // Browser support varies by image format. Chromium, for example, exposes
      // createImageBitmap but may reject SVG files that an Image can decode.
      if (signal.aborted) throw error;
    }
  }

  return decodeWithImageElement(blob, signal);
}

async function resolveBlob(source: ArtworkSource, signal: AbortSignal): Promise<Blob> {
  switch (source.type) {
    case 'url': {
      let response: Response;

      try {
        response = await fetch(source.url, {
          mode: 'cors',
          signal,
        });
      } catch (error) {
        if (signal.aborted) signal.throwIfAborted();

        throw new Error(
          'The browser could not fetch this artwork URL. The image host must allow cross-origin image requests (CORS), or the embedding host must provide the image through a loader.',
          { cause: error },
        );
      }

      if (!response.ok) {
        throw new Error(`Artwork request failed with status ${response.status}.`);
      }

      return response.blob();
    }
    case 'blob':
      return source.blob;
    case 'loader':
      return source.load(signal);
  }
}

async function decodeWithImageElement(
  blob: Blob,
  signal: AbortSignal,
): Promise<DecodedArtwork> {
  const image = new Image();
  const objectUrl = URL.createObjectURL(blob);

  try {
    image.src = objectUrl;
    await image.decode();
    signal.throwIfAborted();

    return {
      resource: image,
      dispose: () => {
        image.src = '';
      },
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
