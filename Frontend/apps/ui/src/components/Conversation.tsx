import { useEffect, useRef } from 'react';
import type { ChatStatus } from 'ai';
import type { TontooMessage } from '@/types';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { AssistantTurn } from './AssistantTurn';
import { ProjectPicker } from './ProjectPicker';
import { AddProjectDialog, type NewProject } from './AddProjectDialog';
import tontooIcon from '@/assets/tontoo.png';

interface ConversationProps {
  messages: TontooMessage[];
  status: ChatStatus;
  projects: { id: string; name: string; mainFolder?: string }[];
  draftProject: string;
  onDraftProjectChange: (id: string) => void;
  onAddProject: (project: NewProject) => void;
}

export function Conversation({ messages, status, projects, draftProject, onDraftProjectChange, onAddProject }: ConversationProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const [showAdd, setShowAdd] = useState(false);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, status]);
  const liveId = status === 'streaming' || status === 'submitted' ? messages.at(-1)?.id : null;

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col px-6 pt-4">
        <div className="flex items-center gap-2">
          <ProjectPicker
            projects={projects}
            value={draftProject}
            onChange={onDraftProjectChange}
          />
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            aria-label="Add project"
            title="Add project"
            className="flex size-[38px] shrink-0 items-center justify-center rounded-lg border border-tt-hairline bg-tt-card text-tt-ink-2 shadow-[0_1px_2px_rgb(15_23_42/0.06)] transition-colors hover:text-tt-signal"
          >
            <Plus size={16} strokeWidth={2.1} />
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xl text-center">
            <img
              src={tontooIcon}
              alt="Tontoo"
              width={256}
              height={256}
              className="mx-auto size-14 object-contain"
              draggable={false}
            />
            <h1 className="font-display mt-4 text-[30px] font-extrabold text-balance">
              What should we work on?
            </h1>
          </div>
        </div>
        {showAdd && (
          <AddProjectDialog
            onClose={() => setShowAdd(false)}
            onCreate={(p) => {
              setShowAdd(false);
              onAddProject(p);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div ref={scrollRef} onScroll={onScroll} className="tt-scroll h-full overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-[720px] space-y-7 pb-4">
        {messages.map((m) => {
          if (m.role === 'user') {
            const text = m.parts
              .filter((p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text')
              .map((p) => p.text)
              .join('\n');
            return (
              <div key={m.id} className="tt-rise flex justify-end">
                <div className="max-w-[80%] rounded-xl bg-black px-4 py-2.5 text-[14px] leading-relaxed text-white whitespace-pre-wrap">
                  {text}
                </div>
              </div>
            );
          }
          if (m.role === 'assistant') {
            return <AssistantTurn key={m.id} message={m} live={m.id === liveId} />;
          }
          return null;
        })}
      </div>
    </div>
  );
}
