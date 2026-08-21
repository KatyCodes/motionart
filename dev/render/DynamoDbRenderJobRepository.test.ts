import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { describe, expect, it, vi } from 'vitest';
import { createSubmittedRenderJob } from '../../src/render/RenderJob';
import type { RenderRequest } from '../../src/render/RenderRequest';
import {
  createDynamoDbRenderJobRepository,
  type DynamoDbJobClient,
} from './DynamoDbRenderJobRepository';

const tableName = 'motion-art-development-render-jobs';
const timestamp = '2026-08-11T12:00:00.000Z';
const expiresAt = Math.floor(new Date(timestamp).getTime() / 1_000) + 3_600;

const request: RenderRequest = {
  schemaVersion: 1,
  launchId: 'checkout-dynamodb',
  deliverables: [
    {
      id: 'apple-album',
      target: { kind: 'apple-album', albumId: 'album-1' },
      title: 'Night Drive',
      artwork: { provider: 'cdbaby', assetKey: 'album-cover' },
      motion: { style: 'water', speed: 1, intensity: 0.7, loopBehavior: 'loop' },
      destination: {
        profileId: 'apple-music-cover-art-v1',
        name: 'Apple Music cover art',
        aspectRatio: { width: 1, height: 1 },
      },
      output: { width: 4000, height: 4000, durationSeconds: 8, format: 'gif' },
    },
  ],
};

function createJob() {
  return createSubmittedRenderJob(request, 'render-1', timestamp);
}

function createClient(send: DynamoDbJobClient['send']): DynamoDbJobClient {
  return { send };
}

describe('DynamoDbRenderJobRepository', () => {
  it('creates a versioned job only when its ID is unused', async () => {
    const send = vi.fn<DynamoDbJobClient['send']>().mockResolvedValue({});
    const repository = createDynamoDbRenderJobRepository({
      tableName,
      client: createClient(send),
      retentionSeconds: 3_600,
      now: () => new Date(timestamp),
    });
    const job = createJob();

    await expect(repository.create({ job, request })).resolves.toEqual({
      job,
      request,
      revision: 0,
    });

    const command = send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(PutCommand);
    expect(command?.input).toEqual({
      TableName: tableName,
      Item: { jobId: job.id, job, request, revision: 0, expiresAt },
      ConditionExpression: 'attribute_not_exists(jobId)',
    });
  });

  it('maps a conditional create failure to a domain-specific duplicate error', async () => {
    const conditionalFailure = Object.assign(new Error('Conditional request failed'), {
      name: 'ConditionalCheckFailedException',
    });
    const client = createClient(
      vi.fn<DynamoDbJobClient['send']>().mockRejectedValue(conditionalFailure),
    );
    const repository = createDynamoDbRenderJobRepository({ tableName, client });

    await expect(repository.create({ job: createJob(), request })).rejects.toThrow(
      'Render job already exists: render-1',
    );
  });

  it('updates only the revision that the caller previously read', async () => {
    const send = vi.fn<DynamoDbJobClient['send']>().mockResolvedValue({});
    const repository = createDynamoDbRenderJobRepository({
      tableName,
      client: createClient(send),
      retentionSeconds: 3_600,
      now: () => new Date(timestamp),
    });
    const stored = { job: createJob(), request, revision: 4 };

    await expect(repository.update(stored)).resolves.toEqual({ ...stored, revision: 5 });

    const command = send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(PutCommand);
    expect(command?.input).toEqual({
      TableName: tableName,
      Item: { jobId: 'render-1', job: stored.job, request, revision: 5, expiresAt },
      ConditionExpression: 'attribute_exists(jobId) AND #revision = :expectedRevision',
      ExpressionAttributeNames: { '#revision': 'revision' },
      ExpressionAttributeValues: { ':expectedRevision': 4 },
    });
  });

  it('maps a conditional update failure to a revision conflict', async () => {
    const conditionalFailure = Object.assign(new Error('Conditional request failed'), {
      name: 'ConditionalCheckFailedException',
    });
    const client = createClient(
      vi.fn<DynamoDbJobClient['send']>().mockRejectedValue(conditionalFailure),
    );
    const repository = createDynamoDbRenderJobRepository({ tableName, client });

    await expect(repository.update({ job: createJob(), request, revision: 2 })).rejects.toThrow(
      'Render job revision conflict: render-1',
    );
  });

  it('reads and validates a job with a strongly consistent lookup', async () => {
    const item = {
      jobId: 'render-1',
      job: createJob(),
      request,
      revision: 3,
      expiresAt,
    };
    const send = vi.fn<DynamoDbJobClient['send']>().mockResolvedValue({ Item: item });
    const repository = createDynamoDbRenderJobRepository({
      tableName,
      client: createClient(send),
    });

    const found = await repository.find('render-1');

    expect(found).toEqual({ job: item.job, request, revision: 3 });
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(GetCommand);
    expect(send.mock.calls[0]?.[0].input).toEqual({
      TableName: tableName,
      Key: { jobId: 'render-1' },
      ConsistentRead: true,
    });
  });

  it('returns undefined when a job does not exist', async () => {
    const client = createClient(vi.fn<DynamoDbJobClient['send']>().mockResolvedValue({}));
    const repository = createDynamoDbRenderJobRepository({ tableName, client });

    await expect(repository.find('missing')).resolves.toBeUndefined();
  });

  it('rejects a corrupt record instead of leaking invalid state into the domain', async () => {
    const client = createClient(
      vi.fn<DynamoDbJobClient['send']>().mockResolvedValue({
        Item: {
          jobId: 'different-job',
          job: createJob(),
          request,
          revision: 0,
          expiresAt,
        },
      }),
    );
    const repository = createDynamoDbRenderJobRepository({ tableName, client });

    await expect(repository.find('render-1')).rejects.toThrow(
      'DynamoDB render job ID does not match its lookup key.',
    );
  });
});
