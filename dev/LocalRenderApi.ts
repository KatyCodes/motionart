import type { RenderRequest } from '../src/render/RenderRequest';
import type { RenderService } from '../src/render/RenderService';
import type { RenderArtifactReader } from './render/RenderArtifact';
import type { RenderArtworkStore } from './render/InMemoryArtworkStore';

export interface LocalRenderApiCall {
  method: string;
  path: string;
  body?: unknown;
}

export interface LocalRenderApiResponse {
  status: number;
  body: unknown;
  contentType?: string;
  fileName?: string;
}

export interface LocalRenderApi {
  handle(call: LocalRenderApiCall): Promise<LocalRenderApiResponse>;
}

/** Development-only HTTP-shaped wrapper around the same service used by unit tests. */
export function createLocalRenderApi(
  renderService: RenderService,
  artifactReader?: RenderArtifactReader,
  artworkStore?: RenderArtworkStore,
): LocalRenderApi {
  return {
    async handle({ method, path, body }) {
      if (method === 'PUT' && path.startsWith('/render-assets/')) {
        if (!artworkStore) {
          return createErrorResponse(501, 'ARTWORK_REGISTRATION_UNAVAILABLE', new Error(
            'The local artwork registration service is unavailable.',
          ));
        }

        try {
          const reference = parseArtworkReferencePath(path);
          if (!(body instanceof Uint8Array)) {
            throw new TypeError('Artwork registration requires binary image data.');
          }
          artworkStore.register(reference, body);
          return { status: 201, body: { reference } };
        } catch (error) {
          return createErrorResponse(400, 'INVALID_ARTWORK_REGISTRATION', error);
        }
      }

      if (method === 'POST' && path === '/render-jobs') {
        try {
          const job = await renderService.submit(body as RenderRequest);
          return { status: 201, body: job };
        } catch (error) {
          return createErrorResponse(400, 'INVALID_RENDER_REQUEST', error);
        }
      }

      if (method === 'GET' && path.startsWith('/render-jobs/')) {
        try {
          const jobId = decodeURIComponent(path.slice('/render-jobs/'.length));
          const job = await renderService.get(jobId);
          return { status: 200, body: job };
        } catch (error) {
          return createErrorResponse(404, 'RENDER_JOB_NOT_FOUND', error);
        }
      }

      if (method === 'GET' && path.startsWith('/render-files/')) {
        const artifactPath = path.slice('/render-files/'.length).split('/');

        if (artifactPath.length === 2 && artifactReader) {
          const jobId = decodeURIComponent(artifactPath[0]);
          const fileName = decodeURIComponent(artifactPath[1]);
          const artifact = await artifactReader.getArtifact(jobId, fileName);

          if (artifact) {
            return {
              status: 200,
              body: artifact.bytes,
              contentType: artifact.contentType,
              fileName: artifact.fileName,
            };
          }
        }

        return {
          status: 404,
          body: {
            code: 'RENDER_ARTIFACT_NOT_FOUND',
            message: 'The rendered preview file was not found.',
          },
        };
      }

      return {
        status: 404,
        body: {
          code: 'LOCAL_ROUTE_NOT_FOUND',
          message: `No local render route matches ${method} ${path}.`,
        },
      };
    },
  };
}

function parseArtworkReferencePath(path: string) {
  const segments = path.slice('/render-assets/'.length).split('/');
  if (segments.length < 2 || segments.length > 3 || segments.some((segment) => !segment)) {
    throw new RangeError('Artwork registration requires a provider, asset key, and optional version.');
  }

  return {
    provider: decodeURIComponent(segments[0]),
    assetKey: decodeURIComponent(segments[1]),
    ...(segments[2] ? { version: decodeURIComponent(segments[2]) } : {}),
  };
}

function createErrorResponse(
  status: number,
  code: string,
  error: unknown,
): LocalRenderApiResponse {
  return {
    status,
    body: {
      code,
      message: error instanceof Error ? error.message : 'The local render request failed.',
    },
  };
}
