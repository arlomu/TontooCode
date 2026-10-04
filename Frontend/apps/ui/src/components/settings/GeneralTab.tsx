import { useState } from 'react';
import { Bell, ChevronDown, Folder, SquareTerminal } from 'lucide-react';
import { cn } from '@/lib/utils';

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-200',
        checked ? 'bg-tt-signal' : 'bg-tt-hairline',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute top-[2px] size-[18px] rounded-full bg-white shadow transition-all duration-200',
          checked ? 'left-[18px]' : 'left-[2px]',
        )}
      />
    </button>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-tt-hairline bg-tt-card p-5">{children}</section>
  );
}

function CardTitle({ icon: Icon, children }: { icon: typeof Folder; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-[14px] font-bold text-tt-ink">
      <Icon size={15} className="shrink-0 text-tt-ink-2" strokeWidth={1.9} />
      {children}
    </h2>
  );
}

function CardText({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-[13px] leading-relaxed text-tt-ink-2">{children}</p>;
}

const SHELLS: Record<string, string[]> = {
  win32: ['Git Bash — default', 'PowerShell', 'Command Prompt', 'Windows Terminal'],
  darwin: ['Terminal — default', 'iTerm2', 'Warp'],
  linux: ['Bash — default', 'Zsh', 'Fish'],
};

function platformId(): string {
  const p = window.tontoo?.platform;
  if (p === 'darwin' || p === 'linux' || p === 'win32') return p;
  if (typeof navigator !== 'undefined' && /mac/i.test(navigator.platform ?? '')) return 'darwin';
  if (typeof navigator !== 'undefined' && /linux/i.test(navigator.platform ?? '')) return 'linux';
  return 'win32';
}

export function GeneralTab() {
  // Session-only on purpose: nothing is persisted anywhere yet.
  const [folder, setFolder] = useState('C:\\Users\\username\\tflow');
  const [shell, setShell] = useState(SHELLS[platformId()]![0]!);
  const [notify, setNotify] = useState(true);
  const [sound, setSound] = useState(true);

  const platform = platformId();
  const shells = SHELLS[platform] ?? SHELLS.win32!;

  const changeFolder = async () => {
    const folders = await window.tontoo?.pickFolder?.().catch(() => [] as string[]);
    if (folders && folders.length > 0) setFolder(folders[0]!);
  };

  return (
    <div className="mx-auto w-full max-w-[680px] space-y-4 px-6 py-6">
      {/* folder for tasks without project */}
      <Card>
        <CardTitle icon={Folder}>Folder for tasks without project</CardTitle>
        <CardText>Choose where tasks run that are not assigned to a project.</CardText>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-tt-hairline bg-tt-panel px-3 py-2">
          <Folder size={14} className="shrink-0 text-tt-ink-3" strokeWidth={1.9} />
          <span className="font-mono2 min-w-0 flex-1 truncate text-[12.5px] text-tt-ink">
            {folder}
          </span>
          <button
            type="button"
            onClick={() => void changeFolder()}
            className="shrink-0 rounded-md border border-tt-hairline bg-white px-3 py-1 text-[12.5px] font-medium text-tt-ink transition-colors hover:border-tt-signal/50 hover:text-tt-signal"
          >
            Change
          </button>
        </div>
      </Card>

      {/* integrated terminal */}
      <Card>
        <CardTitle icon={SquareTerminal}>Integrated terminal</CardTitle>
        <CardText>
          Select the default shell for the integrated terminal. Options are shown based on your
          operating system and installed tools. Detected platform: {platform}.
        </CardText>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[13.5px] font-bold text-tt-ink">Shell</p>
            <p className="mt-0.5 text-[12.5px] text-tt-ink-2">
              Suggested: Git Bash — Git Bash preferred when available
            </p>
          </div>
          <div className="relative shrink-0">
            <select
              value={shells.includes(shell) ? shell : shells[0]!}
              onChange={(e) => setShell(e.target.value)}
              aria-label="Shell"
              className="cursor-pointer appearance-none rounded-lg border border-tt-hairline bg-white py-2 pr-9 pl-3.5 text-[13px] font-medium text-tt-ink outline-none transition-colors hover:border-tt-signal/50"
            >
              {shells.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-tt-ink-3"
            />
          </div>
        </div>
      </Card>

      {/* notifications */}
      <Card>
        <CardTitle icon={Bell}>Notifications</CardTitle>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[13.5px] font-bold text-tt-ink">Notify when agent is finished</p>
            <p className="mt-0.5 text-[12.5px] text-tt-ink-2">
              Show a Windows notification when an agent completes a task. Default on.
            </p>
          </div>
          <Toggle checked={notify} onChange={setNotify} label="Notify when agent is finished" />
        </div>
        <div className="mt-4 flex items-center justify-between gap-4 border-t border-tt-hairline pt-4">
          <div className="min-w-0">
            <p className="text-[13.5px] font-bold text-tt-ink">Play sound when agent is finished</p>
            <p className="mt-0.5 text-[12.5px] text-tt-ink-2">
              Play a short sound when an agent completes a task. Can be disabled.
            </p>
          </div>
          <Toggle checked={sound} onChange={setSound} label="Play sound when agent is finished" />
        </div>
      </Card>

</div>
  );
}
