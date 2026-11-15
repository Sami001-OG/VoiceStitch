import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  AudioLines,
  GripVertical,
  Play,
  Square,
  Trash2,
  Upload,
} from 'lucide-react';
import type { AudioClip } from '../types/audio';
import { formatBytes, formatDuration } from '../utils/audioConcat';

interface ClipQueueProps {
  clips: AudioClip[];
  isDecoding: boolean;
  auditionClipId: string | null;
  onFilesSelected: (files: File[]) => void;
  onTriggerUpload: () => void;
  onLoadSampleClips: () => void;
  onMoveClip: (fromIndex: number, toIndex: number) => void;
  onRemoveClip: (id: string) => void;
  onClearAll: () => void;
  onToggleAuditionClip: (id: string) => void;
}

export function ClipQueue({
  clips,
  isDecoding,
  auditionClipId,
  onFilesSelected,
  onTriggerUpload,
  onLoadSampleClips,
  onMoveClip,
  onRemoveClip,
  onClearAll,
  onToggleAuditionClip,
}: ClipQueueProps) {
  const [isDragOverDropzone, setIsDragOverDropzone] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragTargetIndex, setDragTargetIndex] = useState<number | null>(null);

  const handleDropzoneDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOverDropzone(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  return (
    <section
      id="queue-section"
      aria-label="Sequential clip queue"
      className="rounded-xl border border-[#E2DFD7] bg-white p-5 sm:p-6"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-[#141413]">
            Sequential Clip Queue
          </h2>
          <p className="text-sm text-[#575651]">
            Files stitch top-to-bottom in exact order. Drag rows or use arrows to reorder.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {clips.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="rounded-lg border border-[#D8D4CA] bg-white px-3.5 py-2 text-sm font-medium text-[#575651] transition-colors hover:bg-[#F3F1EC] hover:text-[#141413] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C83E18] whitespace-nowrap shrink-0 cursor-pointer"
            >
              Clear All
            </button>
          )}
          <button
            type="button"
            onClick={onTriggerUpload}
            className="inline-flex items-center gap-2 rounded-lg border border-[#D8D4CA] bg-[#FAFAF8] px-3.5 py-2 text-sm font-medium text-[#141413] transition-colors hover:bg-[#EFECE6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C83E18] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            <span>Upload More</span>
          </button>
        </div>
      </div>

      {/* Dropzone area (prominent when empty, compact append bar when populated) */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (draggedIndex === null) {
            setIsDragOverDropzone(true);
          }
        }}
        onDragLeave={() => setIsDragOverDropzone(false)}
        onDrop={handleDropzoneDrop}
        className={`rounded-lg border border-dashed transition-colors ${
          isDragOverDropzone
            ? 'border-[#C83E18] bg-[#C83E18]/5'
            : 'border-[#CFCAC0] bg-[#FAFAF8]'
        } ${clips.length === 0 ? 'px-6 py-12 text-center' : 'mb-4 px-4 py-3'}`}
      >
        {clips.length === 0 ? (
          <div className="mx-auto max-w-md">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg border border-[#E2DFD7] bg-white text-[#141413]">
              <AudioLines className="h-5 w-5" aria-hidden="true" />
            </div>
            <h3 className="font-display text-base font-semibold text-[#141413]">
              Drop MP3, WAV, or voice recordings here
            </h3>
            <p className="mt-1 text-sm text-[#575651]">
              Select multiple audio files at once or add them one by one. Nothing leaves your browser.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onTriggerUpload}
                disabled={isDecoding}
                className="inline-flex items-center gap-2 rounded-lg bg-[#141413] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2C2C2A] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C83E18] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                <span>{isDecoding ? 'Decoding Audio...' : 'Browse Audio Files'}</span>
              </button>

              <button
                type="button"
                onClick={onLoadSampleClips}
                disabled={isDecoding}
                className="inline-flex items-center gap-2 rounded-lg border border-[#D8D4CA] bg-white px-4 py-2 text-sm font-medium text-[#141413] transition-colors hover:bg-[#EFECE6] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C83E18] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Load Sample Clips</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[#575651]">
            <span>
              {isDecoding
                ? 'Decoding audio files locally...'
                : 'Drag additional .mp3, .wav, or .m4a files here to append them to the end'}
            </span>
            <span className="font-mono text-xs text-[#76746E] tabular-nums">
              100% local decoding
            </span>
          </div>
        )}
      </div>

      {/* Sequential Clip Rows */}
      {clips.length > 0 && (
        <ol data-testid="clip-queue-list" className="divide-y divide-[#ECE9E1] border-t border-[#ECE9E1]">
          {clips.map((clip, idx) => {
            const isAuditioning = auditionClipId === clip.id;
            const isDropTarget = dragTargetIndex === idx && draggedIndex !== idx;

            return (
              <li
                key={clip.id}
                draggable
                onDragStart={() => setDraggedIndex(idx)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (draggedIndex !== null) {
                    setDragTargetIndex(idx);
                  }
                }}
                onDragLeave={() => {
                  if (dragTargetIndex === idx) {
                    setDragTargetIndex(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedIndex !== null && draggedIndex !== idx) {
                    onMoveClip(draggedIndex, idx);
                  }
                  setDraggedIndex(null);
                  setDragTargetIndex(null);
                }}
                onDragEnd={() => {
                  setDraggedIndex(null);
                  setDragTargetIndex(null);
                }}
                className={`flex flex-wrap items-center gap-3 py-3.5 transition-colors sm:flex-nowrap sm:gap-4 ${
                  isDropTarget ? 'bg-[#F3F1EC]' : 'hover:bg-[#FAFAF8]'
                }`}
              >
                {/* Order + Drag Handle */}
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className="cursor-grab text-[#9A9890] hover:text-[#575651] active:cursor-grabbing"
                    aria-hidden="true"
                    title="Drag to reorder"
                  >
                    <GripVertical className="h-4 w-4" />
                  </span>
                  <span className="w-6 font-mono text-xs font-semibold text-[#575651] tabular-nums">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                </div>

                {/* Play/Stop single clip audition */}
                <button
                  type="button"
                  onClick={() => onToggleAuditionClip(clip.id)}
                  aria-label={isAuditioning ? `Stop "${clip.name}"` : `Play "${clip.name}"`}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C83E18] cursor-pointer ${
                    isAuditioning
                      ? 'border-[#C83E18] bg-[#C83E18] text-white'
                      : 'border-[#D8D4CA] bg-white text-[#141413] hover:bg-[#EFECE6]'
                  }`}
                >
                  {isAuditioning ? (
                    <Square className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </button>

                {/* Clip Name & Clean Unboxed Metadata */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#141413]" title={clip.name}>
                    {clip.name}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[#575651] tabular-nums">
                    <span className="font-mono font-medium text-[#141413]">
                      {formatDuration(clip.duration)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{clip.formatLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span>{(clip.sampleRate / 1000).toFixed(1)} kHz</span>
                    <span aria-hidden="true">·</span>
                    <span>{clip.channels === 1 ? 'Mono' : 'Stereo'}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatBytes(clip.sizeBytes)}</span>
                  </div>
                </div>

                {/* Inline Mini SVG Waveform */}
                <div className="hidden w-32 shrink-0 sm:block" aria-hidden="true">
                  <svg
                    viewBox="0 0 112 28"
                    className="h-7 w-full"
                    preserveAspectRatio="none"
                  >
                    {clip.peaks.slice(0, 28).map((peak, pIdx) => {
                      const barH = Math.max(3, peak * 24);
                      const y = (28 - barH) / 2;
                      return (
                        <rect
                          key={pIdx}
                          x={pIdx * 4}
                          y={y}
                          width={2}
                          height={barH}
                          rx={1}
                          fill={isAuditioning ? '#C83E18' : '#3E3D39'}
                        />
                      );
                    })}
                  </svg>
                </div>

                {/* Reorder & Remove Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onMoveClip(idx, idx - 1)}
                    disabled={idx === 0}
                    aria-label={`Move "${clip.name}" up`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-[#575651] transition-colors hover:border-[#E2DFD7] hover:bg-[#F3F1EC] hover:text-[#141413] disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C83E18] cursor-pointer"
                  >
                    <ArrowUp className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveClip(idx, idx + 1)}
                    disabled={idx === clips.length - 1}
                    aria-label={`Move "${clip.name}" down`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-[#575651] transition-colors hover:border-[#E2DFD7] hover:bg-[#F3F1EC] hover:text-[#141413] disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C83E18] cursor-pointer"
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveClip(clip.id)}
                    aria-label={`Remove "${clip.name}"`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-[#575651] transition-colors hover:border-[#F2CFC6] hover:bg-[#FDF2EF] hover:text-[#B33012] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C83E18] cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
