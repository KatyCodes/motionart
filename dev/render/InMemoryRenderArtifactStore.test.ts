import { describe, expect, it } from 'vitest';
import type { RenderedArtifact } from './RenderArtifact';
import { createInMemoryRenderArtifactStore } from './InMemoryRenderArtifactStore';

function createArtifact(): RenderedArtifact {
  return {
    deliverableId: 'spotify-track:track-1',
    fileName: 'signal-preview.mp4',
    contentType: 'video/mp4',
    width: 180,
    height: 320,
    frameCount: 16,
    bytes: new Uint8Array([1, 2, 3]),
  };
}

describe('InMemoryRenderArtifactStore', () => {
  it('stores artifacts by durable job and file identity without sharing mutable bytes', async () => {
    const store = createInMemoryRenderArtifactStore();
    const artifact = createArtifact();
    await store.put('render-1', artifact);

    artifact.bytes[0] = 99;
    const firstRead = await store.getArtifact('render-1', 'signal-preview.mp4');
    expect(firstRead).toEqual({ ...artifact, bytes: new Uint8Array([1, 2, 3]) });

    if (!firstRead) throw new Error('Expected the stored artifact.');
    firstRead.bytes[1] = 88;
    await expect(store.getArtifact('render-1', 'signal-preview.mp4')).resolves.toMatchObject({
      bytes: new Uint8Array([1, 2, 3]),
    });
  });

  it('does not confuse identical file names from different jobs', async () => {
    const store = createInMemoryRenderArtifactStore();
    const artifact = createArtifact();
    await store.put('render-1', artifact);

    await expect(store.getArtifact('render-2', artifact.fileName)).resolves.toBeUndefined();
  });
});
