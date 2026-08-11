import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import { createLocalRenderApi } from './dev/LocalRenderApi';
import { renderDriftGifPreview } from './dev/render/DriftGifRenderer';
import { createLocalFileRenderService } from './dev/render/LocalFileRenderService';
import { demoRenderApiBaseUrl } from './src/integration/DemoRenderApiConfig';

const maximumRequestBytes = 1_000_000;

export default defineConfig({
  plugins: [localRenderApiPlugin()],
});

function localRenderApiPlugin(): Plugin {
  const renderService = createLocalFileRenderService({
    apiBaseUrl: demoRenderApiBaseUrl,
    async renderDeliverable(deliverable) {
      const artwork = await resolveDemoArtwork(deliverable.artwork.provider);
      return renderDriftGifPreview(deliverable, artwork);
    },
  });
  const api = createLocalRenderApi(renderService, renderService);

  return {
    name: 'company-tbd-local-render-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const path = getApiPath(request.url);
        if (path === null) {
          next();
          return;
        }

        try {
          const body = request.method === 'POST' ? await readJsonBody(request) : undefined;
          const result = await api.handle({
            method: request.method ?? 'GET',
            path,
            body,
          });
          if (result.body instanceof Uint8Array && result.contentType && result.fileName) {
            writeBinary(response, result.status, result.body, result.contentType, result.fileName);
          } else {
            writeJson(response, result.status, result.body);
          }
        } catch (error) {
          writeJson(response, 400, {
            code: 'INVALID_JSON',
            message: error instanceof Error ? error.message : 'The request body is invalid.',
          });
        }
      });
    },
  };
}

async function resolveDemoArtwork(provider: string): Promise<Uint8Array> {
  if (provider !== 'cdbaby') {
    throw new RangeError(`The local preview renderer cannot resolve artwork from ${provider}.`);
  }

  return readFile(new URL('./src/assets/sample-cover.svg', import.meta.url));
}

function getApiPath(requestUrl: string | undefined): string | null {
  if (!requestUrl) return null;

  const pathname = new URL(requestUrl, 'http://localhost').pathname;
  if (pathname !== demoRenderApiBaseUrl && !pathname.startsWith(`${demoRenderApiBaseUrl}/`)) {
    return null;
  }

  return pathname.slice(demoRenderApiBaseUrl.length) || '/';
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let receivedBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    receivedBytes += buffer.byteLength;

    if (receivedBytes > maximumRequestBytes) {
      throw new RangeError('The local render request is too large.');
    }

    chunks.push(buffer);
  }

  const text = Buffer.concat(chunks).toString('utf8');
  if (!text.trim()) throw new TypeError('The local render request body is empty.');
  return JSON.parse(text) as unknown;
}

function writeJson(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(body));
}

function writeBinary(
  response: ServerResponse,
  status: number,
  body: Uint8Array,
  contentType: string,
  fileName: string,
): void {
  response.statusCode = status;
  response.setHeader('Content-Type', contentType);
  response.setHeader('Content-Length', body.byteLength);
  response.setHeader(
    'Content-Disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
  );
  response.setHeader('Cache-Control', 'no-store');
  response.end(body);
}
