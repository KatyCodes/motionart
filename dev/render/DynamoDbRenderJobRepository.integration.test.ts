import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { describe, expect, it } from 'vitest';
import { createSubmittedRenderJob, startRenderJob } from '../../src/render/RenderJob';
import type { RenderRequest } from '../../src/render/RenderRequest';
import { createDynamoDbRenderJobRepository } from './DynamoDbRenderJobRepository';

const runAwsIntegrationTests =
  process.env.MOTION_ART_AWS_INTEGRATION === '1' ? describe : describe.skip;

runAwsIntegrationTests('DynamoDbRenderJobRepository AWS integration', () => {
  it('creates, reads, revision-checks, and deletes a job in the real table', async () => {
    const tableName = readRequiredEnvironmentVariable('MOTION_ART_RENDER_JOB_TABLE');
    const jobId = `integration-job-${randomUUID()}`;
    const timestamp = new Date().toISOString();
    const request = createRequest(jobId);
    const job = createSubmittedRenderJob(request, jobId, timestamp);
    const repository = createDynamoDbRenderJobRepository({ tableName });
    const cleanupClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

    try {
      const created = await repository.create({ job, request });
      await expect(repository.find(jobId)).resolves.toEqual(created);

      const processing = await repository.update({
        ...created,
        job: startRenderJob(created.job, new Date().toISOString()),
      });
      await expect(repository.find(jobId)).resolves.toEqual(processing);
      await expect(repository.update(created)).rejects.toThrow(
        `Render job revision conflict: ${jobId}`,
      );
    } finally {
      await cleanupClient.send(
        new DeleteCommand({
          TableName: tableName,
          Key: { jobId },
        }),
      );
    }
  });
});

function createRequest(jobId: string): RenderRequest {
  return {
    schemaVersion: 1,
    launchId: `integration-launch-${jobId}`,
    deliverables: [
      {
        id: 'apple-album',
        target: { kind: 'apple-album', albumId: 'integration-album' },
        title: 'Integration Album',
        artwork: { provider: 'integration-test', assetKey: 'artwork' },
        motion: { style: 'water', speed: 1, intensity: 0.5, loopBehavior: 'loop' },
        destination: {
          profileId: 'integration-square',
          name: 'Integration square',
          aspectRatio: { width: 1, height: 1 },
        },
        output: { width: 2, height: 2, durationSeconds: 1, format: 'gif' },
      },
    ],
  };
}

function readRequiredEnvironmentVariable(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
