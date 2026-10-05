import { useState } from 'react';
import { Check, File, Grid2x2, Monitor, MousePointer2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SelectionMode = 'allow' | 'block';

export interface ComputerUse {
  enabled: boolean;
  selectionMode: SelectionMode;
  /** App ids the rule applies to. */
  selectedApps: string[];
  cursorColor: string;
}

export const DEFAULT_CURSOR_COLOR = '#FF7300';

export const DEFAULT_COMPUTER_USE: ComputerUse = {
  enabled: true,
  selectionMode: 'allow',
  selectedApps: [],
  cursorColor: DEFAULT_CURSOR_COLOR,
};

/**
 * Static catalog for now — without a backend there is no way to enumerate
 * installed apps. Entries mirror a typical Windows machine.
 */
const APPS: { id: string; name: string }[] = [
  { id: '7zip', name: '7-Zip File Manager' },
  { id: 'access', name: 'Access' },
  { id: 'admintools', name: 'Administrative Tools' },
  { id: 'android-studio', name: 'Android Studio' },
  { id: 'anwenderdoku', name: 'Anwenderdokumentation' },
  { id: 'appverifier', name: 'Application Verifier (WOW)' },
  { id: 'calculator', name: 'Calculator' },
  { id: 'discord', name: 'Discord' },
  { id: 'chrome', name: 'Google Chrome' },
  { id: 'notepad', name: 'Notepad' },
  { id: 'paint', name: 'Paint' },
  { id: 'vscode', name: 'Visual Studio Code' },
];

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-tt-hairline bg-tt-card p-5">{children}</section>
  );
}

function CardTitle({ icon: Icon, children }: { icon: typeof Monitor; children: React.ReactNode }) {
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

export interface ComputerUseProps {
  value: ComputerUse;
  onPatch: (patch: Partial<ComputerUse>) => void;
}

/**
 * Computer Use settings. State lives in App and is persisted to the
 * backend DB when reachable.
 */
export function ComputerUseTab({ value, onPatch }: ComputerUseProps) {
  const toggleApp = (id: string) =>
    onPatch({
      selectedApps: value.selectedApps.includes(id)
        ? value.selectedApps.filter((a) => a !== id)
        : [...value.selectedApps, id],
    });

  return (
    <div className="mx-auto w-full max-w-[680px] space-y-4 px-6 py-6">
      <div>
        <h1 className="font-display text-[22px] font-extrabold tracking-tight text-tt-ink">
          Computer Use
        </h1>
        <p className="mt-1 text-[13px] text-tt-ink-2">
          Control computer access, allowed apps and the cursor.
        </p>
      </div>

      {/* enable */}
      <Card>
        <CardTitle icon={Monitor}>Computer use</CardTitle>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[13.5px] font-bold text-tt-ink">Enable computer use</p>
            <p className="mt-0.5 text-[12.5px] text-tt-ink-2">
              Allow the assistant to observe and control this computer. Stored only for now.
            </p>
          </div>
          <Toggle
            checked={value.enabled}
            onChange={(v) => onPatch({ enabled: v })}
            label="Enable computer use"
          />
        </div>
      </Card>

      {/* allowed apps */}
      <Card>
        <CardTitle icon={Grid2x2}>Allowed apps</CardTitle>
        <CardText>The assistant may only use the selected apps.</CardText>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[13.5px] font-bold text-tt-ink">Selection mode</p>
            <p className="font-mono2 mt-0.5 text-[12px] text-tt-ink-2 tabular">
              {value.selectedApps.length} of {APPS.length} selected
            </p>
          </div>
          <div className="relative shrink-0">
            <select
              value={value.selectionMode}
              onChange={(e) => onPatch({ selectionMode: e.target.value as SelectionMode })}
              aria-label="Selection mode"
              className="cursor-pointer appearance-none rounded-lg border border-tt-hairline bg-tt-card py-2 pr-9 pl-3.5 text-[13px] font-medium text-tt-ink outline-none transition-colors hover:border-tt-signal/50"
            >
              <option value="allow">Allow selected</option>
              <option value="block">Block selected</option>
            </select>
            <span
              aria-hidden
              className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[10px] text-tt-ink-3"
            >
              ▾
            </span>
          </div>
        </div>
        <AppList selected={value.selectedApps} onToggle={toggleApp} />
      </Card>

      {/* cursor */}
      <Card>
        <CardTitle icon={MousePointer2}>Cursor</CardTitle>
        <CardText>Color of the automated cursor.</CardText>
        <div className="mt-4 flex items-center gap-5">
          <div>
            <div
              className="grid size-[120px] place-items-center overflow-hidden rounded-lg border border-tt-hairline"
              style={{
                backgroundImage:
                  'radial-gradient(circle, rgb(140 147 160 / 0.45) 1px, transparent 1.4px)',
                backgroundSize: '14px 14px',
              }}
            >
              <span className="relative block">
                <MousePointer2
                  size={34}
                  strokeWidth={1.8}
                  style={{ color: value.cursorColor }}
                  fill="white"
                />
                <span
                  aria-hidden
                  className="absolute -right-1.5 -bottom-1 size-3.5 rounded-full border-2 border-white"
                  style={{ background: value.cursorColor }}
                />
              </span>
            </div>
            <p className="font-mono2 mt-1.5 text-center text-[9.5px] tracking-[0.16em] text-tt-ink-3 uppercase">
              Preview
            </p>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-bold text-tt-ink">Color</p>
            <p className="mt-0.5 text-[12.5px] text-tt-ink-2">
              Used for the cursor arrow and its ring in the preview above.
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => onPatch({ cursorColor: DEFAULT_CURSOR_COLOR })}
                disabled={value.cursorColor.toLowerCase() === DEFAULT_CURSOR_COLOR.toLowerCase()}
                title="Reset to default color"
                className="font-mono2 rounded-full border border-tt-hairline bg-tt-card px-2 py-0.5 text-[10px] tracking-wide text-tt-ink-3 uppercase transition-all hover:border-tt-signal/50 hover:text-tt-signal disabled:cursor-default disabled:opacity-50"
              >
                Reset
              </button>
              <label
                title="Custom cursor color"
                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-tt-hairline bg-tt-card px-2 py-1 transition-colors hover:border-tt-signal/50"
              >
                <input
                  type="color"
                  className="sr-only"
                  value={value.cursorColor}
                  onChange={(e) => onPatch({ cursorColor: e.target.value })}
                  aria-label="Custom cursor color"
                />
                <span
                  aria-hidden
                  className="size-3.5 rounded-full border border-black/10"
                  style={{ background: value.cursorColor }}
                />
                <span className="font-mono2 text-[11.5px] text-tt-ink">
                  {value.cursorColor.toUpperCase()}
                </span>
              </label>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function AppList({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const hits = q ? APPS.filter((a) => a.name.toLowerCase().includes(q)) : APPS;

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 rounded-lg border border-tt-hairline bg-tt-card px-3 py-2">
        <Search size={14} className="shrink-0 text-tt-ink-3" strokeWidth={2.1} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search installed apps..."
          aria-label="Search installed apps"
          className="w-full bg-transparent text-[13px] text-tt-ink outline-none placeholder:text-tt-ink-3"
        />
      </div>
      <ul className="tt-scrollblock mt-2 max-h-[264px] divide-y divide-tt-hairline/70 overflow-y-auto rounded-lg border border-tt-hairline">
        {hits.length === 0 && (
          <li className="font-mono2 px-3 py-4 text-center text-[11.5px] text-tt-ink-3">
            no app matches “{query.trim()}”
          </li>
        )}
        {hits.map((app) => {
          const checked = selected.includes(app.id);
          return (
            <li key={app.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => onToggle(app.id)}
                className="flex w-full items-center gap-2.5 px-3 py-[7px] text-left transition-colors hover:bg-tt-panel/60"
              >
                <span
                  aria-hidden
                  className={cn(
                    'flex size-4 shrink-0 items-center justify-center rounded border transition-colors',
                    checked ? 'border-transparent bg-tt-signal' : 'border-tt-ink-3/60 bg-white',
                  )}
                >
                  {checked && <Check size={11} strokeWidth={3.5} className="text-white" />}
                </span>
                <File size={15} className="shrink-0 text-tt-ink-3" strokeWidth={1.8} />
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-[13px]',
                    checked ? 'font-medium text-tt-ink' : 'text-tt-ink-2',
                  )}
                >
                  {app.name}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
