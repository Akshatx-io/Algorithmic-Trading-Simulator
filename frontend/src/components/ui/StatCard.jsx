import Card from "./Card";

/**
 * StatCard — KPI tile: label, big value, optional delta and leading icon.
 * `tone` colors the value; `delta` (number) renders a green/red change chip.
 */
const toneClass = (tone) =>
  tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-white";

export default function StatCard({
  label,
  value,
  delta,
  deltaSuffix = "",
  icon: Icon,
  tone = "default",
  accent = "brand",
}) {
  const hasDelta = typeof delta === "number" && Number.isFinite(delta);
  const up = hasDelta && delta >= 0;
  const accentRing =
    accent === "accent" ? "text-accent-400 bg-accent-500/10" : "text-brand-400 bg-brand-500/10";

  return (
    <Card className="card-pad">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">{label}</p>
        {Icon && (
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${accentRing}`}>
            <Icon size={16} />
          </span>
        )}
      </div>
      <p className={`mt-2 text-2xl font-semibold tnum ${toneClass(tone)}`}>{value}</p>
      {hasDelta && (
        <p className={`mt-1 text-xs tnum ${up ? "text-up" : "text-down"}`}>
          {up ? "▲" : "▼"} {Math.abs(delta).toFixed(2)}
          {deltaSuffix}
        </p>
      )}
    </Card>
  );
}
