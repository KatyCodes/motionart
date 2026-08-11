import { describe, expect, it } from 'vitest';
import { createInMemoryArtworkStore } from './InMemoryArtworkStore';

describe('InMemoryArtworkStore', () => {
  it('resolves the bytes registered for an exact durable reference', async () => {
    const store = createInMemoryArtworkStore();
    const reference = { provider: 'cdbaby', assetKey: 'cover', version: '2' };

    store.register(reference, new Uint8Array([1, 2, 3]));

    expect(await store.resolve(reference)).toEqual(new Uint8Array([1, 2, 3]));
    await expect(store.resolve({ ...reference, version: '3' })).rejects.toThrow(
      'Artwork is not registered',
    );
  });

  it('rejects empty and oversized assets', () => {
    const store = createInMemoryArtworkStore({ maximumBytes: 3 });
    const reference = { provider: 'cdbaby', assetKey: 'cover' };

    expect(() => store.register(reference, new Uint8Array())).toThrow('empty');
    expect(() => store.register(reference, new Uint8Array(4))).toThrow('3 bytes');
  });
});
