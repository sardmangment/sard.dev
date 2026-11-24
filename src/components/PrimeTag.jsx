// DEV-191: "Prime" tag shown on the AI button, like the label on premium / featured services.
export function PrimeTag({ className = '' }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider text-white bg-gradient-to-r from-brand-orange to-brand-orange-400 shadow-sm ${className}`}
      dir="ltr"
      aria-label="Prime"
    >
      Prime
    </span>
  );
}

export default PrimeTag;
