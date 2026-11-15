import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { ClipQueue } from './components/ClipQueue';
import { ExportPanel } from './components/ExportPanel';
import { MasterTimeline } from './components/MasterTimeline';
import { TopBar } from './components/TopBar';
import type { AudioClip, ExportStatus, StitchSettings } from './types/audio';
import {
  computeClipTimeline,
  concatenateChannelData,
  formatDuration,
  reorderClips,
  sanitizeOutputFilename,
} from './utils/audioConcat';
import {
  buildAudioBuffer,
  createSampleVoiceFiles,
  decodeAudioFiles,
  encodeMp3Blob,
  encodeWavBlob,
  getSharedAudioContext,
} from './utils/audioEngine';

export default function App() {
  const [clips, setClips] = useState<AudioClip[]>([]);
  const [isDecoding, setIsDecoding] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const [settings, setSettings] = useState<StitchSettings>({
    gapSeconds: 0,
    format: 'mp3',
    normalize: false,
    outputName: 'stitched-voice',
  });

  const [isPlayingMaster, setIsPlayingMaster] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [auditionClipId, setAuditionClipId] = useState<string | null>(null);

  const [exportStatus, setExportStatus] = useState<ExportStatus>({
    state: 'idle',
    progress: 0,
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const playStartCtxTimeRef = useRef<number>(0);
  const playStartOffsetRef = useRef<number>(0);
  const lastDownloadUrlRef = useRef<string | null>(null);

  const timeline = useMemo(
    () => computeClipTimeline(clips, settings.gapSeconds),
    [clips, settings.gapSeconds],
  );

  const targetSampleRate = useMemo(() => {
    if (clips.length === 0) return 44100;
    return Math.max(...clips.map((c) => c.sampleRate));
  }, [clips]);

  const targetChannels = useMemo(() => {
    if (clips.length === 0) return 1;
    return clips.some((c) => c.channels >= 2) ? 2 : 1;
  }, [clips]);

  const stopAllAudio = useCallback((resetCursor = false) => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.onended = null;
        activeSourceRef.current.stop();
        activeSourceRef.current.disconnect();
      } catch {
        // Source already stopped
      }
      activeSourceRef.current = null;
    }
    setIsPlayingMaster(false);
    setAuditionClipId(null);
    if (resetCursor) {
      setCurrentTime(0);
    }
  }, []);

  useEffect(() => {
    return () => {
      stopAllAudio(false);
      if (lastDownloadUrlRef.current) {
        URL.revokeObjectURL(lastDownloadUrlRef.current);
      }
    };
  }, [stopAllAudio]);

  // Clamp cursor if clips or gaps shrink totalDuration
  useEffect(() => {
    if (currentTime > timeline.totalDuration) {
      setCurrentTime(timeline.totalDuration);
    }
    if (clips.length === 0) {
      stopAllAudio(true);
    }
  }, [clips.length, currentTime, stopAllAudio, timeline.totalDuration]);

  const handleFilesSelected = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setIsDecoding(true);
    setErrors([]);

    const result = await decodeAudioFiles(files);
    if (result.clips.length > 0) {
      setClips((prev) => [...prev, ...result.clips]);
      setExportStatus((prev) =>
        prev.state === 'done' ? { state: 'idle', progress: 0 } : prev,
      );
    }
    if (result.errors.length > 0) {
      setErrors(result.errors);
    }
    setIsDecoding(false);
  }, []);

  const handleLoadSampleClips = useCallback(async () => {
    const sampleFiles = createSampleVoiceFiles();
    await handleFilesSelected(sampleFiles);
  }, [handleFilesSelected]);

  const handleTriggerUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleMoveClip = useCallback(
    (fromIndex: number, toIndex: number) => {
      stopAllAudio(true);
      setClips((prev) => reorderClips(prev, fromIndex, toIndex));
    },
    [stopAllAudio],
  );

  const handleRemoveClip = useCallback(
    (id: string) => {
      stopAllAudio(true);
      setClips((prev) => prev.filter((c) => c.id !== id));
    },
    [stopAllAudio],
  );

  const handleClearAll = useCallback(() => {
    stopAllAudio(true);
    setClips([]);
    setErrors([]);
    setExportStatus({ state: 'idle', progress: 0 });
  }, [stopAllAudio]);

  const startMasterPlayback = useCallback(
    async (startOffsetSeconds: number) => {
      if (clips.length === 0 || timeline.totalDuration <= 0) return;
      stopAllAudio(false);

      const ctx = getSharedAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const mergedChannels = concatenateChannelData(clips, {
        targetSampleRate,
        targetChannels,
        gapSeconds: settings.gapSeconds,
        normalize: settings.normalize,
      });

      const buffer = buildAudioBuffer(ctx, mergedChannels, targetSampleRate);
      const safeStart = Math.max(0, Math.min(startOffsetSeconds, buffer.duration - 0.01));

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      playStartCtxTimeRef.current = ctx.currentTime;
      playStartOffsetRef.current = safeStart;
      activeSourceRef.current = source;
      setIsPlayingMaster(true);

      source.onended = () => {
        if (activeSourceRef.current === source) {
          activeSourceRef.current = null;
          if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
          setIsPlayingMaster(false);
          setCurrentTime(0);
        }
      };

      const tick = () => {
        if (!activeSourceRef.current) return;
        const elapsed = ctx.currentTime - playStartCtxTimeRef.current;
        const nextTime = Math.min(
          timeline.totalDuration,
          playStartOffsetRef.current + elapsed,
        );
        setCurrentTime(nextTime);
        if (nextTime < timeline.totalDuration) {
          rafRef.current = requestAnimationFrame(tick);
        }
      };

      source.start(0, safeStart);
      rafRef.current = requestAnimationFrame(tick);
    },
    [
      clips,
      settings.gapSeconds,
      settings.normalize,
      stopAllAudio,
      targetChannels,
      targetSampleRate,
      timeline.totalDuration,
    ],
  );

  const handleToggleMasterPlay = useCallback(() => {
    if (isPlayingMaster) {
      stopAllAudio(false);
    } else {
      const startAt = currentTime >= timeline.totalDuration - 0.05 ? 0 : currentTime;
      void startMasterPlayback(startAt);
    }
  }, [currentTime, isPlayingMaster, startMasterPlayback, stopAllAudio, timeline.totalDuration]);

  const handleSeek = useCallback(
    (seconds: number) => {
      const clamped = Math.max(0, Math.min(timeline.totalDuration, seconds));
      setCurrentTime(clamped);
      if (isPlayingMaster) {
        void startMasterPlayback(clamped);
      }
    },
    [isPlayingMaster, startMasterPlayback, timeline.totalDuration],
  );

  const handleToggleAuditionClip = useCallback(
    async (clipId: string) => {
      if (auditionClipId === clipId) {
        stopAllAudio(false);
        return;
      }
      const clip = clips.find((c) => c.id === clipId);
      if (!clip) return;

      stopAllAudio(false);
      const ctx = getSharedAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const buffer = buildAudioBuffer(ctx, clip.channelData, clip.sampleRate);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      activeSourceRef.current = source;
      setAuditionClipId(clipId);

      source.onended = () => {
        if (activeSourceRef.current === source) {
          activeSourceRef.current = null;
          setAuditionClipId(null);
        }
      };

      source.start(0);
    },
    [auditionClipId, clips, stopAllAudio],
  );

  const handleExport = useCallback(async () => {
    if (clips.length === 0) return;

    try {
      setExportStatus({ state: 'encoding', progress: 0.05 });

      const mergedChannels = concatenateChannelData(clips, {
        targetSampleRate,
        targetChannels,
        gapSeconds: settings.gapSeconds,
        normalize: settings.normalize,
      });

      const blob =
        settings.format === 'mp3'
          ? await encodeMp3Blob(mergedChannels, targetSampleRate, 192, (p) => {
              setExportStatus({ state: 'encoding', progress: p });
            })
          : encodeWavBlob(mergedChannels, targetSampleRate);

      if (lastDownloadUrlRef.current) {
        URL.revokeObjectURL(lastDownloadUrlRef.current);
      }

      const url = URL.createObjectURL(blob);
      lastDownloadUrlRef.current = url;
      const filename = sanitizeOutputFilename(settings.outputName, settings.format);

      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      setExportStatus({
        state: 'done',
        progress: 1,
        lastFilename: filename,
        lastSizeBytes: blob.size,
        downloadUrl: url,
      });
    } catch (err) {
      setExportStatus({
        state: 'error',
        progress: 0,
        error:
          err instanceof Error
            ? err.message
            : 'Audio encoding failed. Try exporting as WAV.',
      });
    }
  }, [
    clips,
    settings.format,
    settings.gapSeconds,
    settings.normalize,
    settings.outputName,
    targetChannels,
    targetSampleRate,
  ]);

  return (
    <div id="top" className="min-h-screen bg-[#F6F5F1] text-[#141413]">
      <TopBar onTriggerUpload={handleTriggerUpload} />

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.aac,.webm"
        aria-label="Upload audio files"
        className="hidden"
        onChange={(e) => {
          const fileList = e.target.files;
          if (fileList && fileList.length > 0) {
            void handleFilesSelected(Array.from(fileList));
          }
          e.target.value = '';
        }}
      />

      <main className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 sm:py-10">
        {/* Clean Editorial Workbench Heading & Inline Summary */}
        <section className="mb-7 flex flex-col gap-4 border-b border-[#E2DFD7] pb-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <h1 className="font-display text-3xl font-bold tracking-tight text-[#141413] sm:text-4xl [text-wrap:balance]">
              Stitch voice clips in sequence.
            </h1>
            <p className="mt-2 text-base text-[#575651]">
              Upload MP3 or voice recordings, arrange their playback order, and merge them into a single file directly in your browser. Zero database, zero server uploads.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#575651] tabular-nums shrink-0">
            <span>
              <strong data-testid="summary-clip-count" className="font-mono font-semibold text-[#141413]">
                {clips.length}
              </strong>{' '}
              {clips.length === 1 ? 'clip' : 'clips'}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Total{' '}
              <strong data-testid="summary-total-duration" className="font-mono font-semibold text-[#141413]">
                {formatDuration(timeline.totalDuration)}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>Local only</span>
          </div>
        </section>

        {/* Decode Error Alert */}
        {errors.length > 0 && (
          <div
            role="alert"
            className="mb-6 flex items-start justify-between gap-3 rounded-xl border border-[#ECC3B8] bg-[#FDF2EF] px-4 py-3 text-sm text-[#8F2309]"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <ul className="space-y-0.5">
                {errors.map((msg, idx) => (
                  <li key={idx}>{msg}</li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              onClick={() => setErrors([])}
              aria-label="Dismiss error message"
              className="rounded-md p-1 hover:bg-[#F7DFD8] cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Master Combined Waveform Timeline */}
        <div className="mb-6">
          <MasterTimeline
            clips={clips}
            timeline={timeline}
            gapSeconds={settings.gapSeconds}
            currentTime={currentTime}
            isPlaying={isPlayingMaster}
            onTogglePlay={handleToggleMasterPlay}
            onStop={() => stopAllAudio(true)}
            onSeek={handleSeek}
          />
        </div>

        {/* Two-column Workspace: Sequential Clip Queue + Merge & Export Inspector */}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_340px]">
          <ClipQueue
            clips={clips}
            isDecoding={isDecoding}
            auditionClipId={auditionClipId}
            onFilesSelected={(files) => {
              void handleFilesSelected(files);
            }}
            onTriggerUpload={handleTriggerUpload}
            onLoadSampleClips={() => {
              void handleLoadSampleClips();
            }}
            onMoveClip={handleMoveClip}
            onRemoveClip={handleRemoveClip}
            onClearAll={handleClearAll}
            onToggleAuditionClip={(id) => {
              void handleToggleAuditionClip(id);
            }}
          />

          <ExportPanel
            clips={clips}
            totalDuration={timeline.totalDuration}
            targetSampleRate={targetSampleRate}
            targetChannels={targetChannels}
            settings={settings}
            exportStatus={exportStatus}
            onUpdateSettings={(patch) =>
              setSettings((prev) => ({ ...prev, ...patch }))
            }
            onExport={() => {
              void handleExport();
            }}
          />
        </div>
      </main>
    </div>
  );
}
