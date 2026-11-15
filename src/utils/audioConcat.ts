export type ExportFormat = 'mp3' | 'wav';

export interface TimelineSegment {
  id: string;
  name: string;
  index: number;
  start: number;
  end: number;
  duration: number;
}

export interface TimelineSummary {
  totalDuration: number;
  segments: TimelineSegment[];
}

export interface RawAudioClipInput {
  channelData: Float32Array[];
  sampleRate: number;
}

export interface ConcatenateOptions {
  targetSampleRate: number;
  targetChannels: number;
  gapSeconds: number;
  normalize: boolean;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '00:00.00';
  }
  const totalCentiseconds = Math.round(seconds * 100);
  const centiseconds = totalCentiseconds % 100;
  const totalSeconds = Math.floor(totalCentiseconds / 100);
  const secs = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const mins = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  const csStr = String(centiseconds).padStart(2, '0');
  const secStr = String(secs).padStart(2, '0');
  const minStr = String(mins).padStart(2, '0');

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${minStr}:${secStr}.${csStr}`;
  }
  return `${minStr}:${secStr}.${csStr}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 100 ? 0 : 2)} MB`;
}

export function computeClipTimeline(
  clips: ReadonlyArray<{ id: string; name: string; duration: number }>,
  gapSeconds: number,
): TimelineSummary {
  const safeGap = Math.max(0, Number.isFinite(gapSeconds) ? gapSeconds : 0);
  const segments: TimelineSegment[] = [];
  let cursor = 0;

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const dur = Math.max(0, Number.isFinite(clip.duration) ? clip.duration : 0);
    const start = cursor;
    const end = start + dur;
    segments.push({
      id: clip.id,
      name: clip.name,
      index: i,
      start,
      end,
      duration: dur,
    });
    cursor = end + (i < clips.length - 1 ? safeGap : 0);
  }

  return {
    totalDuration: cursor,
    segments,
  };
}

export function reorderClips<T>(
  items: readonly T[],
  fromIndex: number,
  toIndex: number,
): T[] {
  if (
    fromIndex < 0 ||
    fromIndex >= items.length ||
    toIndex < 0 ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return [...items];
  }
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function extractWaveformPeaks(
  channelData: readonly Float32Array[],
  bucketCount: number,
): number[] {
  const count = Math.max(1, Math.floor(bucketCount));
  if (channelData.length === 0 || channelData[0].length === 0) {
    return new Array<number>(count).fill(0.05);
  }

  const totalSamples = channelData[0].length;
  const peaks = new Array<number>(count).fill(0);
  const blockSize = totalSamples / count;

  let globalMax = 0;
  for (let b = 0; b < count; b++) {
    const start = Math.floor(b * blockSize);
    const end = Math.min(totalSamples, Math.max(start + 1, Math.floor((b + 1) * blockSize)));
    let maxAmp = 0;
    const step = Math.max(1, Math.floor((end - start) / 64));

    for (let s = start; s < end; s += step) {
      let mixed = 0;
      for (let ch = 0; ch < channelData.length; ch++) {
        mixed += Math.abs(channelData[ch][s] ?? 0);
      }
      mixed /= channelData.length;
      if (mixed > maxAmp) {
        maxAmp = mixed;
      }
    }
    peaks[b] = maxAmp;
    if (maxAmp > globalMax) {
      globalMax = maxAmp;
    }
  }

  if (globalMax <= 1e-6) {
    return new Array<number>(count).fill(0.05);
  }

  return peaks.map((p) => Math.max(0.04, Math.min(1, p / globalMax)));
}

function resampleLinear(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate || input.length === 0) {
    return input;
  }
  const ratio = fromRate / toRate;
  const outputLength = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const srcPos = i * ratio;
    const leftIdx = Math.floor(srcPos);
    const rightIdx = Math.min(input.length - 1, leftIdx + 1);
    const frac = srcPos - leftIdx;
    output[i] = input[leftIdx] * (1 - frac) + input[rightIdx] * frac;
  }

  return output;
}

function adaptChannelCount(
  channels: Float32Array[],
  targetChannels: number,
): Float32Array[] {
  if (channels.length === 0) {
    return Array.from({ length: targetChannels }, () => new Float32Array(0));
  }
  if (channels.length === targetChannels) {
    return channels;
  }
  if (channels.length === 1 && targetChannels === 2) {
    return [channels[0], new Float32Array(channels[0])];
  }
  if (targetChannels === 1) {
    const length = channels[0].length;
    const mono = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      let sum = 0;
      for (let ch = 0; ch < channels.length; ch++) {
        sum += channels[ch][i] ?? 0;
      }
      mono[i] = sum / channels.length;
    }
    return [mono];
  }
  return Array.from({ length: targetChannels }, (_, ch) => {
    return channels[ch % channels.length];
  });
}

function getPeakAmplitude(channels: readonly Float32Array[]): number {
  let peak = 0;
  for (let ch = 0; ch < channels.length; ch++) {
    const data = channels[ch];
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > peak) peak = abs;
    }
  }
  return peak;
}

export function concatenateChannelData(
  clips: readonly RawAudioClipInput[],
  options: ConcatenateOptions,
): Float32Array[] {
  const targetChannels = Math.max(1, Math.min(2, Math.round(options.targetChannels)));
  const targetSampleRate = Math.max(8000, Math.round(options.targetSampleRate));
  const gapSamples = Math.max(0, Math.round(options.gapSeconds * targetSampleRate));

  if (clips.length === 0) {
    return Array.from({ length: targetChannels }, () => new Float32Array(0));
  }

  const preparedClips: Float32Array[][] = clips.map((clip) => {
    const adapted = adaptChannelCount(clip.channelData, targetChannels);
    const resampled = adapted.map((ch) =>
      resampleLinear(ch, clip.sampleRate, targetSampleRate),
    );

    if (options.normalize) {
      const peak = getPeakAmplitude(resampled);
      if (peak > 1e-4) {
        const gain = 0.94 / peak;
        return resampled.map((ch) => {
          const scaled = new Float32Array(ch.length);
          for (let i = 0; i < ch.length; i++) {
            scaled[i] = Math.max(-1, Math.min(1, ch[i] * gain));
          }
          return scaled;
        });
      }
    }
    return resampled;
  });

  let totalSamples = 0;
  for (let i = 0; i < preparedClips.length; i++) {
    totalSamples += preparedClips[i][0]?.length ?? 0;
    if (i < preparedClips.length - 1) {
      totalSamples += gapSamples;
    }
  }

  const output = Array.from({ length: targetChannels }, () => new Float32Array(totalSamples));

  let offset = 0;
  for (let i = 0; i < preparedClips.length; i++) {
    const clipChannels = preparedClips[i];
    const clipLength = clipChannels[0]?.length ?? 0;
    for (let ch = 0; ch < targetChannels; ch++) {
      output[ch].set(clipChannels[ch], offset);
    }
    offset += clipLength;
    if (i < preparedClips.length - 1) {
      offset += gapSamples;
    }
  }

  return output;
}

export function encodeWavBytes(
  channels: readonly Float32Array[],
  sampleRate: number,
): Uint8Array {
  const numChannels = Math.max(1, channels.length);
  const numSamples = channels[0]?.length ?? 0;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataByteLength = numSamples * blockAlign;
  const totalByteLength = 44 + dataByteLength;

  const buffer = new ArrayBuffer(totalByteLength);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataByteLength, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataByteLength, true);

  let writeOffset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i] ?? 0));
      const intSample = sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767);
      view.setInt16(writeOffset, intSample, true);
      writeOffset += 2;
    }
  }

  return new Uint8Array(buffer);
}

export function sanitizeOutputFilename(rawName: string, extension: ExportFormat): string {
  const cleaned = rawName
    .trim()
    .replace(/\.(mp3|wav|m4a|ogg|aac|flac)$/i, '')
    .replace(/[^a-zA-Z0-9._ -]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const base = cleaned.length > 0 ? cleaned : 'stitched-voice';
  return `${base}.${extension}`;
}
