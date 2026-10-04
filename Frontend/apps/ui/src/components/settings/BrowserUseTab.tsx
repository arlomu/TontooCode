import { Bot, ChevronDown, Globe, MousePointer2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BrowserUse {
  openLinksWith: string;
  clearBrowsingData: boolean;
  cursorColor: string;
}

export const DEFAULT_BROWSER_CURSOR = '#7D24EB';

export const DEFAULT_BROWSER_USE: BrowserUse = {
  openLinksWith: 'System Default',
  clearBrowsingData: true,
  cursorColor: DEFAULT_BROWSER_CURSOR,
};

const BROWSERS = [
  'System Default',
  'Google Chrome',
  'Microsoft Edge',
  'Mozilla Firefox',
  'Brave',
];

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-tt-hairline bg-tt-card p-5">{children}</section>
  );
}

function CardTitle({ icon: Icon, children }: { icon: typeof Globe; children: React.ReactNode }) {
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

export interface BrowserUseProps {
  value: BrowserUse;
  onPatch: (patch: Partial<BrowserUse>) => void;
}

/**
 * Browser Use settings (no search-engine card by design).
 * Session-only state lives in App; nothing is persisted anywhere.
 */
export function BrowserUseTab({ value, onPatch }: BrowserUseProps) {
  return (
    <div className="mx-auto w-full max-w-[680px] space-y-4 px-6 py-6">
      <div>
        <h1 className="font-display text-[22px] font-extrabold tracking-tight text-tt-ink">
          Browser Use
        </h1>
        <p className="mt-1 text-[13px] text-tt-ink-2">
          Choose browsers, AI browsing behavior and search.
        </p>
      </div>

      {/* links */}
      <Card>
        <CardTitle icon={Globe}>Links</CardTitle>
        <CardText>Which browser opens links from the app.</CardText>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[13.5px] font-bold text-tt-ink">Open links with</p>
            <p className="mt-0.5 truncate text-[12.5px] text-tt-ink-2">{value.openLinksWith}</p>
          </div>
          <div className="relative shrink-0">
            <select
              value={value.openLinksWith}
              onChange={(e) => onPatch({ openLinksWith: e.target.value })}
              aria-label="Open links with"
              className="cursor-pointer appearance-none rounded-lg border border-tt-hairline bg-white py-2 pr-9 pl-3.5 text-[13px] font-medium text-tt-ink outline-none transition-colors hover:border-tt-signal/50"
            >
              {BROWSERS.map((b) => (
                <option key={b} value={b}>
                  {b}
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

      {/* ai browsing */}
      <Card>
        <CardTitle icon={Bot}>AI browsing</CardTitle>
        <CardText>How the AI browser tool operates. Stored only for now.</CardText>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[13.5px] font-bold text-tt-ink">Clear browsing data on exit</p>
            <p className="mt-0.5 text-[12.5px] text-tt-ink-2">
              Delete AI session cookies and cache when the task finishes.
            </p>
          </div>
          <Toggle
            checked={value.clearBrowsingData}
            onChange={(v) => onPatch({ clearBrowsingData: v })}
            label="Clear browsing data on exit"
          />
        </div>
      </Card>

      {/* cursor */}
      <Card>
        <CardTitle icon={MousePointer2}>Cursor</CardTitle>
        <CardText>Color of the automation cursor shown while the AI browses.</CardText>
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
            <p className="text-[13.5px] font-bold text-tt-ink">Cursor color</p>
            <p className="mt-0.5 text-[12.5px] text-tt-ink-2">
              Used for the on-screen automation cursor.
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => onPatch({ cursorColor: DEFAULT_BROWSER_CURSOR })}
                disabled={value.cursorColor.toLowerCase() === DEFAULT_BROWSER_CURSOR.toLowerCase()}
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
