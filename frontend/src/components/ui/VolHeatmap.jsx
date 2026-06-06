import { useEffect, useRef, useState } from "react";
import { turbo } from "../../utils/colormap";

/**
 * VolHeatmap — crisp 2D implied-vol heatmap with axis ticks + hover readout.
 */
export default function VolHeatmap({ iv = [], moneyness = [], expiries = [], zmin = 0, zmax = 1, height = 460 }) {
  const wrap = useRef(null);
  const cv = useRef(null);
  const [hover, setHover] = useState(null);
  const ny = iv.length;
  const nx = ny ? iv[0].length : 0;
  const ML = 50, MR = 16, MT = 12, MB = 30;

  const draw = () => {
    const c = cv.current, w = wrap.current;
    if (!c || !w || !ny) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = w.clientWidth, H = height;
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    c.style.width = `${W}px`; c.style.height = `${H}px`;
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const pw = W - ML - MR, ph = H - MT - MB;
    const cw = pw / nx, ch = ph / ny;
    const span = Math.max(1e-6, zmax - zmin);

    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const [r, g, b] = turbo((iv[j][i] - zmin) / span);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        // expiries ascending -> draw long maturities at top
        const y = MT + (ny - 1 - j) * ch;
        ctx.fillRect(ML + i * cw, y, cw + 0.5, ch + 0.5);
      }
    }
    ctx.font = "10px ui-sans-serif, system-ui";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "center";
    for (let i = 0; i < nx; i += 2) {
      ctx.fillText(`${moneyness[i]}%`, ML + (i + 0.5) * cw, H - 10);
    }
    ctx.textAlign = "right";
    for (let j = 0; j < ny; j += 2) {
      const y = MT + (ny - 1 - j) * ch + ch / 2 + 3;
      ctx.fillText(`${expiries[j]}y`, ML - 8, y);
    }
  };

  useEffect(() => {
    draw();
    const ro = new ResizeObserver(() => draw());
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iv, zmin, zmax, height]);

  const onMove = (e) => {
    const w = wrap.current; if (!w || !ny) return;
    const W = w.clientWidth, H = height;
    const pw = W - ML - MR, ph = H - MT - MB;
    const x = e.nativeEvent.offsetX, y = e.nativeEvent.offsetY;
    const i = Math.floor((x - ML) / (pw / nx));
    const jr = Math.floor((y - MT) / (ph / ny));
    const j = ny - 1 - jr;
    if (i < 0 || i >= nx || j < 0 || j >= ny) { setHover(null); return; }
    setHover({ left: x, top: y, iv: iv[j][i], m: moneyness[i], t: expiries[j] });
  };

  return (
    <div ref={wrap} className="relative w-full" style={{ height }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <canvas ref={cv} className="block w-full" />
      {hover && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-line bg-ink-950/95 px-2.5 py-1.5 text-xs shadow-xl"
          style={{ left: Math.min(hover.left + 12, 9999), top: hover.top + 12 }}
        >
          <p className="font-semibold text-white">{hover.iv.toFixed(2)}% IV</p>
          <p className="text-gray-400">{hover.m}% moneyness · {hover.t}y</p>
        </div>
      )}
    </div>
  );
}
