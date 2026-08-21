import type { ArtworkReference } from './ArtworkReference';
import type { DestinationProfileId } from './DestinationProfile';

export type MotionStyleId = 'drift' | 'water';

export type LoopBehavior = 'loop';

export interface AlbumMotionProject {
  schemaVersion: 1;
  artwork: ArtworkReference;
  destination: DestinationProfileId;
  motionStyle: MotionStyleId;
  speed: number;
  intensity: number;
  loopBehavior: LoopBehavior;
}

export const sampleProject: AlbumMotionProject = {
  schemaVersion: 1,
  artwork: {
    provider: 'demo',
    assetKey: 'sample-cover',
  },
  destination: 'spotify-canvas-v1',
  motionStyle: 'drift',
  speed: 1,
  intensity: 1,
  loopBehavior: 'loop',
};
