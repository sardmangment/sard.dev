// DEV-191: three bouncing dots instead of a "thinking..." text line.
// The text stays available to screen readers.
export default function ThinkingIndicator({ isRTL = true }) {
  const label = isRTL ? "سرد يكتب الرد" : "Sard AI is typing";
  return (
    <div className="w-full py-3 flex select-none" role="status" aria-live="polite" aria-label={label}>
      <div className="inline-flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-secondary border border-border">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-brand-orange animate-bounce"
            style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.9s" }}
          />
        ))}
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
