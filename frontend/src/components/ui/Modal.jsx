import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Modal — accessible overlay dialog.
 *
 * - Closes on backdrop click, the X button, or the Escape key.
 * - Locks body scroll while open.
 * - Renders nothing when `open` is false (no portal needed; fixed overlay).
 */
export default function Modal({ open, onClose, title, subtitle, icon, accent = "#34d399", children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  const Icon = icon;

  // Portal to <body> so the overlay escapes any ancestor stacking/overflow
  // context (cards use backdrop-blur/transform) — guarantees it renders on top
  // and centered on the full viewport everywhere.
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-ink-800 shadow-card">
        {/* Accent glow header */}
        <div
          className="px-6 pt-6 pb-4"
          style={{
            background: `radial-gradient(120% 120% at 0% 0%, ${accent}22 0%, transparent 60%)`,
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {Icon && (
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${accent}22`, color: accent }}
                >
                  <Icon size={20} />
                </span>
              )}
              <div>
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                {subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-ink-700 hover:text-white"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto px-6 pb-6">{children}</div>
      </div>
    </div>,
    document.body
  );
}
