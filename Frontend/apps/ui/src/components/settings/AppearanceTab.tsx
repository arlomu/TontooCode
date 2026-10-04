import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DesignMode = 'system' | 'light' | 'dark';

export interface ThemePreset {
  id: string;
  name: string;
  accent: string;
}

export const PRESETS: ThemePreset[] = [
  { id: 'tontoo-light', name: 'Tontoo Light', accent: '#2547DC' },
  { id: 'tontoo-dark', name: 'Tontoo Dark', accent: '#647DFF' },
  { id: 'ocean', name: 'Ocean', accent: '#0284C7' },
  { id: 'forest', name: 'Forest', accent: '#15803D' },
  { id: 'sunset', name: 'Sunset', accent: '#EA580C' },
  { id: 'lavender', name: 'Lavender', accent: '#7C3AED' },
  { id: 'crimson', name: 'Crimson', accent: '#DC2626' },
  { id: 'teal', name: 'Teal', accent: '#0D9488' },
  { id: 'amber', name: 'Amber', accent: '#D97706' },
  { id: 'slate', name: 'Slate', accent: '#475569' },
  { id: 'rose', name: 'Rose', accent: '#E11D48' },
  { id: 'mint', name: 'Mint', accent: '#059669' },
];

export const DEFAULT_PRESET_ID = 'tontoo-light';

export interface ColorOverrides {
  accent?: string;
  background?: string;
  foreground?: string;
}

/** Live dark state for a design choice (follows the OS on 'system'). */
export function useEffectiveDark(design: DesignMode): boolean {
  const [dark, setDark] = useState<boolean>(() =>
    design === 'dark'
      ? true
      : design === 'light'
        ? false
        : window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  useEffect(() => {
    if (design !== 'system') {
      setDark(design === 'dark');
      return;
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setDark(mq.matches);
    const fn = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, [design]);
  return dark;
}

/* ---------- design tile mockups ---------- */

function LightMock() {
  return (
    <div className="flex h-full bg-white">
      <div className="w-[34%] bg-[#eceef1]" />
      <div className="flex-1 space-y-1.5 p-2">
        <div className="h-[5px] w-4/5 rounded-full bg-[#dde1e7]" />
        <div className="h-[5px] w-3/5 rounded-full bg-[#dde1e7]" />
        <div className="h-[5px] w-4/6 rounded-full bg-[#dde1e7]" />
      </div>
    </div>
  );
}

function DarkMock() {
  return (
    <div className="flex h-full bg-[#14171d]">
      <div className="w-[34%] bg-[#0f1319]" />
      <div className="flex-1 space-y-1.5 p-2">
        <div className="h-[5px] w-4/5 rounded-full bg-[#28303c]" />
        <div className="h-[5px] w-3/5 rounded-full bg-[#28303c]" />
        <div className="h-[5px] w-4/6 rounded-full bg-[#28303c]" />
      </div>
    </div>
  );
}

function Tile({
  mode,
  label,
  selected,
  onClick,
}: {
  mode: DesignMode;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'rounded-xl border bg-tt-card p-2.5 text-center transition-all',
        selected
          ? 'border-transparent ring-2 ring-[var(--tt-signal)]'
          : 'border-tt-hairline hover:border-tt-ink-3',
      )}
    >
      <div className="flex h-[86px] overflow-hidden rounded-md">
        {mode === 'system' ? (
          <>
            <div className="w-1/2">
              <LightMock />
            </div>
            <div className="w-1/2">
              <DarkMock />
            </div>
          </>
        ) : mode === 'light' ? (
          <div className="w-full">
            <LightMock />
          </div>
        ) : (
          <div className="w-full">
            <DarkMock />
          </div>
        )}
      </div>
      <p
        className={cn(
          'mt-2 text-[12.5px]',
          selected ? 'font-semibold text-tt-signal' : 'text-tt-ink-2',
        )}
      >
        {label}
      </p>
    </button>
  );
}

/* ---------- code preview ---------- */

function CodePreview({ accent, surface }: { accent: string; surface: string }) {
  const lines: React.ReactNode[][] = [
    [
      <span key="k" className="text-[#7C3AED]">const</span>,
      ' themePreview ',
      <span key="c" className="text-tt-ink-3">:</span>,
      ' ',
      <span key="t" className="text-[#0D9488]">ThemeConfig</span>,
      ' ',
      <span key="e" className="text-tt-ink-3">=</span>,
      ' ',
      <span key="b" className="text-tt-ink-2">{'{'}</span>,
    ],
    [
      '  ',
      <span key="k" className="text-[#15803D]">surface</span>,
      ' ',
      <span key="c" className="text-tt-ink-3">:</span>,
      ' ',
      <span key="s" className="text-[#15803D]">"{surface}"</span>,
      <span key="p" className="text-tt-ink-3"> ,</span>,
    ],
    [
      '  ',
      <span key="k" className="text-[#15803D]">accent</span>,
      ' ',
      <span key="c" className="text-tt-ink-3">:</span>,
      ' ',
      <span key="s" className="text-[#15803D]">"{accent}"</span>,
      <span key="p" className="text-tt-ink-3"> ,</span>,
    ],
    [
      '  ',
      <span key="k" className="text-[#15803D]">contrast</span>,
      ' ',
      <span key="c" className="text-tt-ink-3">:</span>,
      ' ',
      <span key="n" className="text-[#EA580C]">42</span>,
      <span key="p" className="text-tt-ink-3"> ,</span>,
    ],
    [<span key="b" className="text-tt-ink-2">{'};'}</span>],
  ];
  return (
    <div className="overflow-hidden rounded-xl border border-tt-hairline bg-tt-card">
      <div className="flex items-center gap-1.5 border-b border-tt-hairline px-3.5 py-2.5">
        <span aria-hidden className="size-2.5 rounded-full bg-[#FF5F57]" />
        <span aria-hidden className="size-2.5 rounded-full bg-[#FEBC2E]" />
        <span aria-hidden className="size-2.5 rounded-full bg-[#28C840]" />
        <span className="font-mono2 ml-1.5 text-[11.5px] text-tt-ink-3">themePreview.ts</span>
      </div>
      <div className="font-mono2 overflow-x-auto px-0 py-2.5 text-[12.5px] leading-[1.7]">
        {lines.map((parts, i) => (
          <div key={i} className="flex whitespace-pre">
            <span className="w-9 shrink-0 pr-3 text-right text-tt-ink-3/70 select-none">{i + 1}</span>
            <span className="pr-4 text-tt-ink">{parts}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- color row ---------- */

function ColorRow({
  label,
  value,
  isDefault,
  onPick,
  onResetDefault,
}: {
  label: string;
  value: string;
  isDefault: boolean;
  onPick: (hex: string) => void;
  onResetDefault: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg bg-tt-panel/60 px-3.5 py-2.5">
      <span className="text-[13.5px] font-medium text-tt-ink">{label}</span>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onResetDefault}
          disabled={isDefault}
          title="Reset to theme default"
          className="font-mono2 rounded-full border border-tt-hairline bg-tt-card px-2 py-0.5 text-[10px] tracking-wide text-tt-ink-3 uppercase transition-all hover:border-tt-signal/50 hover:text-tt-signal disabled:cursor-default disabled:opacity-50"
        >
          Default
        </button>
        <label
          title={`Custom ${label.toLowerCase()}`}
          className="flex cursor-pointer items-center gap-1.5 rounded-md border border-tt-hairline bg-tt-card px-2 py-1 transition-colors hover:border-tt-signal/50"
        >
          <input
            type="color"
            className="sr-only"
            value={value}
            onChange={(e) => onPick(e.target.value)}
            aria-label={`Custom ${label.toLowerCase()}`}
          />
          <span
            aria-hidden
            className="size-3.5 rounded-full border border-black/10"
            style={{ background: value }}
          />
          <span className="font-mono2 text-[11.5px] text-tt-ink">{value.toUpperCase()}</span>
        </label>
      </div>
    </div>
  );
}

/* ---------- tab ---------- */

export interface AppearanceState {
  design: DesignMode;
  onDesign: (d: DesignMode) => void;
  presetId: string;
  onPreset: (id: string) => void;
  overrides: ColorOverrides;
  onOverride: (key: keyof ColorOverrides, value: string | undefined) => void;
  onResetTheme: () => void;
}

/**
 * Appearance settings. Everything applies live to the app but lives only in
 * RAM — reload and it is all back to Light defaults. Nothing is persisted.
 */
export function AppearanceTab({
  design,
  onDesign,
  presetId,
  onPreset,
  overrides,
  onOverride,
  onResetTheme,
}: AppearanceState) {
  const dark = useEffectiveDark(design);
  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0]!;

  const accent = overrides.accent ?? preset.accent;
  const background = overrides.background ?? (dark ? '#14171D' : '#FFFFFF');
  const foreground = overrides.foreground ?? (dark ? '#E9EBF0' : '#14181D');

  return (
    <div className="mx-auto w-full max-w-[680px] space-y-4 px-6 py-6">
      <div>
        <h1 className="font-display text-[22px] font-extrabold tracking-tight text-tt-ink">
          Appearance
        </h1>
        <p className="mt-1 text-[13px] text-tt-ink-2">Choose your theme, code style and colors.</p>
      </div>

      {/* design */}
      <section className="rounded-xl border border-tt-hairline bg-tt-card p-4">
        <div className="flex items-center justify-between px-1 pb-3">
          <h2 className="text-[14px] font-bold text-tt-ink">Design</h2>
          <span className="font-mono2 rounded-full bg-tt-panel px-2.5 py-1 text-[10.5px] tracking-[0.1em] text-tt-ink-2 uppercase">
            {dark ? 'Dark' : 'Light'}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Tile mode="system" label="System" selected={design === 'system'} onClick={() => onDesign('system')} />
          <Tile mode="light" label="Light" selected={design === 'light'} onClick={() => onDesign('light')} />
          <Tile mode="dark" label="Dark" selected={design === 'dark'} onClick={() => onDesign('dark')} />
        </div>
      </section>

      <CodePreview accent={accent.toUpperCase()} surface={dark ? 'sidebar-dark' : 'sidebar'} />

      {/* theme */}
      <section className="rounded-xl border border-tt-hairline bg-tt-card p-4">
        <div className="flex items-center justify-between gap-3 px-1 pb-3">
          <h2 className="text-[14px] font-bold text-tt-ink">Theme</h2>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onResetTheme}
              className="rounded-lg border border-tt-hairline bg-tt-card px-3 py-1.5 text-[12.5px] font-medium text-tt-ink transition-colors hover:border-tt-signal/50 hover:text-tt-signal"
            >
              Reset
            </button>
            <div className="relative">
              <select
                value={preset.id}
                onChange={(e) => onPreset(e.target.value)}
                aria-label="Theme preset"
                className="cursor-pointer appearance-none rounded-lg border border-tt-hairline bg-tt-card py-1.5 pr-9 pl-3.5 text-[13px] font-medium text-tt-ink outline-none transition-colors hover:border-tt-signal/50"
              >
                {PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-tt-ink-3"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <ColorRow
            label="Accent"
            value={accent}
            isDefault={!overrides.accent}
            onPick={(hex) => onOverride('accent', hex)}
            onResetDefault={() => onOverride('accent', undefined)}
          />
          <ColorRow
            label="Background"
            value={background}
            isDefault={!overrides.background}
            onPick={(hex) => onOverride('background', hex)}
            onResetDefault={() => onOverride('background', undefined)}
          />
          <ColorRow
            label="Foreground"
            value={foreground}
            isDefault={!overrides.foreground}
            onPick={(hex) => onOverride('foreground', hex)}
            onResetDefault={() => onOverride('foreground', undefined)}
          />
        </div>
      </section>
    </div>
  );
}
