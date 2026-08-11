import { Application, DisplacementFilter, Sprite, Texture } from 'pixi.js';
import type { MotionStyleId } from '../model/AlbumMotionProject';
import { decodeArtwork, type ArtworkSource, type DecodedArtwork } from './ArtworkSource';
import {
  defaultDriftSettings,
  getDriftFrame,
  type DriftSettings,
} from './DriftAnimation';
import { getWaterDisplacementSample, getWaterFrame } from './WaterAnimation';

export class PreviewEngine {
  private readonly app = new Application();
  private artwork?: Sprite;
  private decodedArtwork?: DecodedArtwork;
  private artworkLoad?: AbortController;
  private displacementSprite?: Sprite;
  private displacementFilter?: DisplacementFilter;
  private playbackTimeSeconds = 0;
  private baseScale = 1;
  private motionStyle: MotionStyleId = 'drift';
  private driftSettings = defaultDriftSettings;
  private started = false;
  private destroyed = false;

  constructor(private readonly host: HTMLElement) {}

  async start(source: ArtworkSource): Promise<void> {
    if (this.started || this.destroyed) {
      throw new Error('PreviewEngine can only be started once.');
    }

    await this.app.init({
      antialias: true,
      background: '#0b0a12',
      resizeTo: this.host,
      resolution: Math.min(window.devicePixelRatio, 2),
      autoDensity: true,
    });

    // React Strict Mode may clean up an effect while Pixi is still initializing.
    if (this.destroyed) {
      this.app.destroy({ removeView: true }, { children: true });
      return;
    }

    this.host.appendChild(this.app.canvas);
    this.started = true;
    this.createWaterEffect();
    this.app.renderer.on('resize', this.fitArtwork);
    this.app.ticker.add(this.animate);

    await this.setArtwork(source);
  }

  async setArtwork(source: ArtworkSource): Promise<void> {
    if (!this.started || this.destroyed) {
      throw new Error('PreviewEngine must be running before artwork can be changed.');
    }

    this.artworkLoad?.abort();
    const controller = new AbortController();
    this.artworkLoad = controller;

    let decoded: DecodedArtwork;

    try {
      decoded = await decodeArtwork(source, controller.signal);
    } catch (error) {
      if (controller.signal.aborted) return;
      throw error;
    }

    if (controller.signal.aborted || this.artworkLoad !== controller) {
      decoded.dispose();
      return;
    }

    const texture = Texture.from(decoded.resource, true);
    const nextArtwork = new Sprite(texture);
    nextArtwork.anchor.set(0.5);

    this.disposeCurrentArtwork();
    this.decodedArtwork = decoded;
    this.artwork = nextArtwork;
    this.app.stage.addChild(nextArtwork);
    this.applyMotionStyle();
    this.fitArtwork();
    this.renderAt(this.playbackTimeSeconds);
  }

  setMotionSettings(motionStyle: MotionStyleId, settings: DriftSettings): void {
    this.motionStyle = motionStyle;
    this.driftSettings = { ...settings };
    this.applyMotionStyle();
    this.renderAt(this.playbackTimeSeconds);
  }

  destroy(): void {
    if (this.destroyed) return;

    this.destroyed = true;
    this.artworkLoad?.abort();

    if (this.started) {
      this.app.renderer.off('resize', this.fitArtwork);
      this.app.ticker.remove(this.animate);
      this.disposeCurrentArtwork();
      this.disposeWaterEffect();
      this.app.destroy({ removeView: true }, { children: true });
    }
  }

  renderAt(timeSeconds: number): void {
    if (!this.artwork) return;

    if (this.motionStyle === 'water') {
      const frame = getWaterFrame(timeSeconds, this.driftSettings);

      this.artwork.scale.set(this.baseScale * frame.zoom);
      this.artwork.position.set(this.app.screen.width / 2, this.app.screen.height / 2);
      this.displacementFilter?.scale.set(frame.displacementX, frame.displacementY);
      this.displacementSprite?.position.set(-frame.mapOffsetX, -frame.mapOffsetY);
      return;
    }

    const frame = getDriftFrame(timeSeconds, this.driftSettings);

    this.artwork.scale.set(this.baseScale * frame.zoom);
    this.artwork.position.set(
      this.app.screen.width / 2 + frame.offsetXRatio * this.app.screen.width,
      this.app.screen.height / 2 + frame.offsetYRatio * this.app.screen.height,
    );
  }

  private readonly fitArtwork = (): void => {
    if (!this.artwork) return;

    const { width, height } = this.app.screen;
    const texture = this.artwork.texture;

    // A little overscan keeps the moving image beyond every canvas edge.
    this.baseScale = Math.max(width / texture.width, height / texture.height) * 1.08;
    this.renderAt(this.playbackTimeSeconds);
  };

  private readonly animate = (): void => {
    this.playbackTimeSeconds += this.app.ticker.deltaMS / 1000;
    this.renderAt(this.playbackTimeSeconds);
  };

  private createWaterEffect(): void {
    const texture = Texture.from(createWaterDisplacementMap());
    texture.source.addressMode = 'repeat';

    const displacementSprite = new Sprite(texture);
    displacementSprite.scale.set(1.1);
    this.app.stage.addChild(displacementSprite);

    this.displacementSprite = displacementSprite;
    this.displacementFilter = new DisplacementFilter({
      sprite: displacementSprite,
      scale: 0,
      padding: 32,
    });
  }

  private applyMotionStyle(): void {
    if (!this.artwork) return;

    this.artwork.filters = this.motionStyle === 'water' && this.displacementFilter
      ? [this.displacementFilter]
      : null;
  }

  private disposeCurrentArtwork(): void {
    if (this.artwork) {
      this.artwork.filters = null;
      this.app.stage.removeChild(this.artwork);
      this.artwork.destroy({ texture: true, textureSource: true });
      this.artwork = undefined;
    }

    this.decodedArtwork?.dispose();
    this.decodedArtwork = undefined;
  }

  private disposeWaterEffect(): void {
    this.displacementFilter?.destroy();
    this.displacementFilter = undefined;

    if (this.displacementSprite) {
      this.app.stage.removeChild(this.displacementSprite);
      this.displacementSprite.destroy({ texture: true, textureSource: true });
      this.displacementSprite = undefined;
    }
  }
}

function createWaterDisplacementMap(): HTMLCanvasElement {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('The browser could not create the water effect.');

  const imageData = context.createImageData(size, size);
  const pixels = imageData.data;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const normalizedX = x / size;
      const normalizedY = y / size;
      const sample = getWaterDisplacementSample(normalizedX, normalizedY);

      pixels[index] = 128 + sample.horizontal * 40;
      pixels[index + 1] = 128 + sample.vertical * 40;
      pixels[index + 2] = 128;
      pixels[index + 3] = 255;
    }
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
}
