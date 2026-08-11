import {
  createHttpArtworkRegistrationService,
  createFakeRenderService,
  createHttpRenderService,
  createNoopArtworkRegistrationService,
  type ArtworkRegistrationService,
  type RenderService,
} from '../render';
import { demoRenderApiBaseUrl } from './DemoRenderApiConfig';

export type DemoRenderServiceMode = 'fake' | 'http';

export interface DemoRenderServiceSelection {
  mode: DemoRenderServiceMode;
  label: string;
  service: RenderService;
  artworkRegistrationService: ArtworkRegistrationService;
}

export function createDemoRenderService(
  configuredMode: string | undefined,
  isDevelopment: boolean,
): DemoRenderServiceSelection {
  const mode = resolveDemoRenderServiceMode(configuredMode, isDevelopment);

  return mode === 'http'
    ? {
        mode,
        label: 'Local HTTP API',
        service: createHttpRenderService({ baseUrl: demoRenderApiBaseUrl }),
        artworkRegistrationService: createHttpArtworkRegistrationService({
          baseUrl: demoRenderApiBaseUrl,
        }),
      }
    : {
        mode,
        label: 'In-memory demo',
        service: createFakeRenderService(),
        artworkRegistrationService: createNoopArtworkRegistrationService(),
      };
}

export function resolveDemoRenderServiceMode(
  configuredMode: string | undefined,
  isDevelopment: boolean,
): DemoRenderServiceMode {
  if (configuredMode === undefined || configuredMode === '') {
    return isDevelopment ? 'http' : 'fake';
  }

  if (configuredMode === 'fake' || configuredMode === 'http') return configuredMode;

  throw new RangeError(`Unsupported demo render service mode: ${configuredMode}`);
}
