import {
  AppWindow,
  ArrowLeft,
  Contrast,
  Mic,
  Monitor,
  Package,
  Plug,
  SlidersHorizontal,
  Sparkles,
  SquarePlus,
  User,
  CodeXml,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type SettingsTab =
  | 'general'
  | 'providers'
  | 'profile'
  | 'appearance'
  | 'voice'
  | 'personalization'
  | 'computer-use'
  | 'browser'
  | 'plugins'
  | 'mcp'
  | 'lsp';

interface NavItem {
  id: SettingsTab;
  label: string;
  icon: LucideIcon;
}

const PERSONAL: NavItem[] = [
  { id: 'general', label: 'General', icon: SlidersHorizontal },
  { id: 'providers', label: 'Providers', icon: SquarePlus },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Contrast },
  { id: 'voice', label: 'Voice', icon: Mic },
  { id: 'personalization', label: 'Personalization', icon: Sparkles },
];

const CONTROL: NavItem[] = [
  { id: 'computer-use', label: 'Computer Use', icon: Monitor },
  { id: 'browser', label: 'Browser Use', icon: AppWindow },
  { id: 'plugins', label: 'Plugins', icon: Plug },
  { id: 'mcp', label: 'MCP', icon: Package },
  { id: 'lsp', label: 'LSP', icon: CodeXml },
];

interface SettingsNavProps {
  active: SettingsTab;
  onTab: (tab: SettingsTab) => void;
  onBack: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-mono2 px-4 pt-4 pb-1.5 text-[10px] font-semibold tracking-[0.16em] text-tt-ink-3 uppercase">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Item({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'mx-3 flex w-[calc(100%-24px)] items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors',
        active
          ? 'bg-white font-medium text-tt-ink shadow-[0_1px_2px_rgb(15_23_42/0.06)]'
          : 'text-tt-ink-2 hover:bg-white/60',
      )}
    >
      <Icon
        size={15}
        strokeWidth={1.9}
        className={cn('shrink-0', active ? 'text-tt-signal' : 'text-tt-ink-3')}
      />
      <span className="truncate text-[13.5px]">{item.label}</span>
    </button>
  );
}

export function SettingsNav({ active, onTab, onBack }: SettingsNavProps) {
  return (
    <aside className="flex h-full w-[268px] shrink-0 flex-col border-r border-tt-hairline bg-tt-panel">
      {/* wordmark — also the window drag handle for the top-left corner */}
      <div className="tt-drag px-4 pt-3 pb-3.5">
        <div className="flex items-baseline gap-[7px]">
          <span className="font-display text-[19px] leading-none font-extrabold tracking-tight text-tt-ink">
            Tontoo
          </span>
          <span className="font-mono2 text-[11.5px] leading-none font-semibold tracking-[0.16em] text-tt-signal">
            CODE
          </span>
        </div>
      </div>

      <div className="px-3">
        <button
          type="button"
          onClick={onBack}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13.5px] text-tt-ink-2 transition-colors hover:bg-white/60 hover:text-tt-ink"
        >
          <ArrowLeft size={15} strokeWidth={2} />
          Back
        </button>
      </div>

      <nav className="tt-scroll min-h-0 flex-1 overflow-y-auto pb-3" aria-label="Settings">
        <Section title="Personal">
          {PERSONAL.map((item) => (
            <Item key={item.id} item={item} active={active === item.id} onClick={() => onTab(item.id)} />
          ))}
        </Section>
        <Section title="Control">
          {CONTROL.map((item) => (
            <Item key={item.id} item={item} active={active === item.id} onClick={() => onTab(item.id)} />
          ))}
        </Section>
      </nav>
    </aside>
  );
}
