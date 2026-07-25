import { Application, Sprite, Texture } from 'pixi.js';
import { decodeArtwork, type ArtworkSource, type DecodedArtwork } from './ArtworkSource';
import {
  defaultDriftSettings,
  getDriftFrame,
  type DriftSettings,
} from './DriftAnimation';

export class PreviewEngine {
  private readonly app = new Application();
  private artwork?: Sprite;
  private decodedArtwork?: DecodedArtwork;
  private artworkLoad?: AbortController;
  private playbackTimeSeconds = 0;
  private baseScale = 1;
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

    this.host.appendChild(this.app.canvas);
    this.started = true;
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
    this.fitArtwork();
    this.renderAt(this.playbackTimeSeconds);
  }

  setDriftSettings(settings: DriftSettings): void {
    this.driftSettings = { ...settings };
    this.renderAt(this.playbackTimeSeconds);
  }

  destroy(): void {
    if (this.destroyed) return;

    this.destroyed = true;
    this.artworkLoad?.abort();
    this.app.renderer.off('resize', this.fitArtwork);
    this.app.ticker.remove(this.animate);
    this.disposeCurrentArtwork();
    this.app.destroy({ removeView: true }, { children: true });
  }

  renderAt(timeSeconds: number): void {
    if (!this.artwork) return;

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

  private disposeCurrentArtwork(): void {
    if (this.artwork) {
      this.app.stage.removeChild(this.artwork);
      this.artwork.destroy({ texture: true, textureSource: true });
      this.artwork = undefined;
    }

    this.decodedArtwork?.dispose();
    this.decodedArtwork = undefined;
  }
}
