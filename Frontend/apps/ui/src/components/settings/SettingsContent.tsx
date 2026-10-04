import type { SettingsTab } from './SettingsNav';
import { GeneralTab } from './GeneralTab';
import { AppearanceTab, type AppearanceState } from './AppearanceTab';
import { PersonalizationTab, type Personalization } from './PersonalizationTab';
import { ComputerUseTab, type ComputerUse } from './ComputerUseTab';
import { BrowserUseTab, type BrowserUse } from './BrowserUseTab';

const TAB_LABELS: Record<SettingsTab, string> = {
  general: 'General',
  providers: 'Providers',
  profile: 'Profile',
  appearance: 'Appearance',
  voice: 'Voice',
  personalization: 'Personalization',
  'computer-use': 'Computer Use',
  browser: 'Browser',
  plugins: 'Plugins',
  mcp: 'MCP',
  lsp: 'LSP',
};

/** Right-hand settings content. */
export function SettingsContent({
  tab,
  appearance,
  personalization,
  computerUse,
  browserUse,
}: {
  tab: SettingsTab;
  appearance: AppearanceState;
  personalization: {
    value: Personalization;
    onPatch: (patch: Partial<Personalization>) => void;
  };
  computerUse: {
    value: ComputerUse;
    onPatch: (patch: Partial<ComputerUse>) => void;
  };
  browserUse: {
    value: BrowserUse;
    onPatch: (patch: Partial<BrowserUse>) => void;
  };
}) {
  if (tab === 'general') {
    return (
      <div className="tt-scroll h-full overflow-y-auto">
        <GeneralTab />
      </div>
    );
  }
  if (tab === 'appearance') {
    return (
      <div className="tt-scroll h-full overflow-y-auto">
        <AppearanceTab {...appearance} />
      </div>
    );
  }
  if (tab === 'personalization') {
    return (
      <div className="tt-scroll h-full overflow-y-auto">
        <PersonalizationTab value={personalization.value} onPatch={personalization.onPatch} />
      </div>
    );
  }
  if (tab === 'computer-use') {
    return (
      <div className="tt-scroll h-full overflow-y-auto">
        <ComputerUseTab value={computerUse.value} onPatch={computerUse.onPatch} />
      </div>
    );
  }
  if (tab === 'browser') {
    return (
      <div className="tt-scroll h-full overflow-y-auto">
        <BrowserUseTab value={browserUse.value} onPatch={browserUse.onPatch} />
      </div>
    );
  }
  return (
    <div className="flex h-full items-center justify-center px-6">
      <p className="font-mono2 max-w-sm text-center text-[12px] leading-relaxed text-tt-ink-3">
        {TAB_LABELS[tab]} settings are not part of this build yet.
      </p>
    </div>
  );
}
