/** Round live indicator for a running agent. Signal color with a soft ping. */
export function LiveBubble({ label }: { label?: string }) {
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
