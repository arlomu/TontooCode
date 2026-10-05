/** Round agent indicator. Live pulses blue, done sits yellow and static. */
export function LiveBubble({ label, tone }: { label?: string; tone: 'live' | 'done' }) {
  if (tone === 'done') {
    return (
      <span
        role="status"
        aria-label={label ?? 'Agent finished'}
        title={label ?? 'Agent finished'}
        className="relative flex size-[7px] shrink-0"
      >
        <span className="relative inline-flex size-[7px] rounded-full bg-yellow-400" />
      </span>
    );
  }
  return (
    <span
      role="status"
      aria-label={label ?? 'Agent running'}
      title={label ?? 'Agent running'}
      className="relative flex size-[7px] shrink-0"
    >
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-tt-signal opacity-60" />
      <span className="relative inline-flex size-[7px] rounded-full bg-tt-signal" />
    </span>
  );
}
