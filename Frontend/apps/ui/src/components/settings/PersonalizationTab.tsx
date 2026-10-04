import { ChevronDown, List, MessageSquare, Smile, Sparkles, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export type EmojiAmount = 'many' | 'some' | 'few' | 'none';
export type StructureAmount = 'many' | 'some' | 'few';
export type DetailLevel = 'technical' | 'non-technical' | 'normal';
export type Tone = 'instructive' | 'creative' | 'factual';

export interface Personalization {
  name: string;
  hobbies: string;
  about: string;
  emojis: EmojiAmount;
  structure: StructureAmount;
  detail: DetailLevel;
  tone: Tone;
}

export const DEFAULT_PERSONALIZATION: Personalization = {
  name: '',
  hobbies: '',
  about: '',
  emojis: 'some',
  structure: 'some',
  detail: 'normal',
  tone: 'factual',
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-tt-hairline bg-tt-card p-5">{children}</section>
  );
}

function CardTitle({ icon: Icon, children }: { icon: typeof User; children: React.ReactNode }) {
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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="mt-3.5 text-[13.5px] font-bold text-tt-ink">{children}</p>;
}

const inputCls =
  'mt-1.5 w-full rounded-lg border border-tt-hairline bg-tt-panel/60 px-3 py-2 text-[13.5px] text-tt-ink outline-none placeholder:text-tt-ink-3 focus:border-tt-signal/50';

function Row({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[13.5px] font-bold text-tt-ink">{title}</p>
        <p className="mt-0.5 text-[12.5px] text-tt-ink-2">{hint}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="cursor-pointer appearance-none rounded-lg border border-tt-hairline bg-white py-2 pr-9 pl-3.5 text-[13px] font-medium text-tt-ink outline-none transition-colors hover:border-tt-signal/50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-tt-ink-3"
      />
    </div>
  );
}

const TONES: { id: Tone; title: string; hint: string }[] = [
  { id: 'instructive', title: 'Instructive', hint: 'Explains step by step.' },
  { id: 'creative', title: 'Creative', hint: 'Playful ideas and variants.' },
  { id: 'factual', title: 'Factual', hint: 'Concise and objective.' },
];

export interface PersonalizationProps {
  value: Personalization;
  onPatch: (patch: Partial<Personalization>) => void;
}

/**
 * Personalization settings — how the assistant answers. Session-only state
 * lives in App (survives tab switches); nothing is persisted anywhere.
 */
export function PersonalizationTab({ value, onPatch }: PersonalizationProps) {
  return (
    <div className="mx-auto w-full max-w-[680px] space-y-4 px-6 py-6">
      <div>
        <h1 className="font-display text-[22px] font-extrabold tracking-tight text-tt-ink">
          Personalization
        </h1>
        <p className="mt-1 text-[13px] text-tt-ink-2">Personalize how the assistant answers.</p>
      </div>

      {/* about you */}
      <Card>
        <CardTitle icon={User}>About you</CardTitle>
        <CardText>Tell the assistant who you are.</CardText>
        <FieldLabel>Name</FieldLabel>
        <input
          value={value.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          placeholder="Your name"
          aria-label="Your name"
          className={inputCls}
        />
        <FieldLabel>Hobbies</FieldLabel>
        <input
          value={value.hobbies}
          onChange={(e) => onPatch({ hobbies: e.target.value })}
          placeholder="What you enjoy doing"
          aria-label="Hobbies"
          className={inputCls}
        />
        <FieldLabel>About you</FieldLabel>
        <textarea
          value={value.about}
          onChange={(e) => onPatch({ about: e.target.value })}
          placeholder="Anything else the assistant should know"
          aria-label="About you"
          rows={3}
          className={cn(inputCls, 'min-h-[88px] resize-y leading-relaxed')}
        />
      </Card>

      {/* emoji usage */}
      <Card>
        <CardTitle icon={Smile}>Emoji usage</CardTitle>
        <CardText>How many emojis answers may contain.</CardText>
        <Row title="Emojis" hint="Preferred amount of emojis in answers.">
          <Select
            label="Emojis"
            value={value.emojis}
            onChange={(v) => onPatch({ emojis: v as EmojiAmount })}
            options={[
              { value: 'many', label: 'Many' },
              { value: 'some', label: 'Some' },
              { value: 'few', label: 'Few' },
              { value: 'none', label: 'None' },
            ]}
          />
        </Row>
      </Card>

      {/* headings and lists */}
      <Card>
        <CardTitle icon={List}>Headings and lists</CardTitle>
        <CardText>How often answers use headings and lists for structure.</CardText>
        <Row title="Structure" hint="Preferred amount of headings and lists.">
          <Select
            label="Structure"
            value={value.structure}
            onChange={(v) => onPatch({ structure: v as StructureAmount })}
            options={[
              { value: 'many', label: 'Many' },
              { value: 'some', label: 'Some' },
              { value: 'few', label: 'Few' },
            ]}
          />
        </Row>
      </Card>

      {/* answer style */}
      <Card>
        <CardTitle icon={MessageSquare}>Answer style</CardTitle>
        <CardText>How detailed and technical answers should be.</CardText>
        <Row title="Detail level" hint="Balanced length and detail.">
          <Select
            label="Detail level"
            value={value.detail}
            onChange={(v) => onPatch({ detail: v as DetailLevel })}
            options={[
              { value: 'technical', label: 'Detailed (Technical)' },
              { value: 'non-technical', label: 'Detailed (Non-technical)' },
              { value: 'normal', label: 'Normal' },
            ]}
          />
        </Row>
      </Card>

      {/* tone */}
      <Card>
        <CardTitle icon={Sparkles}>Tone</CardTitle>
        <CardText>The voice answers should use.</CardText>
        <div className="mt-3.5 grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="Tone">
          {TONES.map((t) => {
            const selected = value.tone === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onPatch({ tone: t.id })}
                className={cn(
                  'rounded-lg border p-3 text-left transition-all',
                  selected
                    ? 'border-transparent ring-2 ring-[var(--tt-signal)]'
                    : 'border-tt-hairline hover:border-tt-ink-3',
                )}
              >
                <span
                  className={cn(
                    'block text-[13.5px] font-bold',
                    selected ? 'text-tt-signal' : 'text-tt-ink',
                  )}
                >
                  {t.title}
                </span>
                <span className="mt-1 block text-[12px] leading-snug text-tt-ink-2">{t.hint}</span>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
