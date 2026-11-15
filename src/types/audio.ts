import type { ExportFormat } from '../utils/audioConcat';

export interface AudioClip {
  id: string;
  name: string;
  duration: number;
  sizeBytes: number;
  sampleRate: number;
  channels: number;
  formatLabel: string;
  peaks: number[];
  channelData: Float32Array[];
}

export interface ExportStatus {
  state: 'idle' | 'encoding' | 'done' | 'error';
  progress: number;
  lastFilename?: string;
  lastSizeBytes?: number;
  downloadUrl?: string;
  error?: string;
}

export interface StitchSettings {
  gapSeconds: number;
  format: ExportFormat;
  normalize: boolean;
  outputName: string;
}
