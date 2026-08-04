export {
  AlbumMotionEditor,
  defaultMotionStyleOptions,
  type AlbumMotionEditorProps,
  type AlbumMotionEditorResult,
  type MotionStyleOption,
} from './AlbumMotionEditor';
export type { EditorWindowActions } from './EditorWindowControls';
export {
  transitionEditorWindow,
  type EditorWindowAction,
  type EditorWindowState,
} from './EditorWindowState';
export type { AlbumMotionProject, MotionStyleId } from '../model/AlbumMotionProject';
export {
  defaultReleaseDestinationProfileIds,
  type DestinationProfile,
  type ReleaseDestinationProfileIds,
} from '../model/DestinationProfile';
export type { HostBranding } from '../model/HostBranding';
export type { PurchaseItem, ReleaseOrder } from '../model/ReleaseOrder';
export type { DeliverableTarget, ReleaseMotionDraft } from '../model/ReleaseMotionDraft';
export type { ArtworkSource } from '../preview/ArtworkSource';
export {
  createHostEditorSession,
  type HostAlbumConfig,
  type HostArtworkConfig,
  type HostEditorSession,
  type HostLaunchConfig,
  type HostLaunchConfigV1,
  type HostLaunchConfigV2,
  type HostTrackConfig,
} from '../integration/HostLaunchConfig';
export {
  parseReleaseDraft,
  serializeReleaseDraft,
  type SavedReleaseDraft,
} from '../persistence/ReleaseDraftCodec';
