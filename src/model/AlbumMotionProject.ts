import type { ArtworkReference } from './ArtworkReference';

export type MotionStyleId = 'drift';

export type LoopBehavior = 'loop';

export interface AlbumMotionProject {
  schemaVersion: 1;
  artwork: ArtworkReference;
  destination: 'spotify-v1';
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
  destination: 'spotify-v1',
  motionStyle: 'drift',
  speed: 1,
  intensity: 1,
  loopBehavior: 'loop',
};
