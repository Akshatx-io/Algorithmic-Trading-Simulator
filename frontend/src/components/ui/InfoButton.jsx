import { useState } from "react";
import { Info } from "lucide-react";
import Modal from "./Modal";

/**
 * InfoButton — a small ⓘ icon that opens a Modal explaining a metric/concept.
 *
 * Pass a glossary `entry` ({ title, subtitle?, what, formula?, points?,
 * interpretation? }). Self-contained (owns its open state), so it can be
 * dropped next to any label, card, or chart heading.
 */
export default function InfoButton({ entry, accent = "#34d399", size = 14, className = "" }) {
  const [open, setOpen] = useState(false);
  if (!entry) return null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`About ${entry.title}`}
        title={entry.title}
        className={`text-gray-500 transition hover:text-white ${className}`}
      >
        <Info size={size} />
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={entry.title}
        subtitle={entry.subtitle}
        icon={Info}
        accent={accent}
      >
        <div className="space-y-4 pt-4 text-sm">
          {entry.what && <p className="text-gray-300">{entry.what}</p>}

          {entry.formula && (
            <div>
              <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Formula</h4>
              <code className="block rounded-lg border border-line/70 bg-ink-900/70 px-3 py-2 font-mono text-xs text-brand-300">
                {entry.formula}
              </code>
            </div>
          )}

          {Array.isArray(entry.points) && entry.points.length > 0 && (
            <ul className="space-y-1.5">
              {entry.points.map((p) => (
                <li key={p} className="flex gap-2 text-gray-300">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: accent }} />
                  {p}
                </li>
              ))}
            </ul>
          )}

          {entry.interpretation && (
            <div className="rounded-xl border border-line/70 bg-ink-900/50 p-3">
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">How to read it</h4>
              <p className="text-gray-300">{entry.interpretation}</p>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
