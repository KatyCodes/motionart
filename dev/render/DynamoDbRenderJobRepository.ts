import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { validateRenderJob, type RenderJob } from '../../src/render/RenderJob';
import { validateRenderRequest, type RenderRequest } from '../../src/render/RenderRequest';
import {
  RenderJobAlreadyExistsError,
  RenderJobRevisionConflictError,
  type NewStoredRenderJob,
  type RenderJobRepository,
  type StoredRenderJob,
} from './RenderJobRepository';

const DEFAULT_RETENTION_SECONDS = 7 * 24 * 60 * 60;

type DynamoDbJobCommand = GetCommand | PutCommand;

export interface DynamoDbJobClient {
  send(command: DynamoDbJobCommand): Promise<unknown>;
}

export interface DynamoDbRenderJobRepositoryOptions {
  tableName: string;
  client?: DynamoDbJobClient;
  retentionSeconds?: number;
  now?: () => Date;
}

export function createDynamoDbRenderJobRepository({
  tableName,
  client: clientOverride,
  retentionSeconds = DEFAULT_RETENTION_SECONDS,
  now = () => new Date(),
}: DynamoDbRenderJobRepositoryOptions): RenderJobRepository {
  requireText(tableName, 'table name');
  requirePositiveInteger(retentionSeconds, 'retention seconds');
  const client = clientOverride ?? createAwsDynamoDbJobClient();

  return {
    async create(newStoredJob) {
      const storedJob = createStoredJob(newStoredJob);

      try {
        await client.send(
          new PutCommand({
            TableName: tableName,
            Item: createItem(storedJob, getExpiresAt(now(), retentionSeconds)),
            ConditionExpression: 'attribute_not_exists(jobId)',
          }),
        );
      } catch (error) {
        if (isConditionalFailure(error)) {
          throw new RenderJobAlreadyExistsError(storedJob.job.id);
        }
        throw error;
      }

      return structuredClone(storedJob);
    },

    async update(storedJob) {
      validateStoredJob(storedJob);
      const updated = structuredClone({
        ...storedJob,
        revision: storedJob.revision + 1,
      });

      try {
        await client.send(
          new PutCommand({
            TableName: tableName,
            Item: createItem(updated, getExpiresAt(now(), retentionSeconds)),
            ConditionExpression: 'attribute_exists(jobId) AND #revision = :expectedRevision',
            ExpressionAttributeNames: { '#revision': 'revision' },
            ExpressionAttributeValues: { ':expectedRevision': storedJob.revision },
          }),
        );
      } catch (error) {
        if (isConditionalFailure(error)) {
          throw new RenderJobRevisionConflictError(storedJob.job.id);
        }
        throw error;
      }

      return structuredClone(updated);
    },

    async find(jobId) {
      requireText(jobId, 'render job ID');
      const response = await client.send(
        new GetCommand({
          TableName: tableName,
          Key: { jobId },
          ConsistentRead: true,
        }),
      );

      if (!isRecord(response)) {
        throw new TypeError('DynamoDB returned an invalid render job response.');
      }
      if (response.Item === undefined) return undefined;

      return readStoredJob(response.Item, jobId);
    },
  };
}

function createAwsDynamoDbJobClient(): DynamoDbJobClient {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  });

  return {
    send(command) {
      if (command instanceof GetCommand) return client.send(command);
      return client.send(command);
    },
  };
}

function createStoredJob(newStoredJob: NewStoredRenderJob): StoredRenderJob {
  const storedJob = structuredClone({ ...newStoredJob, revision: 0 });
  validateStoredJob(storedJob);
  return storedJob;
}

function createItem(storedJob: StoredRenderJob, expiresAt: number): Record<string, unknown> {
  return {
    jobId: storedJob.job.id,
    job: storedJob.job,
    request: storedJob.request,
    revision: storedJob.revision,
    expiresAt,
  };
}

function readStoredJob(value: unknown, lookupJobId: string): StoredRenderJob {
  if (!isRecord(value)) throw new TypeError('DynamoDB returned an invalid render job item.');
  if (value.jobId !== lookupJobId) {
    throw new TypeError('DynamoDB render job ID does not match its lookup key.');
  }

  const storedJob = {
    job: value.job as RenderJob,
    request: value.request as RenderRequest,
    revision: value.revision as number,
  };
  validateStoredJob(storedJob);
  return structuredClone(storedJob);
}

function validateStoredJob(storedJob: StoredRenderJob): void {
  validateRenderJob(storedJob.job);
  validateRequestShape(storedJob.request);
  validateRenderRequest(storedJob.request);
  requireNonNegativeInteger(storedJob.revision, 'render job revision');

  if (storedJob.job.launchId !== storedJob.request.launchId) {
    throw new RangeError('Stored render job and request launch IDs do not match.');
  }
  if (storedJob.job.progress.total !== storedJob.request.deliverables.length) {
    throw new RangeError('Stored render job progress does not match its request.');
  }
}

function validateRequestShape(value: unknown): asserts value is RenderRequest {
  if (!isRecord(value) || !Array.isArray(value.deliverables)) {
    throw new TypeError('DynamoDB returned an invalid render request.');
  }
}

function getExpiresAt(now: Date, retentionSeconds: number): number {
  const timestamp = now.getTime();
  if (!Number.isFinite(timestamp)) throw new RangeError('The current time must be a valid date.');
  return Math.floor(timestamp / 1_000) + retentionSeconds;
}

function requireText(value: string, label: string): void {
  if (!value.trim()) throw new TypeError(`The ${label} cannot be empty.`);
}

function requirePositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`The ${label} must be a positive integer.`);
  }
}

function requireNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`The ${label} must be a non-negative integer.`);
  }
}

function isConditionalFailure(error: unknown): boolean {
  return isRecord(error) && error.name === 'ConditionalCheckFailedException';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
