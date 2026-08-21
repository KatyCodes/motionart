import {
  getArtworkReferenceKey,
  type ArtworkReference,
} from '../model/ArtworkReference';
import {
  resolveArtworkBlob,
  type ArtworkSource,
} from '../preview/ArtworkSource';
import type { RenderFetch } from './HttpRenderService';
import type { RenderRequest } from './RenderRequest';
import type { RenderServiceRequestOptions } from './RenderService';

export interface ArtworkRegistrationService {
  register(
    reference: ArtworkReference,
    source: ArtworkSource,
    options?: RenderServiceRequestOptions,
  ): Promise<void>;
}

export interface HttpArtworkRegistrationServiceOptions {
  baseUrl?: string;
  fetch?: RenderFetch;
  getHeaders?: () => HeadersInit | Promise<HeadersInit>;
}

/**
 * Registers temporary image bytes for a durable reference before local rendering.
 * Production hosts may instead resolve the same reference inside their backend.
 */
export function createHttpArtworkRegistrationService({
  baseUrl = '',
  fetch: fetchOverride,
  getHeaders,
}: HttpArtworkRegistrationServiceOptions = {}): ArtworkRegistrationService {
  const endpoint = normalizeBaseUrl(baseUrl);
  const fetchRequest = fetchOverride ?? globalThis.fetch.bind(globalThis);

  return {
    async register(reference, source, options) {
      const signal = options?.signal ?? new AbortController().signal;
      const blob = await resolveArtworkBlob(source, signal);

      if (blob.size === 0) {
        throw new RangeError('Render artwork cannot be empty.');
      }
      if (blob.type && !blob.type.toLowerCase().startsWith('image/')) {
        throw new TypeError(`Render artwork must be an image; received ${blob.type}.`);
      }

      const headers = new Headers(await getHeaders?.());
      headers.set('Content-Type', blob.type || 'application/octet-stream');
      headers.set('Accept', 'application/json');
      const response = await fetchRequest(createRegistrationUrl(endpoint, reference), {
        method: 'PUT',
        headers,
        body: blob,
        signal: options?.signal,
      });

      if (!response.ok) {
        throw new Error(await readRegistrationError(response));
      }
    },
  };
}

export function createNoopArtworkRegistrationService(): ArtworkRegistrationService {
  return { async register() {} };
}

/** Resolves and registers every distinct artwork reference required by a job. */
export async function registerRenderRequestArtwork(
  request: RenderRequest,
  resolveArtwork: (reference: ArtworkReference) => ArtworkSource,
  registrationService: ArtworkRegistrationService,
  options?: RenderServiceRequestOptions,
): Promise<void> {
  const references = new Map<string, ArtworkReference>();

  for (const deliverable of request.deliverables) {
    references.set(getArtworkReferenceKey(deliverable.artwork), deliverable.artwork);
  }

  await Promise.all([...references.values()].map((reference) => (
    registrationService.register(reference, resolveArtwork(reference), options)
  )));
}

function createRegistrationUrl(baseUrl: string, reference: ArtworkReference): string {
  const path = [reference.provider, reference.assetKey, reference.version]
    .filter((segment): segment is string => segment !== undefined)
    .map(encodeURIComponent)
    .join('/');
  return `${baseUrl}/render-assets/${path}`;
}

function normalizeBaseUrl(baseUrl: string): string {
  const value = baseUrl.trim();
  if (!value || value === '/') return '';
  return value.replace(/\/+$/, '');
}

async function readRegistrationError(response: Response): Promise<string> {
  const fallback = `Artwork registration failed (${response.status}).`;
  const text = await response.text();
  if (!text.trim()) return fallback;

  try {
    const value = JSON.parse(text) as unknown;
    if (
      value
      && typeof value === 'object'
      && 'message' in value
      && typeof value.message === 'string'
      && value.message.trim()
    ) {
      return value.message;
    }
  } catch {
    return fallback;
  }

  return fallback;
}
