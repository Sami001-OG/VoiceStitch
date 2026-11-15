import { Plus } from 'lucide-react';

interface TopBarProps {
  onTriggerUpload: () => void;
}

export function TopBar({ onTriggerUpload }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#E2DFD7] bg-[#F6F5F1]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
        <a
          href="#top"
          className="font-display text-xl font-bold tracking-tight text-[#141413] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#C83E18]"
        >
          VoiceStitch
        </a>

        <nav
          aria-label="Workspace sections"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-[#575651]"
        >
          <a
            href="#timeline-section"
            className="hover:text-[#141413] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Master Timeline
          </a>
          <a
            href="#queue-section"
            className="hover:text-[#141413] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Clip Queue
          </a>
          <a
            href="#export-section"
            className="hover:text-[#141413] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Export
          </a>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onTriggerUpload}
            className="inline-flex items-center gap-2 rounded-lg bg-[#141413] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2C2C2A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C83E18] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Add Audio Files</span>
          </button>
        </div>
      </div>
    </header>
  );
}
