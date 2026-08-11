import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import { createLocalRenderApi } from './dev/LocalRenderApi';
import { createInMemoryArtworkStore } from './dev/render/InMemoryArtworkStore';
import { createLocalFileRenderService } from './dev/render/LocalFileRenderService';
import { renderMotionGifPreview } from './dev/render/MotionGifRenderer';
import { demoRenderApiBaseUrl } from './src/integration/DemoRenderApiConfig';

const maximumRequestBytes = 1_000_000;
const maximumArtworkBytes = 20_000_000;

export default defineConfig({
  plugins: [localRenderApiPlugin()],
});

function localRenderApiPlugin(): Plugin {
  const artworkStore = createInMemoryArtworkStore({ maximumBytes: maximumArtworkBytes });
  const renderService = createLocalFileRenderService({
    apiBaseUrl: demoRenderApiBaseUrl,
    async renderDeliverable(deliverable) {
      const artwork = await artworkStore.resolve(deliverable.artwork);
      return renderMotionGifPreview(deliverable, artwork);
    },
  });
  const api = createLocalRenderApi(renderService, renderService, artworkStore);

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
          const body = request.method === 'POST'
            ? await readJsonBody(request)
            : request.method === 'PUT'
              ? await readBinaryBody(request)
              : undefined;
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

function getApiPath(requestUrl: string | undefined): string | null {
  if (!requestUrl) return null;

  const pathname = new URL(requestUrl, 'http://localhost').pathname;
  if (pathname !== demoRenderApiBaseUrl && !pathname.startsWith(`${demoRenderApiBaseUrl}/`)) {
    return null;
  }

  return pathname.slice(demoRenderApiBaseUrl.length) || '/';
}

async function readBinaryBody(request: IncomingMessage): Promise<Uint8Array> {
  return readBody(request, maximumArtworkBytes, 'The artwork registration is too large.');
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const body = await readBody(request, maximumRequestBytes, 'The local render request is too large.');
  const text = Buffer.from(body).toString('utf8');
  if (!text.trim()) throw new TypeError('The local render request body is empty.');
  return JSON.parse(text) as unknown;
}

async function readBody(
  request: IncomingMessage,
  maximumBytes: number,
  tooLargeMessage: string,
): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  let receivedBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    receivedBytes += buffer.byteLength;

    if (receivedBytes > maximumBytes) {
      throw new RangeError(tooLargeMessage);
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
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
