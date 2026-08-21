import { validateRenderJob, type RenderJob } from './RenderJob';
import { validateRenderRequest, type RenderRequest } from './RenderRequest';
import type { RenderService, RenderServiceRequestOptions } from './RenderService';

export type RenderFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface HttpRenderServiceOptions {
  baseUrl: string;
  fetch?: RenderFetch;
  getHeaders?: () => HeadersInit | Promise<HeadersInit>;
}

export class RenderServiceHttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;

  constructor(status: number, code: string, message: string, retryable: boolean) {
    super(message);
    this.name = 'RenderServiceHttpError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

export function createHttpRenderService({
  baseUrl,
  fetch: fetchOverride,
  getHeaders,
}: HttpRenderServiceOptions): RenderService {
  const endpoint = normalizeBaseUrl(baseUrl);
  const fetchRequest = fetchOverride ?? globalThis.fetch.bind(globalThis);

  return {
    async submit(request, requestOptions) {
      validateRenderRequest(request);
      return requestRenderJob(
        fetchRequest,
        `${endpoint}/render-jobs`,
        'POST',
        getHeaders,
        requestOptions,
        request,
      );
    },

    async get(jobId, requestOptions) {
      if (!jobId.trim()) throw new RangeError('Render service requires a job ID.');

      return requestRenderJob(
        fetchRequest,
        `${endpoint}/render-jobs/${encodeURIComponent(jobId)}`,
        'GET',
        getHeaders,
        requestOptions,
      );
    },
  };
}

async function requestRenderJob(
  fetchRequest: RenderFetch,
  url: string,
  method: 'GET' | 'POST',
  getHeaders: HttpRenderServiceOptions['getHeaders'],
  requestOptions: RenderServiceRequestOptions | undefined,
  request?: RenderRequest,
): Promise<RenderJob> {
  const headers = new Headers(await getHeaders?.());
  headers.set('Accept', 'application/json');
  if (request) headers.set('Content-Type', 'application/json');

  const response = await fetchRequest(url, {
    method,
    headers,
    body: request ? JSON.stringify(request) : undefined,
    signal: requestOptions?.signal,
  });

  if (!response.ok) throw await createResponseError(response);

  const value = await readRequiredJson(response);
  validateRenderJob(value);
  return value;
}

async function createResponseError(response: Response): Promise<RenderServiceHttpError> {
  const value = await readOptionalJson(response);
  const error = isRecord(value) ? value : {};
  const code = typeof error.code === 'string' && error.code.trim()
    ? error.code
    : 'RENDER_SERVICE_ERROR';
  const message = typeof error.message === 'string' && error.message.trim()
    ? error.message
    : `Render service request failed (${response.status}).`;
  const retryable = response.status === 408 || response.status === 429 || response.status >= 500;

  return new RenderServiceHttpError(response.status, code, message, retryable);
}

async function readRequiredJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text.trim()) throw new TypeError('Render service returned an empty response.');

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new TypeError('Render service returned invalid JSON.');
  }
}

async function readOptionalJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  const value = baseUrl.trim();

  if (!value) throw new RangeError('HTTP render service requires a base URL.');
  if (value === '/') return '';
  return value.replace(/\/+$/, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
