import { useEffect, useRef } from 'react';
import { Pause, Play, Square } from 'lucide-react';
import type { AudioClip } from '../types/audio';
import type { TimelineSummary } from '../utils/audioConcat';
import { formatDuration } from '../utils/audioConcat';

interface MasterTimelineProps {
  clips: AudioClip[];
  timeline: TimelineSummary;
  gapSeconds: number;
  currentTime: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onStop: () => void;
  onSeek: (seconds: number) => void;
}

export function MasterTimeline({
  clips,
  timeline,
  gapSeconds,
  currentTime,
  isPlaying,
  onTogglePlay,
  onStop,
  onSeek,
}: MasterTimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const totalDuration = timeline.totalDuration;
  const hasClips = clips.length > 0 && totalDuration > 0;

  // Determine which clip is currently under the playhead
  const activeSegment = timeline.segments.find(
    (seg) => currentTime >= seg.start && currentTime <= seg.end,
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const laneTop = 22;
    const waveHeight = Math.max(20, height - laneTop);
    const waveCenterY = laneTop + waveHeight / 2;

    // Clear canvas surface
    ctx.fillStyle = '#FAFAF8';
    ctx.fillRect(0, 0, width, height);

    if (!hasClips) {
      ctx.strokeStyle = '#E6E3DB';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      return;
    }

    const playheadX = Math.max(
      0,
      Math.min(width, (currentTime / totalDuration) * width),
    );

    // Draw alternating clip regions and waveform bars
    for (let i = 0; i < timeline.segments.length; i++) {
      const seg = timeline.segments[i];
      const clip = clips[i];
      if (!clip) continue;

      const xStart = (seg.start / totalDuration) * width;
      const xEnd = (seg.end / totalDuration) * width;
      const segWidth = Math.max(2, xEnd - xStart);

      // Subtle alternating track bed for clip separation
      if (i % 2 === 1) {
        ctx.fillStyle = '#F2EFE8';
        ctx.fillRect(xStart, 0, segWidth, height);
      }

      // Draw clip boundary divider tick
      if (i > 0) {
        ctx.strokeStyle = '#D3CFC4';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(xStart, 0);
        ctx.lineTo(xStart, height);
        ctx.stroke();
      }

      // Draw silence gap hatch band if gapSeconds > 0 and not the last clip
      if (gapSeconds > 0 && i < timeline.segments.length - 1) {
        const nextSeg = timeline.segments[i + 1];
        const gapStart = xEnd;
        const gapEnd = (nextSeg.start / totalDuration) * width;
        if (gapEnd > gapStart + 1) {
          ctx.fillStyle = '#EAE6DC';
          ctx.fillRect(gapStart, 0, gapEnd - gapStart, height);
        }
      }

      // Clip sequence index label in reserved top lane
      if (segWidth >= 28) {
        ctx.fillStyle = '#575651';
        ctx.font = '500 11px "JetBrains Mono", monospace';
        const idxLabel = String(i + 1).padStart(2, '0');
        const label =
          segWidth >= 140
            ? `${idxLabel} · ${clip.name.slice(0, Math.floor((segWidth - 40) / 7))}`
            : idxLabel;
        ctx.fillText(label, xStart + 7, 15);
      }

      // Draw waveform bars inside lower waveform zone
      const peaks = clip.peaks;
      const barStep = 4;
      const barWidth = 2;
      const numBars = Math.max(1, Math.floor((segWidth - 6) / barStep));
      const maxAmpHeight = waveHeight * 0.78;

      for (let b = 0; b < numBars; b++) {
        const peakIdx = Math.min(
          peaks.length - 1,
          Math.floor((b / numBars) * peaks.length),
        );
        const amp = peaks[peakIdx] ?? 0.1;
        const barH = Math.max(4, amp * maxAmpHeight);
        const bx = xStart + 3 + b * barStep;
        const by = waveCenterY - barH / 2;

        const isPlayed = bx <= playheadX;
        ctx.fillStyle = isPlayed ? '#C83E18' : '#2E2D2A';
        ctx.fillRect(bx, by, barWidth, barH);
      }
    }

    // Subtle hairline separating top label strip from waveform area
    ctx.strokeStyle = '#E6E3DB';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, laneTop);
    ctx.lineTo(width, laneTop);
    ctx.stroke();

    // Subtle center baseline in waveform zone
    ctx.strokeStyle = '#ECE9E1';
    ctx.beginPath();
    ctx.moveTo(0, waveCenterY);
    ctx.lineTo(width, waveCenterY);
    ctx.stroke();

    // Draw playhead line
    ctx.strokeStyle = '#C83E18';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();
  }, [clips, timeline, gapSeconds, currentTime, totalDuration, hasClips]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!hasClips) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(ratio * totalDuration);
  };

  return (
    <section
      id="timeline-section"
      aria-label="Master stitched timeline"
      className="scroll-mt-20 rounded-xl border border-[#E2DFD7] bg-white p-5 sm:p-6"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-[#141413]">
            Master Stitched Timeline
          </h2>
          <p className="text-sm text-[#575651]">
            {hasClips
              ? activeSegment
                ? `Playing clip ${String(activeSegment.index + 1).padStart(2, '0')} · ${activeSegment.name}`
                : `${clips.length} ${clips.length === 1 ? 'clip' : 'clips'} chained back-to-back`
              : 'Add voice files below to preview the combined track'}
          </p>
        </div>

        <div
          className="font-mono text-sm font-medium text-[#141413] tabular-nums"
          aria-live="off"
        >
          <span data-testid="current-timecode">{formatDuration(currentTime)}</span>
          <span className="mx-1.5 text-[#8A8880]">/</span>
          <span data-testid="total-timecode" className="text-[#575651]">
            {formatDuration(totalDuration)}
          </span>
        </div>
      </div>

      {/* Waveform canvas surface */}
      <div className="relative overflow-hidden rounded-lg border border-[#E2DFD7] bg-[#FAFAF8]">
        <canvas
          ref={canvasRef}
          data-testid="master-waveform-canvas"
          onClick={handleCanvasClick}
          className={`block h-28 w-full ${hasClips ? 'cursor-pointer' : 'cursor-default'}`}
        />
        {!hasClips && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center">
            <span className="text-sm text-[#76746E]">
              Combined waveform renders here once audio clips are queued
            </span>
          </div>
        )}
      </div>

      {/* Accessible scrub slider + Transport controls */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onTogglePlay}
            disabled={!hasClips}
            aria-label={isPlaying ? 'Pause combined audio' : 'Play combined audio'}
            className="inline-flex items-center gap-2 rounded-lg bg-[#C83E18] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#AE3412] disabled:cursor-not-allowed disabled:bg-[#DFDCD4] disabled:text-[#76746E] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C83E18] whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isPlaying ? (
              <>
                <Pause className="h-4 w-4" aria-hidden="true" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4" aria-hidden="true" />
                <span>Play Combined</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onStop}
            disabled={!hasClips || (currentTime === 0 && !isPlaying)}
            aria-label="Stop and reset playhead"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8D4CA] bg-white px-3.5 py-2 text-sm font-medium text-[#141413] transition-colors hover:bg-[#F3F1EC] disabled:cursor-not-allowed disabled:border-[#EAE7DF] disabled:text-[#9A9890] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C83E18] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Square className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Stop</span>
          </button>
        </div>

        <div className="flex min-w-[200px] flex-1 items-center gap-3 sm:max-w-md">
          <label htmlFor="timeline-scrubber" className="sr-only">
            Seek stitched timeline position
          </label>
          <input
            id="timeline-scrubber"
            type="range"
            min={0}
            max={hasClips ? totalDuration : 1}
            step={0.01}
            value={hasClips ? Math.min(currentTime, totalDuration) : 0}
            disabled={!hasClips}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer accent-[#C83E18] disabled:cursor-not-allowed"
          />
        </div>
      </div>
    </section>
  );
}
