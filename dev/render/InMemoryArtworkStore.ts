import {
  getArtworkReferenceKey,
  type ArtworkReference,
} from '../../src/model/ArtworkReference';

export interface RenderArtworkResolver {
  resolve(reference: ArtworkReference): Promise<Uint8Array>;
}

export interface RenderArtworkStore extends RenderArtworkResolver {
  register(reference: ArtworkReference, bytes: Uint8Array): void;
}

export interface InMemoryArtworkStoreOptions {
  maximumBytes?: number;
}

/** Development-only storage; bytes disappear when the Vite process stops. */
export function createInMemoryArtworkStore(
  options: InMemoryArtworkStoreOptions = {},
): RenderArtworkStore {
  const assets = new Map<string, Uint8Array>();
  const maximumBytes = options.maximumBytes ?? 20_000_000;

  return {
    register(reference, bytes) {
      if (bytes.byteLength === 0) {
        throw new RangeError('Registered artwork cannot be empty.');
      }
      if (bytes.byteLength > maximumBytes) {
        throw new RangeError(`Registered artwork cannot exceed ${maximumBytes} bytes.`);
      }

      assets.set(getArtworkReferenceKey(reference), bytes.slice());
    },

    async resolve(reference) {
      const bytes = assets.get(getArtworkReferenceKey(reference));
      if (!bytes) {
        throw new Error(
          `Artwork is not registered for ${reference.provider}:${reference.assetKey}.`,
        );
      }

      return bytes.slice();
    },
  };
}
