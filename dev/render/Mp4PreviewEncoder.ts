import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import { createRenderOutputFileName } from '../../src/render/RenderJob';
import type { RenderDeliverable } from '../../src/render/RenderRequest';
import {
  createPreviewRenderPlan,
  generatePreviewFrames,
  type PreviewFrameRenderer,
  type PreviewRenderOptions,
} from './PreviewFrameRenderer';
import type { RenderedArtifact } from './RenderArtifact';

export type Mp4PreviewOptions = PreviewRenderOptions;

export async function encodeMp4Preview(
  deliverable: RenderDeliverable,
  artwork: Uint8Array,
  renderFrame: PreviewFrameRenderer,
  options: Mp4PreviewOptions = {},
): Promise<RenderedArtifact> {
  if (deliverable.output.format.toLowerCase() !== 'mp4') {
    throw new RangeError('The MP4 preview encoder requires MP4 output.');
  }
  if (artwork.byteLength === 0) {
    throw new RangeError('The preview renderer requires artwork bytes.');
  }
  if (!ffmpegPath) {
    throw new Error('The local FFmpeg binary is unavailable for MP4 previews.');
  }

  const plan = createPreviewRenderPlan(deliverable, options, 2);
  const frameBuffers: Buffer[] = [];
  for await (const pixels of generatePreviewFrames(deliverable, artwork, renderFrame, plan)) {
    frameBuffers.push(Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength));
  }

  const bytes = await runFfmpeg(ffmpegPath, [
    '-hide_banner',
    '-loglevel', 'error',
    '-f', 'rawvideo',
    '-pixel_format', 'rgba',
    '-video_size', `${plan.width}x${plan.height}`,
    '-framerate', String(plan.framesPerSecond),
    '-i', 'pipe:0',
    '-an',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
    '-f', 'mp4',
    'pipe:1',
  ], Buffer.concat(frameBuffers));

  return {
    deliverableId: deliverable.id,
    fileName: createRenderOutputFileName(deliverable.title, 'mp4', 'preview'),
    contentType: 'video/mp4',
    width: plan.width,
    height: plan.height,
    frameCount: plan.frameCount,
    bytes,
  };
}

function runFfmpeg(
  executablePath: string,
  arguments_: string[],
  input: Uint8Array,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const process = spawn(executablePath, arguments_, { stdio: ['pipe', 'pipe', 'pipe'] });
    const output: Buffer[] = [];
    const errors: Buffer[] = [];

    process.stdout.on('data', (chunk: Buffer) => output.push(chunk));
    process.stderr.on('data', (chunk: Buffer) => errors.push(chunk));
    process.on('error', (error) => reject(new Error('FFmpeg could not be started.', {
      cause: error,
    })));
    process.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(output));
        return;
      }

      const detail = Buffer.concat(errors).toString('utf8').trim();
      reject(new Error(detail || `FFmpeg exited with status ${code ?? 'unknown'}.`));
    });
    process.stdin.on('error', () => {
      // A failed encoder may close stdin before its exit status and stderr arrive.
    });
    process.stdin.end(input);
  });
}
