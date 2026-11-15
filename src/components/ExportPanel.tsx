import { CheckCircle2, Download } from 'lucide-react';
import type { AudioClip, ExportStatus, StitchSettings } from '../types/audio';
import type { ExportFormat } from '../utils/audioConcat';
import { formatBytes, formatDuration, sanitizeOutputFilename } from '../utils/audioConcat';

interface ExportPanelProps {
  clips: AudioClip[];
  totalDuration: number;
  targetSampleRate: number;
  targetChannels: number;
  settings: StitchSettings;
  exportStatus: ExportStatus;
  onUpdateSettings: (patch: Partial<StitchSettings>) => void;
  onExport: () => void;
}

const GAP_OPTIONS = [
  { label: '0s', value: 0 },
  { label: '0.25s', value: 0.25 },
  { label: '0.5s', value: 0.5 },
  { label: '1.0s', value: 1 },
];

const FORMAT_OPTIONS: Array<{ label: string; value: ExportFormat }> = [
  { label: 'MP3 (192 kbps)', value: 'mp3' },
  { label: 'WAV (Lossless)', value: 'wav' },
];

export function ExportPanel({
  clips,
  totalDuration,
  targetSampleRate,
  targetChannels,
  settings,
  exportStatus,
  onUpdateSettings,
  onExport,
}: ExportPanelProps) {
  const canExport = clips.length > 0 && exportStatus.state !== 'encoding';
  const resolvedFilename = sanitizeOutputFilename(settings.outputName, settings.format);

  return (
    <aside
      id="export-section"
      aria-label="Merge and export settings"
      className="rounded-xl border border-[#E2DFD7] bg-white p-5 sm:p-6"
    >
      <h2 className="font-display text-lg font-semibold text-[#141413]">
        Merge &amp; Export
      </h2>
      <p className="mt-0.5 text-sm text-[#575651]">
        Combines all queued clips into one single audio file in your browser.
      </p>

      <div className="mt-5 space-y-5">
        {/* Output Filename */}
        <div>
          <label
            htmlFor="output-filename"
            className="block text-xs font-medium text-[#575651]"
          >
            Output filename
          </label>
          <input
            id="output-filename"
            type="text"
            value={settings.outputName}
            onChange={(e) => onUpdateSettings({ outputName: e.target.value })}
            placeholder="stitched-voice"
            className="mt-1.5 w-full rounded-lg border border-[#D8D4CA] bg-[#FAFAF8] px-3 py-2 text-sm text-[#141413] placeholder:text-[#8A8880] focus:border-[#141413] focus:bg-white focus:outline-none"
          />
          <p className="mt-1 font-mono text-xs text-[#76746E] truncate">
            Saves as {resolvedFilename}
          </p>
        </div>

        {/* Gap Between Clips */}
        <div>
          <span className="block text-xs font-medium text-[#575651]">
            Gap between clips
          </span>
          <div
            role="group"
            aria-label="Gap between clips"
            className="mt-1.5 grid grid-cols-4 gap-1 rounded-lg bg-[#EFECE6] p-1"
          >
            {GAP_OPTIONS.map((opt) => {
              const active = settings.gapSeconds === opt.value;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => onUpdateSettings({ gapSeconds: opt.value })}
                  aria-pressed={active}
                  className={`rounded-md px-2 py-1.5 font-mono text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white text-[#141413] shadow-xs'
                      : 'text-[#575651] hover:text-[#141413]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Output Format */}
        <div>
          <span className="block text-xs font-medium text-[#575651]">
            Output format
          </span>
          <div
            role="group"
            aria-label="Output format"
            className="mt-1.5 grid grid-cols-2 gap-1 rounded-lg bg-[#EFECE6] p-1"
          >
            {FORMAT_OPTIONS.map((opt) => {
              const active = settings.format === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onUpdateSettings({ format: opt.value })}
                  aria-pressed={active}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white text-[#141413] shadow-xs'
                      : 'text-[#575651] hover:text-[#141413]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Peak Level Normalization */}
        <label className="flex cursor-pointer items-start gap-2.5 pt-1">
          <input
            type="checkbox"
            checked={settings.normalize}
            onChange={(e) => onUpdateSettings({ normalize: e.target.checked })}
            className="mt-0.5 h-4 w-4 rounded border-[#CFCAC0] accent-[#C83E18]"
          />
          <span className="text-sm text-[#141413]">
            Match peak volume across clips
            <span className="block text-xs text-[#575651]">
              Balances quiet and loud voice recordings before stitching
            </span>
          </span>
        </label>

        {/* Live Output Specs */}
        <dl className="divide-y divide-[#ECE9E1] border-t border-b border-[#ECE9E1] py-1 text-sm">
          <div className="flex items-center justify-between py-2">
            <dt className="text-[#575651]">Queued clips</dt>
            <dd data-testid="export-clip-count" className="font-mono font-medium text-[#141413] tabular-nums">
              {clips.length}
            </dd>
          </div>
          <div className="flex items-center justify-between py-2">
            <dt className="text-[#575651]">Combined length</dt>
            <dd data-testid="export-total-duration" className="font-mono font-medium text-[#141413] tabular-nums">
              {formatDuration(totalDuration)}
            </dd>
          </div>
          <div className="flex items-center justify-between py-2">
            <dt className="text-[#575651]">Sample rate</dt>
            <dd className="font-mono text-xs font-medium text-[#141413] tabular-nums">
              {clips.length > 0 ? `${(targetSampleRate / 1000).toFixed(1)} kHz` : '—'}
            </dd>
          </div>
          <div className="flex items-center justify-between py-2">
            <dt className="text-[#575651]">Channels</dt>
            <dd className="font-mono text-xs font-medium text-[#141413]">
              {clips.length > 0 ? (targetChannels === 1 ? 'Mono' : 'Stereo') : '—'}
            </dd>
          </div>
        </dl>

        {/* Merge & Download CTA */}
        <div>
          <button
            type="button"
            onClick={onExport}
            disabled={!canExport}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#C83E18] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#AE3412] disabled:cursor-not-allowed disabled:bg-[#DFDCD4] disabled:text-[#76746E] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C83E18] whitespace-nowrap cursor-pointer"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>
              {exportStatus.state === 'encoding'
                ? `Encoding ${settings.format.toUpperCase()} (${Math.round(exportStatus.progress * 100)}%)`
                : `Merge & Download ${settings.format.toUpperCase()}`}
            </span>
          </button>

          {exportStatus.state === 'encoding' && (
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[#EFECE6]">
              <div
                className="h-full bg-[#C83E18] transition-all duration-150"
                style={{ width: `${Math.round(exportStatus.progress * 100)}%` }}
              />
            </div>
          )}

          {exportStatus.state === 'done' && exportStatus.lastFilename && (
            <div
              data-testid="export-success-banner"
              className="mt-3 rounded-lg border border-[#C6DFCB] bg-[#F1F8F3] p-3 text-xs text-[#195328]"
            >
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#1E6A33]" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">
                    Ready: {exportStatus.lastFilename}
                  </p>
                  <p className="mt-0.5 text-[#2E6B3E] tabular-nums">
                    {formatBytes(exportStatus.lastSizeBytes ?? 0)} stitched locally.
                    {exportStatus.downloadUrl && (
                      <>
                        {' '}
                        <a
                          href={exportStatus.downloadUrl}
                          download={exportStatus.lastFilename}
                          className="font-semibold underline underline-offset-2 hover:text-[#113D1D]"
                        >
                          Download again
                        </a>
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {exportStatus.state === 'error' && exportStatus.error && (
            <p className="mt-3 text-xs font-medium text-[#B33012]" role="alert">
              {exportStatus.error}
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
