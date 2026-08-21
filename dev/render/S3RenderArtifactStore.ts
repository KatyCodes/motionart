import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { RenderArtifactStore, RenderedArtifact } from './RenderArtifact';

type S3ArtifactCommand = GetObjectCommand | PutObjectCommand;

export interface S3ArtifactClient {
  send(command: S3ArtifactCommand): Promise<unknown>;
}

export interface S3RenderArtifactStoreOptions {
  bucketName: string;
  client?: S3ArtifactClient;
}

export function createS3RenderArtifactStore({
  bucketName,
  client: clientOverride,
}: S3RenderArtifactStoreOptions): RenderArtifactStore {
  requireText(bucketName, 'bucket name');
  const client = clientOverride ?? createAwsS3ArtifactClient();

  return {
    async put(jobId, artifact) {
      await client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: createObjectKey(jobId, artifact.fileName),
        Body: artifact.bytes,
        ContentType: artifact.contentType,
        Metadata: {
          deliverableid: artifact.deliverableId,
          width: String(artifact.width),
          height: String(artifact.height),
          framecount: String(artifact.frameCount),
        },
      }));
    },

    async getArtifact(jobId, fileName) {
      try {
        const response = await client.send(new GetObjectCommand({
          Bucket: bucketName,
          Key: createObjectKey(jobId, fileName),
        }));
        return readArtifact(response, fileName);
      } catch (error) {
        if (isNotFound(error)) return undefined;
        throw error;
      }
    },
  };
}

function createAwsS3ArtifactClient(): S3ArtifactClient {
  const client = new S3Client({});

  return {
    send(command) {
      if (command instanceof PutObjectCommand) return client.send(command);
      return client.send(command);
    },
  };
}

function createObjectKey(jobId: string, fileName: string): string {
  requireText(jobId, 'render job ID');
  requireText(fileName, 'artifact file name');
  return `previews/${encodeURIComponent(jobId)}/${encodeURIComponent(fileName)}`;
}

async function readArtifact(response: unknown, fileName: string): Promise<RenderedArtifact> {
  if (!isRecord(response)) throw new TypeError('S3 returned an invalid artifact response.');

  const body = response.Body;
  if (!hasByteArrayTransformer(body)) {
    throw new TypeError('S3 artifact response is missing its body.');
  }

  const contentType = readRequiredText(response.ContentType, 'content type');
  const metadata = isRecord(response.Metadata) ? response.Metadata : {};
  const deliverableId = readMetadataText(metadata, 'deliverableid');
  const width = readMetadataInteger(metadata, 'width');
  const height = readMetadataInteger(metadata, 'height');
  const frameCount = readMetadataInteger(metadata, 'framecount');
  const bytes = await body.transformToByteArray();

  return {
    deliverableId,
    fileName,
    contentType,
    width,
    height,
    frameCount,
    bytes,
  };
}

function readMetadataText(metadata: Record<string, unknown>, name: string): string {
  const value = metadata[name];
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`S3 artifact metadata is missing ${name}.`);
  }
  return value;
}

function readMetadataInteger(metadata: Record<string, unknown>, name: string): number {
  const value = readMetadataText(metadata, name);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new TypeError(`S3 artifact metadata has an invalid ${name}.`);
  }
  return parsed;
}

function readRequiredText(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`S3 artifact response is missing its ${name}.`);
  }
  return value;
}

function requireText(value: string, name: string): void {
  if (!value.trim()) throw new TypeError(`The ${name} cannot be empty.`);
}

function hasByteArrayTransformer(value: unknown): value is {
  transformToByteArray(): Promise<Uint8Array>;
} {
  return isRecord(value) && typeof value.transformToByteArray === 'function';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNotFound(error: unknown): boolean {
  if (!isRecord(error)) return false;
  const metadata = isRecord(error.$metadata) ? error.$metadata : {};
  return error.name === 'NoSuchKey'
    || error.name === 'NotFound'
    || metadata.httpStatusCode === 404;
}
