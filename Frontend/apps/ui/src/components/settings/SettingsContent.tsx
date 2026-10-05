import type { SettingsTab } from './SettingsNav';
import { GeneralTab, type GeneralSettings } from './GeneralTab';
import { AppearanceTab, type AppearanceState } from './AppearanceTab';
import { PersonalizationTab, type Personalization } from './PersonalizationTab';
import { ComputerUseTab, type ComputerUse } from './ComputerUseTab';
import { BrowserUseTab, type BrowserUse } from './BrowserUseTab';
import { ProvidersTab, type ProvidersState } from './ProvidersTab';

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
  general,
  appearance,
  personalization,
  computerUse,
  browserUse,
  providers,
}: {
  tab: SettingsTab;
  general: {
    value: GeneralSettings;
    onPatch: (patch: Partial<GeneralSettings>) => void;
  };
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
  providers: {
    value: ProvidersState;
    onChange: (state: ProvidersState) => void;
  };
}) {
  if (tab === 'general') {
    return (
      <div className="tt-scroll h-full overflow-y-auto">
        <GeneralTab value={general.value} onPatch={general.onPatch} />
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
  if (tab === 'providers') {
    return (
      <div className="tt-scroll h-full overflow-y-auto">
        <ProvidersTab value={providers.value} onChange={providers.onChange} />
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
