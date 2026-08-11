import type { RenderRequest } from '../src/render/RenderRequest';
import type { RenderService } from '../src/render/RenderService';

export interface LocalRenderApiCall {
  method: string;
  path: string;
  body?: unknown;
}

export interface LocalRenderApiResponse {
  status: number;
  body: unknown;
}

export interface LocalRenderApi {
  handle(call: LocalRenderApiCall): Promise<LocalRenderApiResponse>;
}

/** Development-only HTTP-shaped wrapper around the same service used by unit tests. */
export function createLocalRenderApi(renderService: RenderService): LocalRenderApi {
  return {
    async handle({ method, path, body }) {
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
