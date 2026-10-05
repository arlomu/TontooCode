import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import type { TontooMessage } from '@/types';
import { backend } from '@/lib/backend';
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
import { defaultGeneral, type GeneralSettings } from '@/components/settings/GeneralTab';
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
import type { ProvidersState } from '@/components/settings/ProvidersTab';
import type { NewProject } from '@/components/AddProjectDialog';
import { TitleBar } from '@/components/TitleBar';
import { DEFAULT_MODEL } from '@/components/ModelMenu';
import { DEFAULT_LEVEL, LEVELS, type ThinkingLevel } from '@/components/ThinkingLevelMenu';
import { Conversation } from '@/components/Conversation';
import { Composer } from '@/components/Composer';

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `chat-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

/**
 * Readable text color on top of an accent background (WCAG relative
 * luminance). Keeps icons legible on very light custom accents.
 */
function onSignalColor(accent: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(accent.trim());
  if (!m?.[1]) return '#ffffff';
  const n = parseInt(m[1], 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const luminance =
    0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return luminance > 0.4 ? '#14181d' : '#ffffff';
}

interface WorkspaceProps {
  conversationId: string;
  initialMessages: TontooMessage[];
  onPersist: (id: string, messages: TontooMessage[]) => void;
  model: string;
  onModelChange: (id: string) => void;
  level: ThinkingLevel;
  onLevelChange: (level: ThinkingLevel) => void;
  draftProject: string;
  onDraftProjectChange: (id: string) => void;
  onAddProject: (project: NewProject) => void;
  projects: { id: string; name: string; mainFolder?: string }[];
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
  level,
  onLevelChange,
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
          level={level}
          onLevelChange={onLevelChange}
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
  const [level, setLevel] = useState<ThinkingLevel>(DEFAULT_LEVEL);
  const [view, setView] = useState<'chat' | 'settings'>('chat');
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('general');
  // Appearance — persisted to the backend DB when reachable.
  const [design, setDesign] = useState<DesignMode>('light');
  const [presetId, setPresetId] = useState(DEFAULT_PRESET_ID);
  const [colorOverrides, setColorOverrides] = useState<ColorOverrides>({});
  const colorOverridesRef = useRef<ColorOverrides>({});
  colorOverridesRef.current = colorOverrides;

  // Debounced write-through to settings.db (silent when offline).
  const pendingSettings = useRef<Record<string, unknown>>({});
  const persistTimer = useRef<number | null>(null);
  const persistSettings = useCallback((patch: Record<string, unknown>) => {
    Object.assign(pendingSettings.current, patch);
    if (persistTimer.current !== null) window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      const body = pendingSettings.current;
      pendingSettings.current = {};
      persistTimer.current = null;
      void backend.putSettings(body).catch(() => {});
    }, 400);
  }, []);

  const handleDesign = useCallback(
    (d: DesignMode) => {
      setDesign(d);
      persistSettings({ 'appearance.design': d });
    },
    [persistSettings],
  );

  const handlePreset = useCallback(
    (id: string) => {
      setPresetId(id);
      persistSettings({ 'appearance.preset': id });
    },
    [persistSettings],
  );

  const handleColorOverride = useCallback(
    (key: keyof ColorOverrides, value: string | undefined) => {
      const next = { ...colorOverridesRef.current };
      if (value === undefined) delete next[key];
      else next[key] = value;
      colorOverridesRef.current = next;
      setColorOverrides(next);
      persistSettings({ 'appearance.overrides': next });
    },
    [persistSettings],
  );

  const resetTheme = useCallback(() => {
    setPresetId(DEFAULT_PRESET_ID);
    setColorOverrides({});
    colorOverridesRef.current = {};
    persistSettings({ 'appearance.preset': DEFAULT_PRESET_ID, 'appearance.overrides': {} });
  }, [persistSettings]);

  const handleModelChange = useCallback(
    (id: string) => {
      setModel(id);
      persistSettings({ 'chat.model': id });
    },
    [persistSettings],
  );

  const handleLevelChange = useCallback(
    (next: ThinkingLevel) => {
      setLevel(next);
      persistSettings({ 'chat.thinking_level': next });
    },
    [persistSettings],
  );

  // General — persisted to the backend DB when reachable.
  const [general, setGeneral] = useState<GeneralSettings>(() => defaultGeneral());
  const patchGeneral = useCallback(
    (patch: Partial<GeneralSettings>) => {
      setGeneral((prev) => ({ ...prev, ...patch }));
      persistSettings({
        ...(patch.folder !== undefined ? { 'general.folder': patch.folder } : {}),
        ...(patch.shell !== undefined ? { 'general.shell': patch.shell } : {}),
        ...(patch.notify !== undefined ? { 'general.notify': patch.notify } : {}),
        ...(patch.sound !== undefined ? { 'general.sound': patch.sound } : {}),
      });
    },
    [persistSettings],
  );

  // Personalization — persisted to the backend DB when reachable.
  const [personalization, setPersonalization] = useState<Personalization>(DEFAULT_PERSONALIZATION);
  const patchPersonalization = useCallback(
    (patch: Partial<Personalization>) => {
      setPersonalization((prev) => ({ ...prev, ...patch }));
      persistSettings({
        ...(patch.name !== undefined ? { 'personalization.name': patch.name } : {}),
        ...(patch.hobbies !== undefined ? { 'personalization.hobbies': patch.hobbies } : {}),
        ...(patch.about !== undefined ? { 'personalization.about': patch.about } : {}),
        ...(patch.emojis !== undefined ? { 'personalization.emojis': patch.emojis } : {}),
        ...(patch.structure !== undefined ? { 'personalization.structure': patch.structure } : {}),
        ...(patch.detail !== undefined ? { 'personalization.detail': patch.detail } : {}),
        ...(patch.tone !== undefined ? { 'personalization.tone': patch.tone } : {}),
      });
    },
    [persistSettings],
  );

  // Computer Use — persisted to the backend DB when reachable.
  const [computerUse, setComputerUse] = useState<ComputerUse>(DEFAULT_COMPUTER_USE);
  const patchComputerUse = useCallback(
    (patch: Partial<ComputerUse>) => {
      setComputerUse((prev) => ({ ...prev, ...patch }));
      persistSettings({
        ...(patch.enabled !== undefined ? { 'computer_use.enabled': patch.enabled } : {}),
        ...(patch.selectionMode !== undefined
          ? { 'computer_use.selection_mode': patch.selectionMode }
          : {}),
        ...(patch.selectedApps !== undefined
          ? { 'computer_use.selected_apps': patch.selectedApps }
          : {}),
        ...(patch.cursorColor !== undefined
          ? { 'computer_use.cursor_color': patch.cursorColor }
          : {}),
      });
    },
    [persistSettings],
  );

  // Browser Use — persisted to the backend DB when reachable.
  const [browserUse, setBrowserUse] = useState<BrowserUse>(DEFAULT_BROWSER_USE);
  const patchBrowserUse = useCallback(
    (patch: Partial<BrowserUse>) => {
      setBrowserUse((prev) => ({ ...prev, ...patch }));
      persistSettings({
        ...(patch.openLinksWith !== undefined
          ? { 'browser_use.open_links_with': patch.openLinksWith }
          : {}),
        ...(patch.clearBrowsingData !== undefined
          ? { 'browser_use.clear_browsing_data': patch.clearBrowsingData }
          : {}),
        ...(patch.cursorColor !== undefined
          ? { 'browser_use.cursor_color': patch.cursorColor }
          : {}),
      });
    },
    [persistSettings],
  );

  // Providers — backend-backed list with session fallback while offline.
  const [providers, setProviders] = useState<ProvidersState>({ providers: [], online: true });

  // Apply design + colors live to the document. RAM only.
  useEffect(() => {
    const root = document.documentElement;
    const apply = (dark: boolean) => {
      root.dataset.theme = dark ? 'dark' : 'light';
      // Keep the native caption-button strip in sync with the theme.
      void window.tontoo?.setTitleOverlay?.(
        dark
          ? { color: '#0f1319', symbolColor: '#a6aebb' }
          : { color: '#eceef1', symbolColor: '#55606d' },
      );
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
    style.setProperty('--tt-signal-ink', onSignalColor(accent));
    if (colorOverrides.background) style.setProperty('--tt-ground', colorOverrides.background);
    else style.removeProperty('--tt-ground');
    if (colorOverrides.foreground) style.setProperty('--tt-ink', colorOverrides.foreground);
    else style.removeProperty('--tt-ink');
  }, [presetId, colorOverrides]);
  // Projects start collapsed; per-project visible-chat limits for paging.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [limits, setLimits] = useState<Record<string, number>>({});
  // Where the next chat lands: the project of the last opened chat.
  const lastProject = useRef(DEFAULT_PROJECT_ID);
  const newChatProject = useRef(DEFAULT_PROJECT_ID);
  // Reactive copy for the new-chat project picker.
  const [draftProject, setDraftProject] = useState(DEFAULT_PROJECT_ID);
  const draftProjectRef = useRef(draftProject);
  draftProjectRef.current = draftProject;
  // Backend-backed projects with local fallback while offline.
  const [allProjects, setAllProjects] = useState<
    { id: string; name: string; mainFolder?: string; subfolders?: string[] }[]
  >(() => PROJECTS.map((p) => ({ ...p })));
  const [projectsOnline, setProjectsOnline] = useState(true);
  void projectsOnline;

  /** Projects enriched with their main folder for the picker. */
  const projectsWithFolders = useMemo(() => allProjects, [allProjects]);

  const addProject = useCallback((p: NewProject) => {
    const applyNewProject = (id: string, name: string, mainFolder?: string, subfolders?: string[]) => {
      setAllProjects((prev) =>
        prev.some((x) => x.id === id) ? prev : [...prev, { id, name, mainFolder, subfolders }],
      );
      // New chats land in the fresh project and reveal it.
      lastProject.current = id;
      setDraftProject(id);
      setExpanded((prev) => new Set(prev).add(id));
    };
    void backend
      .createProject(p.name, p.mainFolder, p.subfolders)
      .then((created) => {
        setProjectsOnline(true);
        applyNewProject(
          created.id,
          created.name,
          created.main_folder || undefined,
          created.subfolders,
        );
      })
      .catch(() => {
        setProjectsOnline(false);
        applyNewProject(
          `custom-${Date.now()}`,
          p.name,
          p.mainFolder || undefined,
          p.subfolders,
        );
      });
  }, []);

  const renameProject = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setAllProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name: trimmed } : p)));
    void backend
      .updateProject(id, { name: trimmed })
      .then((updated) => {
        setProjectsOnline(true);
        setAllProjects((prev) =>
          prev.map((p) => (p.id === id ? { ...p, name: updated.name } : p)),
        );
      })
      .catch(() => setProjectsOnline(false));
  }, []);

  const deleteProject = useCallback((id: string) => {
    if (id === DEFAULT_PROJECT_ID) return;
    setAllProjects((prev) => prev.filter((p) => p.id !== id));
    setExpanded((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (lastProject.current === id) lastProject.current = DEFAULT_PROJECT_ID;
    if (draftProjectRef.current === id) setDraftProject(DEFAULT_PROJECT_ID);
    void backend
      .deleteProject(id)
      .then(() => setProjectsOnline(true))
      .catch(() => setProjectsOnline(false));
  }, []);

  const saveSubfolders = useCallback((id: string, subfolders: string[]) => {
    setAllProjects((prev) => prev.map((p) => (p.id === id ? { ...p, subfolders } : p)));
    void backend
      .updateProject(id, { subfolders })
      .then((updated) => {
        setProjectsOnline(true);
        setAllProjects((prev) =>
          prev.map((p) => (p.id === id ? { ...p, subfolders: updated.subfolders } : p)),
        );
      })
      .catch(() => setProjectsOnline(false));
  }, []);

  // (The design/preset effects above own data-theme; nothing is persisted.)

  // Boot: list chats, open the most recent one (or a fresh chat),
  // and restore appearance + projects from the backend DB when reachable.
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
      try {
        const stored = await backend.listProjects();
        if (cancelled) return;
        setProjectsOnline(true);
        setAllProjects(
          stored.map((p) => ({
            id: p.id,
            name: p.name,
            mainFolder: p.main_folder || undefined,
            subfolders: p.subfolders,
          })),
        );
      } catch {
        /* backend offline — local PROJECTS fallback stands */
        if (!cancelled) setProjectsOnline(false);
      }
      try {
        const s = await backend.getSettings();
        if (cancelled) return;
        const design = s['appearance.design'];
        if (design === 'system' || design === 'light' || design === 'dark') setDesign(design);
        const preset = s['appearance.preset'];
        if (typeof preset === 'string' && PRESETS.some((p) => p.id === preset)) {
          setPresetId(preset);
        }
        const overrides = s['appearance.overrides'];
        if (overrides && typeof overrides === 'object' && !Array.isArray(overrides)) {
          const clean: ColorOverrides = {};
          for (const [k, v] of Object.entries(overrides)) {
            if ((k === 'accent' || k === 'background' || k === 'foreground') && typeof v === 'string') {
              clean[k] = v;
            }
          }
          setColorOverrides(clean);
          colorOverridesRef.current = clean;
        }
        // General, personalization, computer/browser use, model and level.
        // Stored values win only when they pass a strict type check.
        const str = (v: unknown): string | undefined =>
          typeof v === 'string' ? v : undefined;
        const bool = (v: unknown): boolean | undefined =>
          typeof v === 'boolean' ? v : undefined;
        const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined =>
          typeof v === 'string' && (allowed as readonly string[]).includes(v)
            ? (v as T)
            : undefined;
        const strArr = (v: unknown): string[] | undefined =>
          Array.isArray(v) && v.every((x) => typeof x === 'string') ? [...v] : undefined;
        const nonEmpty = (v: unknown): string | undefined =>
          typeof v === 'string' && v.length > 0 ? v : undefined;
        const generalNext: GeneralSettings = { ...defaultGeneral() };
        const folder = str(s['general.folder']);
        if (folder !== undefined) generalNext.folder = folder;
        const shell = nonEmpty(s['general.shell']);
        if (shell !== undefined) generalNext.shell = shell;
        const notify = bool(s['general.notify']);
        if (notify !== undefined) generalNext.notify = notify;
        const sound = bool(s['general.sound']);
        if (sound !== undefined) generalNext.sound = sound;
        setGeneral(generalNext);
        setPersonalization((prev) => ({
          ...prev,
          ...(str(s['personalization.name']) !== undefined
            ? { name: str(s['personalization.name'])! }
            : {}),
          ...(str(s['personalization.hobbies']) !== undefined
            ? { hobbies: str(s['personalization.hobbies'])! }
            : {}),
          ...(str(s['personalization.about']) !== undefined
            ? { about: str(s['personalization.about'])! }
            : {}),
          ...(oneOf(s['personalization.emojis'], ['many', 'some', 'few', 'none'] as const) !==
          undefined
            ? {
                emojis: oneOf(
                  s['personalization.emojis'],
                  ['many', 'some', 'few', 'none'] as const,
                )!,
              }
            : {}),
          ...(oneOf(s['personalization.structure'], ['many', 'some', 'few'] as const) !==
          undefined
            ? {
                structure: oneOf(
                  s['personalization.structure'],
                  ['many', 'some', 'few'] as const,
                )!,
              }
            : {}),
          ...(oneOf(s['personalization.detail'], [
            'technical',
            'non-technical',
            'normal',
          ] as const) !== undefined
            ? {
                detail: oneOf(s['personalization.detail'], [
                  'technical',
                  'non-technical',
                  'normal',
                ] as const)!,
              }
            : {}),
          ...(oneOf(s['personalization.tone'], ['instructive', 'creative', 'factual'] as const) !==
          undefined
            ? {
                tone: oneOf(s['personalization.tone'], [
                  'instructive',
                  'creative',
                  'factual',
                ] as const)!,
              }
            : {}),
        }));
        setComputerUse((prev) => ({
          ...prev,
          ...(bool(s['computer_use.enabled']) !== undefined
            ? { enabled: bool(s['computer_use.enabled'])! }
            : {}),
          ...(oneOf(s['computer_use.selection_mode'], ['allow', 'block'] as const) !== undefined
            ? {
                selectionMode: oneOf(s['computer_use.selection_mode'], [
                  'allow',
                  'block',
                ] as const)!,
              }
            : {}),
          ...(strArr(s['computer_use.selected_apps']) !== undefined
            ? { selectedApps: strArr(s['computer_use.selected_apps'])! }
            : {}),
          ...(str(s['computer_use.cursor_color']) !== undefined
            ? { cursorColor: str(s['computer_use.cursor_color'])! }
            : {}),
        }));
        setBrowserUse((prev) => ({
          ...prev,
          ...(str(s['browser_use.open_links_with']) !== undefined
            ? { openLinksWith: str(s['browser_use.open_links_with'])! }
            : {}),
          ...(bool(s['browser_use.clear_browsing_data']) !== undefined
            ? { clearBrowsingData: bool(s['browser_use.clear_browsing_data'])! }
            : {}),
          ...(str(s['browser_use.cursor_color']) !== undefined
            ? { cursorColor: str(s['browser_use.cursor_color'])! }
            : {}),
        }));
        const storedModel = nonEmpty(s['chat.model']);
        if (storedModel !== undefined) setModel(storedModel);
        const storedLevel = oneOf(s['chat.thinking_level'], LEVELS);
        if (storedLevel !== undefined) setLevel(storedLevel);
      } catch {
        /* backend offline — Light defaults stand */
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
    // New chats land in the project of the last opened chat.
    // Nothing auto-expands: the sidebar only moves on explicit clicks.
    newChatProject.current = lastProject.current;
    setDraftProject(lastProject.current);
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
          onRenameProject={renameProject}
          onDeleteProject={deleteProject}
          onEditSubfolders={saveSubfolders}
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
              onModelChange={handleModelChange}
              level={level}
              onLevelChange={handleLevelChange}
              draftProject={draftProject}
              onDraftProjectChange={setDraftProject}
              onAddProject={addProject}
              projects={projectsWithFolders}
            />
          ) : (
            <div className="min-w-0 flex-1">
              <SettingsContent
                tab={settingsTab}
                general={{
                  value: general,
                  onPatch: patchGeneral,
                }}
                appearance={{
                  design,
                  onDesign: handleDesign,
                  presetId,
                  onPreset: handlePreset,
                  overrides: colorOverrides,
                  onOverride: handleColorOverride,
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
                providers={{
                  value: providers,
                  onChange: setProviders,
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
