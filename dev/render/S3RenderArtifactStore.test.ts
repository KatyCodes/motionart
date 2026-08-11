import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { describe, expect, it, vi } from 'vitest';
import type { RenderedArtifact } from './RenderArtifact';
import {
  createS3RenderArtifactStore,
  type S3ArtifactClient,
} from './S3RenderArtifactStore';

const bucketName = 'motion-art-development-artifacts';

function createArtifact(): RenderedArtifact {
  return {
    deliverableId: 'spotify-track:track-1',
    fileName: 'Signal / Preview.mp4',
    contentType: 'video/mp4',
    width: 1080,
    height: 1920,
    frameCount: 240,
    bytes: new Uint8Array([1, 2, 3]),
  };
}

function createClient(send: S3ArtifactClient['send']): S3ArtifactClient {
  return { send };
}

describe('S3RenderArtifactStore', () => {
  it('puts artifact bytes and metadata under a deterministic private object key', async () => {
    const send = vi.fn<S3ArtifactClient['send']>().mockResolvedValue({});
    const store = createS3RenderArtifactStore({
      bucketName,
      client: createClient(send),
    });
    const artifact = createArtifact();

    await store.put('render/order 1', artifact);

    expect(send).toHaveBeenCalledOnce();
    const command = send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command?.input).toEqual({
      Bucket: bucketName,
      Key: 'previews/render%2Forder%201/Signal%20%2F%20Preview.mp4',
      Body: artifact.bytes,
      ContentType: 'video/mp4',
      Metadata: {
        deliverableid: 'spotify-track:track-1',
        width: '1080',
        height: '1920',
        framecount: '240',
      },
    });
  });

  it('reconstructs a rendered artifact from an S3 object', async () => {
    const transformToByteArray = vi.fn().mockResolvedValue(new Uint8Array([4, 5, 6]));
    const send = vi.fn<S3ArtifactClient['send']>().mockResolvedValue({
      Body: { transformToByteArray },
      ContentType: 'video/mp4',
      Metadata: {
        deliverableid: 'apple-album:album-1',
        width: '3000',
        height: '3000',
        framecount: '360',
      },
    });
    const store = createS3RenderArtifactStore({
      bucketName,
      client: createClient(send),
    });

    await expect(store.getArtifact('render-2', 'album.mp4')).resolves.toEqual({
      deliverableId: 'apple-album:album-1',
      fileName: 'album.mp4',
      contentType: 'video/mp4',
      width: 3000,
      height: 3000,
      frameCount: 360,
      bytes: new Uint8Array([4, 5, 6]),
    });
    expect(transformToByteArray).toHaveBeenCalledOnce();

    const command = send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(GetObjectCommand);
    expect(command?.input).toEqual({
      Bucket: bucketName,
      Key: 'previews/render-2/album.mp4',
    });
  });

  it('returns undefined when S3 reports that the object does not exist', async () => {
    const notFound = Object.assign(new Error('No such key'), {
      name: 'NoSuchKey',
      $metadata: { httpStatusCode: 404 },
    });
    const client = createClient(vi.fn<S3ArtifactClient['send']>().mockRejectedValue(notFound));
    const store = createS3RenderArtifactStore({ bucketName, client });

    await expect(store.getArtifact('missing-job', 'missing.mp4')).resolves.toBeUndefined();
  });

  it('does not hide permission or service failures as missing objects', async () => {
    const accessDenied = Object.assign(new Error('Access denied'), {
      name: 'AccessDenied',
      $metadata: { httpStatusCode: 403 },
    });
    const client = createClient(vi.fn<S3ArtifactClient['send']>().mockRejectedValue(accessDenied));
    const store = createS3RenderArtifactStore({ bucketName, client });

    await expect(store.getArtifact('render-3', 'private.mp4')).rejects.toBe(accessDenied);
  });

  it('rejects incomplete stored metadata instead of returning a corrupt domain object', async () => {
    const client = createClient(vi.fn<S3ArtifactClient['send']>().mockResolvedValue({
      Body: { transformToByteArray: async () => new Uint8Array([1]) },
      ContentType: 'video/mp4',
      Metadata: { deliverableid: 'spotify-track:track-1' },
    }));
    const store = createS3RenderArtifactStore({ bucketName, client });

    await expect(store.getArtifact('render-4', 'broken.mp4')).rejects.toThrow(
      'S3 artifact metadata is missing width.',
    );
  });
});
