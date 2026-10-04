import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import type { TontooMessage } from '@/types';
import { createTransport } from '@/lib/transport';
import {
  DEFAULT_PROJECT_ID,
  PROJECTS,
  deleteConversation,
  listConversations,
  loadConversation,
  saveConversation,
  summarize,
  type ConversationMeta,
} from '@/lib/store';
import { Sidebar, PAGE_STEP, PAGE_SIZE } from '@/components/Sidebar';
import { SettingsNav, type SettingsTab } from '@/components/settings/SettingsNav';
import { SettingsContent } from '@/components/settings/SettingsContent';
import {
  DEFAULT_PRESET_ID,
  PRESETS,
  type ColorOverrides,
  type DesignMode,
} from '@/components/settings/AppearanceTab';
import {
  DEFAULT_PERSONALIZATION,
  type Personalization,
} from '@/components/settings/PersonalizationTab';
import {
  DEFAULT_COMPUTER_USE,
  type ComputerUse,
} from '@/components/settings/ComputerUseTab';
import {
  DEFAULT_BROWSER_USE,
  type BrowserUse,
} from '@/components/settings/BrowserUseTab';
import type { NewProject } from '@/components/AddProjectDialog';
import { TitleBar } from '@/components/TitleBar';
import { DEFAULT_MODEL } from '@/components/ModelMenu';
import { Conversation } from '@/components/Conversation';
import { Composer } from '@/components/Composer';

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `chat-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

interface WorkspaceProps {
  conversationId: string;
  initialMessages: TontooMessage[];
  onPersist: (id: string, messages: TontooMessage[]) => void;
  model: string;
  onModelChange: (id: string) => void;
  draftProject: string;
  onDraftProjectChange: (id: string) => void;
  onAddProject: (project: NewProject) => void;
  projects: { id: string; name: string }[];
}

/**
 * Owns exactly one `useChat` session. Remounted per conversation (keyed by
 * the parent), so switching chats swaps the whole session cleanly.
 */
function Workspace({
  conversationId,
  initialMessages,
  onPersist,
  model,
  onModelChange,
  draftProject,
  onDraftProjectChange,
  onAddProject,
  projects,
}: WorkspaceProps) {
  const transport = useMemo(() => createTransport(), []);
  const { messages, status, error, sendMessage, stop, regenerate } = useChat<TontooMessage>({
    id: conversationId,
    messages: initialMessages,
    transport,
    onFinish: ({ messages: finished }) => onPersist(conversationId, finished),
  });

  const send = useCallback(
    (text: string) => {
      void sendMessage({ text });
    },
    [sendMessage],
  );

  return (
    <div className="flex min-w-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          <Conversation
            messages={messages}
            status={status}
            projects={projects}
            draftProject={draftProject}
            onDraftProjectChange={onDraftProjectChange}
            onAddProject={onAddProject}
          />
        </div>

        {error && (
          <div className="px-6 pb-2">
            <div className="mx-auto flex max-w-[720px] items-center gap-3 rounded-lg border border-tt-err/40 bg-tt-err-soft px-3.5 py-2.5 text-[13px] text-tt-err">
              <span className="min-w-0 flex-1 truncate">{error.message}</span>
              <button
                type="button"
                onClick={() => void regenerate()}
                className="font-mono2 shrink-0 rounded-md bg-tt-err px-2 py-1 text-[11px] font-semibold text-white"
              >
                retry
              </button>
            </div>
          </div>
        )}

        <Composer
          status={status}
          model={model}
          onModelChange={onModelChange}
          onSend={send}
          onStop={stop}
        />
      </div>
    </div>
  );
}

export default function App() {
  const [metas, setMetas] = useState<ConversationMeta[]>([]);
  const [activeId, setActiveId] = useState<string>(() => newId());
  const [initial, setInitial] = useState<TontooMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [view, setView] = useState<'chat' | 'settings'>('chat');
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('general');
  // Appearance — session only, never persisted. Default is Light.
  const [design, setDesign] = useState<DesignMode>('light');
  const [presetId, setPresetId] = useState(DEFAULT_PRESET_ID);
  const [colorOverrides, setColorOverrides] = useState<ColorOverrides>({});

  const setColorOverride = useCallback((key: keyof ColorOverrides, value: string | undefined) => {
    setColorOverrides((prev) => {
      if (value === undefined) {
        const { [key]: _drop, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: value };
    });
  }, []);

  const resetTheme = useCallback(() => {
    setPresetId(DEFAULT_PRESET_ID);
    setColorOverrides({});
  }, []);

  // Personalization — session only, never persisted.
  const [personalization, setPersonalization] = useState<Personalization>(DEFAULT_PERSONALIZATION);
  const patchPersonalization = useCallback((patch: Partial<Personalization>) => {
    setPersonalization((prev) => ({ ...prev, ...patch }));
  }, []);

  // Computer Use — session only, never persisted.
  const [computerUse, setComputerUse] = useState<ComputerUse>(DEFAULT_COMPUTER_USE);
  const patchComputerUse = useCallback((patch: Partial<ComputerUse>) => {
    setComputerUse((prev) => ({ ...prev, ...patch }));
  }, []);

  // Browser Use — session only, never persisted.
  const [browserUse, setBrowserUse] = useState<BrowserUse>(DEFAULT_BROWSER_USE);
  const patchBrowserUse = useCallback((patch: Partial<BrowserUse>) => {
    setBrowserUse((prev) => ({ ...prev, ...patch }));
  }, []);

  // Apply design + colors live to the document. RAM only.
  useEffect(() => {
    const root = document.documentElement;
    const apply = (dark: boolean) => {
      root.dataset.theme = dark ? 'dark' : 'light';
    };
    if (design !== 'system') {
      apply(design === 'dark');
      return;
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    apply(mq.matches);
    const fn = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, [design]);

  useEffect(() => {
    const style = document.documentElement.style;
    const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0]!;
    const accent = colorOverrides.accent ?? preset.accent;
    style.setProperty('--tt-signal', accent);
    style.setProperty('--tt-signal-soft', `color-mix(in srgb, ${accent} 15%, transparent)`);
    if (colorOverrides.background) style.setProperty('--tt-ground', colorOverrides.background);
    else style.removeProperty('--tt-ground');
    if (colorOverrides.foreground) style.setProperty('--tt-ink', colorOverrides.foreground);
    else style.removeProperty('--tt-ink');
  }, [presetId, colorOverrides]);
  // Projects start collapsed; per-project visible-chat limits for paging.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [limits, setLimits] = useState<Record<string, number>>({});
  // In-session projects (NOT persisted anywhere yet — gone on reload).
  const [customProjects, setCustomProjects] = useState<{ id: string; name: string }[]>([]);
  // Folder details, session-only as well.
  const [projectDetails, setProjectDetails] = useState<Record<string, NewProject>>({});
  void projectDetails;

  const allProjects = useMemo(
    () => [...PROJECTS, ...customProjects],
    [customProjects],
  );

  const addProject = useCallback((p: NewProject) => {
    const id = `custom-${Date.now()}`;
    setCustomProjects((prev) => [...prev, { id, name: p.name }]);
    setProjectDetails((prev) => ({ ...prev, [id]: p }));
    // New chats land in the fresh project and reveal it.
    lastProject.current = id;
    setDraftProject(id);
    setExpanded((prev) => new Set(prev).add(id));
  }, []);
  // Where the next chat lands: the project of the last opened chat.
  const lastProject = useRef(DEFAULT_PROJECT_ID);
  const newChatProject = useRef(DEFAULT_PROJECT_ID);
  // Reactive copy for the new-chat project picker.
  const [draftProject, setDraftProject] = useState(DEFAULT_PROJECT_ID);
  const draftProjectRef = useRef(draftProject);
  draftProjectRef.current = draftProject;

  // (The design/preset effects above own data-theme; nothing is persisted.)

  // Boot: list chats, open the most recent one (or a fresh chat).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listConversations();
        if (cancelled) return;
        setMetas(list);
        if (list.length > 0) {
          const latest = list[0]!;
          setActiveId(latest.id);
          const full = await loadConversation(latest.id);
          if (!cancelled) setInitial(full?.messages ?? []);
        }
      } catch {
        /* fresh start on storage failure */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Live lookup: which project a chat belongs to.
  const metasRef = useRef(metas);
  metasRef.current = metas;
  const projectOf = useCallback(
    (id: string) =>
      metasRef.current.find((m) => m.id === id)?.projectId ?? draftProjectRef.current,
    [],
  );

  const persist = useCallback(
    (id: string, messages: TontooMessage[]) => {
      const conv = summarize(id, messages, projectOf(id));
      void saveConversation(conv).then(() => {
        setMetas((prev) => {
          const { messages: _drop, ...meta } = conv;
          const rest = prev.filter((m) => m.id !== id);
          return [meta, ...rest];
        });
      });
    },
    [projectOf],
  );

  const handleNew = useCallback(() => {
    // New chats land in the project of the last opened chat and reveal it.
    newChatProject.current = lastProject.current;
    setDraftProject(lastProject.current);
    setExpanded((prev) => new Set(prev).add(lastProject.current));
    setActiveId(newId());
    setInitial([]);
  }, []);

  const toggleProject = useCallback((projectId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }, []);

  const showMore = useCallback((projectId: string) => {
    setLimits((prev) => ({
      ...prev,
      [projectId]: (prev[projectId] ?? PAGE_SIZE) + PAGE_STEP,
    }));
  }, []);

  // Ref mirror so the async select handler never sees a stale id.
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  const handleSelect = useCallback(
    async (id: string) => {
      if (id === activeIdRef.current) return;
      lastProject.current = projectOf(id);
      setLoading(true);
      try {
        const full = await loadConversation(id);
        setActiveId(id);
        setInitial(full?.messages ?? []);
      } finally {
        setLoading(false);
      }
    },
    [projectOf],
  );

  // Group chats per project for the sidebar (already sorted newest-first).
  const chatsByProject = useMemo(() => {
    const grouped: Record<string, ConversationMeta[]> = {};
    for (const p of allProjects) grouped[p.id] = [];
    for (const m of metas) {
      const pid = allProjects.some((p) => p.id === m.projectId) ? m.projectId : DEFAULT_PROJECT_ID;
      grouped[pid]!.push(m);
    }
    return grouped;
  }, [metas, allProjects]);

  // Projects sorted by latest activity; untouched projects sink to the end.
  const sortedProjects = useMemo(() => {
    const latestActivity = (pid: string): number => {
      const chats = chatsByProject[pid] ?? [];
      return chats.length > 0 ? Math.max(...chats.map((c) => c.updatedAt)) : -1;
    };
    return [...allProjects].sort((a, b) => {
      const ta = latestActivity(a.id);
      const tb = latestActivity(b.id);
      if (ta === -1 && tb === -1) return allProjects.indexOf(a) - allProjects.indexOf(b);
      if (ta === -1) return 1;
      if (tb === -1) return -1;
      return tb - ta;
    });
  }, [chatsByProject, allProjects]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="font-mono2 tt-caret text-[12px] text-tt-ink-3">loading workspace</p>
      </div>
    );
  }

return (
    <div className="flex h-full">
      {/* Left rail swaps between chat projects and settings nav. */}
      {view === 'chat' ? (
        <Sidebar
          projects={sortedProjects}
          chatsByProject={chatsByProject}
          activeId={activeId}
          expandedIds={expanded}
          onToggleProject={toggleProject}
          limits={limits}
          onShowMore={showMore}
          onSelect={(id) => void handleSelect(id)}
          onNew={handleNew}
          onDelete={(id) => {
            void deleteConversation(id).then(() => {
              setMetas((prev) => prev.filter((m) => m.id !== id));
              if (id === activeId) handleNew();
            });
          }}
          onOpenSettings={() => setView('settings')}
        />
      ) : (
        <SettingsNav
          active={settingsTab}
          onTab={setSettingsTab}
          onBack={() => setView('chat')}
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Custom decoration strip above the main content. */}
        <TitleBar
          recent={metas}
          activeId={activeId}
          onSelect={(id) => void handleSelect(id)}
        />
        <div className="flex min-h-0 flex-1">
          {view === 'chat' ? (
            <Workspace
              key={activeId}
              conversationId={activeId}
              initialMessages={initial}
              onPersist={persist}
              model={model}
              onModelChange={setModel}
              draftProject={draftProject}
              onDraftProjectChange={setDraftProject}
              onAddProject={addProject}
              projects={allProjects}
            />
          ) : (
            <div className="min-w-0 flex-1">
              <SettingsContent
                tab={settingsTab}
                appearance={{
                  design,
                  onDesign: setDesign,
                  presetId,
                  onPreset: setPresetId,
                  overrides: colorOverrides,
                  onOverride: setColorOverride,
                  onResetTheme: resetTheme,
                }}
                personalization={{
                  value: personalization,
                  onPatch: patchPersonalization,
                }}
                computerUse={{
                  value: computerUse,
                  onPatch: patchComputerUse,
                }}
                browserUse={{
                  value: browserUse,
                  onPatch: patchBrowserUse,
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
