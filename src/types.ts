export type CameraFacing = 'user' | 'environment';

export interface StreamQuality {
  id: string;
  label: string;
  width: number;
  height: number;
  frameRate: number;
}

export const QUALITY_PRESETS: StreamQuality[] = [
  { id: '1080p', label: '1080p FHD (High Quality)', width: 1920, height: 1080, frameRate: 30 },
  { id: '720p', label: '720p HD (Balanced)', width: 1280, height: 720, frameRate: 30 },
  { id: '480p', label: '480p SD (Fast & Smooth)', width: 854, height: 480, frameRate: 30 },
  { id: '360p', label: '360p (Low Bandwidth)', width: 640, height: 360, frameRate: 24 },
];

export interface StreamStats {
  viewersCount: number;
  fps: number;
  uptimeSeconds: number;
  latencyMs: number;
  facing: CameraFacing;
  resolution: string;
  isTorchOn: boolean;
  isLowLight: boolean;
  isMuted: boolean;
  isRecording: boolean;
}

export interface WsMessage {
  type: string;
  roomId?: string;
  clientId?: string;
  viewerId?: string;
  targetId?: string;
  fromId?: string;
  fromViewerId?: string;
  signalData?: any;
  frame?: string;
  timestamp?: number;
  facing?: CameraFacing;
  cameraFacing?: CameraFacing;
  isTorchOn?: boolean;
  isLowLight?: boolean;
  totalViewers?: number;
  viewersCount?: number;
  command?: string;
  value?: any;
  hasBroadcaster?: boolean;
}
