import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { describe, expect, it } from 'vitest';
import type { RenderedArtifact } from './RenderArtifact';
import { createS3RenderArtifactStore } from './S3RenderArtifactStore';

const runAwsIntegrationTests = process.env.MOTION_ART_AWS_INTEGRATION === '1'
  ? describe
  : describe.skip;

runAwsIntegrationTests('S3RenderArtifactStore AWS integration', () => {
  it('round-trips an artifact through the real private S3 bucket', async () => {
    const bucketName = readRequiredEnvironmentVariable('MOTION_ART_ARTIFACT_BUCKET');
    const identity = randomUUID();
    const jobId = `integration-job-${identity}`;
    const fileName = `integration-preview-${identity}.mp4`;
    const objectKey = `previews/${encodeURIComponent(jobId)}/${encodeURIComponent(fileName)}`;
    const cleanupClient = new S3Client({});
    const store = createS3RenderArtifactStore({ bucketName });
    const artifact: RenderedArtifact = {
      deliverableId: 'spotify-track:integration-track',
      fileName,
      contentType: 'video/mp4',
      width: 2,
      height: 2,
      frameCount: 1,
      bytes: new Uint8Array([0, 1, 2, 3]),
    };

    try {
      await store.put(jobId, artifact);

      await expect(store.getArtifact(jobId, fileName)).resolves.toEqual(artifact);
    } finally {
      await cleanupClient.send(new DeleteObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
      }));
    }
  });
});

function readRequiredEnvironmentVariable(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
