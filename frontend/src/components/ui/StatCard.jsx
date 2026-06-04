import Card from "./Card";
import InfoButton from "./InfoButton";

/**
 * StatCard — KPI tile: label, big value, optional delta, leading icon, and an
 * optional ⓘ info overlay (pass a glossary `info` entry).
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
  info,
}) {
  const hasDelta = typeof delta === "number" && Number.isFinite(delta);
  const up = hasDelta && delta >= 0;
  const accentHex = accent === "accent" ? "#60a5fa" : "#34d399";
  const accentRing =
    accent === "accent" ? "text-accent-400 bg-accent-500/10" : "text-brand-400 bg-brand-500/10";

  return (
    <Card className="card-pad">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <p className="text-sm text-gray-400">{label}</p>
          {info && <InfoButton entry={info} accent={accentHex} size={13} />}
        </div>
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
