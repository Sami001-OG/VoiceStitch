import { Mp3Encoder } from '@breezystack/lamejs';
import type { AudioClip } from '../types/audio';
import { encodeWavBytes, extractWaveformPeaks } from './audioConcat';

let sharedAudioCtx: AudioContext | null = null;

export function getSharedAudioContext(): AudioContext {
  if (!sharedAudioCtx) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedAudioCtx = new AudioCtx();
  }
  return sharedAudioCtx;
}

function getFormatLabel(file: File): string {
  const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
  if (extMatch) {
    return extMatch[1].toUpperCase();
  }
  if (file.type.includes('mpeg') || file.type.includes('mp3')) return 'MP3';
  if (file.type.includes('wav')) return 'WAV';
  if (file.type.includes('ogg')) return 'OGG';
  if (file.type.includes('mp4') || file.type.includes('m4a')) return 'M4A';
  return 'AUDIO';
}

function createClipId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `clip-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function decodeAudioFiles(
  files: File[],
): Promise<{ clips: AudioClip[]; errors: string[] }> {
  const ctx = getSharedAudioContext();
  const clips: AudioClip[] = [];
  const errors: string[] = [];

  for (const file of files) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      const channelData: Float32Array[] = [];
      for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
        channelData.push(new Float32Array(audioBuffer.getChannelData(ch)));
      }

      clips.push({
        id: createClipId(),
        name: file.name,
        duration: audioBuffer.duration,
        sizeBytes: file.size,
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels,
        formatLabel: getFormatLabel(file),
        peaks: extractWaveformPeaks(channelData, 56),
        channelData,
      });
    } catch {
      errors.push(`Could not decode "${file.name}". Ensure it is a valid audio file.`);
    }
  }

  return { clips, errors };
}

export function buildAudioBuffer(
  ctx: AudioContext,
  channels: readonly Float32Array[],
  sampleRate: number,
): AudioBuffer {
  const numChannels = Math.max(1, channels.length);
  const length = Math.max(1, channels[0]?.length ?? 1);
  const buffer = ctx.createBuffer(numChannels, length, sampleRate);
  for (let ch = 0; ch < numChannels; ch++) {
    const data = channels[ch] ?? channels[0];
    buffer.copyToChannel(new Float32Array(data), ch);
  }
  return buffer;
}

function floatToInt16Pcm(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
  }
  return out;
}

export async function encodeMp3Blob(
  channels: readonly Float32Array[],
  sampleRate: number,
  kbps = 192,
  onProgress?: (progress: number) => void,
): Promise<Blob> {
  const numChannels = channels.length >= 2 ? 2 : 1;
  const encoder = new Mp3Encoder(numChannels, sampleRate, kbps);

  const leftPcm = floatToInt16Pcm(channels[0] ?? new Float32Array(0));
  const rightPcm = numChannels === 2 ? floatToInt16Pcm(channels[1]) : undefined;

  const mp3Parts: Uint8Array[] = [];
  const blockSize = 1152 * 24;
  const total = leftPcm.length;

  for (let i = 0; i < total; i += blockSize) {
    const end = Math.min(total, i + blockSize);
    const leftChunk = leftPcm.subarray(i, end);
    const rightChunk = rightPcm ? rightPcm.subarray(i, end) : undefined;
    const encoded = encoder.encodeBuffer(leftChunk, rightChunk);
    if (encoded.length > 0) {
      mp3Parts.push(new Uint8Array(encoded));
    }
    if (onProgress && total > 0) {
      onProgress(Math.min(0.95, end / total));
    }
    // Yield periodically so the UI stays responsive on long voice files
    if (i + blockSize < total) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  const flushed = encoder.flush();
  if (flushed.length > 0) {
    mp3Parts.push(new Uint8Array(flushed));
  }
  onProgress?.(1);

  return new Blob(mp3Parts as BlobPart[], { type: 'audio/mpeg' });
}

export function encodeWavBlob(
  channels: readonly Float32Array[],
  sampleRate: number,
): Blob {
  const bytes = encodeWavBytes(channels, sampleRate);
  return new Blob([bytes as BlobPart], { type: 'audio/wav' });
}

function synthesizeCadencePhrase(
  sampleRate: number,
  syllableFreqs: number[],
  syllableDuration: number,
): Float32Array {
  const gapSamples = Math.round(sampleRate * 0.06);
  const sylSamples = Math.round(sampleRate * syllableDuration);
  const totalSamples = syllableFreqs.length * (sylSamples + gapSamples);
  const out = new Float32Array(totalSamples);

  let cursor = 0;
  for (let s = 0; s < syllableFreqs.length; s++) {
    const f0 = syllableFreqs[s];
    for (let i = 0; i < sylSamples; i++) {
      const t = i / sampleRate;
      const progress = i / sylSamples;
      // Smooth speech-like attack/release envelope
      const attack = Math.min(1, progress / 0.14);
      const release = Math.min(1, (1 - progress) / 0.22);
      const env = attack * release;

      // Fundamental + voice-like formant harmonics
      const wave =
        0.52 * Math.sin(2 * Math.PI * f0 * t) +
        0.28 * Math.sin(2 * Math.PI * (f0 * 2.0) * t) +
        0.14 * Math.sin(2 * Math.PI * (f0 * 3.0) * t) +
        0.06 * Math.sin(2 * Math.PI * (f0 * 4.5) * t);

      out[cursor + i] = wave * env * 0.65;
    }
    cursor += sylSamples + gapSamples;
  }

  return out;
}

export function createSampleVoiceFiles(): File[] {
  const sampleRate = 44100;
  const specs = [
    {
      name: '01-intro-greeting.wav',
      freqs: [185, 208, 220, 196, 233],
      syllableDuration: 0.28,
    },
    {
      name: '02-key-takeaway.wav',
      freqs: [175, 196, 220, 247, 220, 196, 185],
      syllableDuration: 0.26,
    },
    {
      name: '03-closing-signoff.wav',
      freqs: [208, 196, 175, 165],
      syllableDuration: 0.32,
    },
  ];

  return specs.map((spec) => {
    const mono = synthesizeCadencePhrase(
      sampleRate,
      spec.freqs,
      spec.syllableDuration,
    );
    const wavBytes = encodeWavBytes([mono], sampleRate);
    return new File([wavBytes as BlobPart], spec.name, { type: 'audio/wav' });
  });
}
