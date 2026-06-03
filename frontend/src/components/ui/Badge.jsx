/**
 * Badge — small status/signal pill. Variants map to semantic colors.
 */
const VARIANTS = {
  up: "bg-up/10 text-up border-up/30",
  down: "bg-down/10 text-down border-down/30",
  neutral: "bg-gray-500/10 text-gray-300 border-gray-500/30",
  buy: "bg-up/10 text-up border-up/30",
  sell: "bg-down/10 text-down border-down/30",
  hold: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  brand: "bg-brand-500/10 text-brand-300 border-brand-500/30",
};

export default function Badge({ variant = "neutral", children, className = "" }) {
  const v = VARIANTS[String(variant).toLowerCase()] || VARIANTS.neutral;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${v} ${className}`}
    >
      {children}
    </span>
  );
}
