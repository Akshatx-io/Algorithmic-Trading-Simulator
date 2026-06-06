import { useEffect, useMemo, useRef, useState } from "react";
import InfoButton from "./InfoButton";

/**
 * MonteCarloViz — high-performance canvas renderer that animates a Monte Carlo
 * option simulation in real time: GBM price paths sweep out from spot, and the
 * terminal-price distribution builds in sync. Pure <canvas> + requestAnimationFrame
 * (no SVG diffing), devicePixelRatio-crisp, ResizeObserver-aware, and auto-stops
 * the moment the run completes so it never burns CPU while idle.
 */

const PALETTE = [
  "#60a5fa", "#34d399", "#a78bfa", "#f472b6",
  "#fbbf24", "#22d3ee", "#f87171", "#4ade80",
];
const PATH_H = 372;
const HIST_H = 230;
const DURATION = 1900; // ms for a full sweep
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const dollars = (n) => `$${Math.round(n).toLocaleString("en-US")}`;

export default function MonteCarloViz({
  paths = [],
  timeAxis = [],
  histogram = [],
  strike = 0,
  kind = "call",
  runId = 0,
  infoEntry,
  loading = false,
}) {
  const pathWrap = useRef(null);
  const pathCv = useRef(null);
  const histWrap = useRef(null);
  const histCv = useRef(null);
  const raf = useRef(0);
  const prog = useRef(0);
  const size = useRef({ pW: 0, pH: PATH_H, hW: 0, hH: HIST_H });

  const [pct, setPct] = useState(0);
  const [running, setRunning] = useState(false);

  const ready = paths.length > 0 && timeAxis.length > 1 && histogram.length > 0;

  const domain = useMemo(() => {
    if (!ready) return null;
    let lo = Infinity, hi = -Infinity;
    for (const p of paths) {
      for (let i = 0; i < p.values.length; i++) {
        const v = p.values[i];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    lo = Math.min(lo, strike);
    hi = Math.max(hi, strike);
    const pad = (hi - lo) * 0.08 || 1;
    return { lo: lo - pad, hi: hi + pad, steps: timeAxis.length - 1, T: timeAxis[timeAxis.length - 1] || 1 };
  }, [paths, timeAxis, strike, ready]);

  const histMax = useMemo(
    () => histogram.reduce((m, b) => Math.max(m, b.count), 0) || 1,
    [histogram],
  );
  const priceRange = useMemo(() => {
    if (!histogram.length) return [0, 1];
    return [histogram[0].price, histogram[histogram.length - 1].price];
  }, [histogram]);

  // --- crisp sizing ---
  const measure = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (pathWrap.current && pathCv.current) {
      const w = pathWrap.current.clientWidth;
      size.current.pW = w;
      size.current.pH = PATH_H;
      pathCv.current.width = Math.round(w * dpr);
      pathCv.current.height = Math.round(PATH_H * dpr);
      pathCv.current.style.width = `${w}px`;
      pathCv.current.style.height = `${PATH_H}px`;
      pathCv.current.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (histWrap.current && histCv.current) {
      const w = histWrap.current.clientWidth;
      size.current.hW = w;
      size.current.hH = HIST_H;
      histCv.current.width = Math.round(w * dpr);
      histCv.current.height = Math.round(HIST_H * dpr);
      histCv.current.style.width = `${w}px`;
      histCv.current.style.height = `${HIST_H}px`;
      histCv.current.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  };

  const drawPaths = (p) => {
    const cv = pathCv.current;
    if (!cv || !domain) return;
    const ctx = cv.getContext("2d");
    const W = size.current.pW, H = size.current.pH;
    const ml = 50, mr = 14, mt = 12, mb = 24;
    const plotW = W - ml - mr, plotH = H - mt - mb;
    const { lo, hi, steps, T } = domain;
    const X = (i) => ml + (i / steps) * plotW;
    const Y = (price) => mt + (1 - (price - lo) / (hi - lo)) * plotH;

    ctx.clearRect(0, 0, W, H);
    ctx.font = "11px ui-sans-serif, system-ui, sans-serif";

    // horizontal grid + price labels
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let g = 0; g <= 4; g++) {
      const price = lo + (hi - lo) * (g / 4);
      const yy = Y(price);
      ctx.strokeStyle = "rgba(148,163,184,0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ml, yy);
      ctx.lineTo(W - mr, yy);
      ctx.stroke();
      ctx.fillStyle = "#64748b";
      ctx.fillText(dollars(price), ml - 8, yy);
    }

    // time labels
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#64748b";
    for (let g = 0; g <= 4; g++) {
      ctx.fillText(`${(T * (g / 4)).toFixed(2)}y`, X((steps * g) / 4), H - 7);
    }

    // strike line
    const sy = Y(strike);
    ctx.strokeStyle = "#f43f5e";
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(ml, sy);
    ctx.lineTo(W - mr, sy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#fb7185";
    ctx.textAlign = "left";
    ctx.fillText(`Strike ${dollars(strike)}`, ml + 6, sy - 6);

    // paths
    const f = p * steps;
    const full = Math.floor(f);
    const frac = f - full;
    ctx.lineWidth = 1.15;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (let pi = 0; pi < paths.length; pi++) {
      const vals = paths[pi].values;
      const col = PALETTE[pi % PALETTE.length];
      ctx.strokeStyle = col;
      ctx.globalAlpha = 0.36;
      ctx.beginPath();
      ctx.moveTo(X(0), Y(vals[0]));
      let k = 1;
      for (; k <= full && k < vals.length; k++) ctx.lineTo(X(k), Y(vals[k]));
      let lx, ly;
      if (full < steps) {
        const a = vals[Math.min(full, vals.length - 1)];
        const b = vals[Math.min(full + 1, vals.length - 1)];
        lx = X(full) + (X(full + 1) - X(full)) * frac;
        ly = Y(a + (b - a) * frac);
        ctx.lineTo(lx, ly);
      } else {
        lx = X(steps);
        ly = Y(vals[vals.length - 1]);
      }
      ctx.stroke();
      // glowing leading head
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(lx, ly, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  const drawHist = (p) => {
    const cv = histCv.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const W = size.current.hW, H = size.current.hH;
    const ml = 50, mr = 14, mt = 10, mb = 24;
    const plotW = W - ml - mr, plotH = H - mt - mb;
    const n = histogram.length;
    const bw = plotW / n;
    const grow = easeInOut(Math.min(1, p * 1.04));

    ctx.clearRect(0, 0, W, H);
    ctx.font = "11px ui-sans-serif, system-ui, sans-serif";

    for (let i = 0; i < n; i++) {
      const b = histogram[i];
      const h = (b.count / histMax) * plotH * grow;
      const itm = kind === "call" ? b.price >= strike : b.price <= strike;
      ctx.fillStyle = itm ? "#34d399" : "#3f4a5e";
      const bx = ml + i * bw;
      ctx.fillRect(bx + 0.5, mt + plotH - h, Math.max(1, bw - 1), h);
    }

    // strike marker
    const [p0, p1] = priceRange;
    const sx = ml + ((strike - p0) / (p1 - p0 || 1)) * plotW;
    if (sx >= ml && sx <= W - mr) {
      ctx.strokeStyle = "#f43f5e";
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(sx, mt);
      ctx.lineTo(sx, mt + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // price labels
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "center";
    for (let g = 0; g <= 4; g++) {
      const pr = p0 + (p1 - p0) * (g / 4);
      ctx.fillText(dollars(pr), ml + plotW * (g / 4), H - 7);
    }
  };

  const drawAll = (p) => {
    drawPaths(p);
    drawHist(p);
  };

  // animation driver — replays whenever a new simulation arrives (runId)
  useEffect(() => {
    if (!domain) return undefined;
    measure();
    setRunning(true);
    prog.current = 0;
    let start = null;
    const tick = (ts) => {
      if (start === null) start = ts;
      const lin = Math.min(1, (ts - start) / DURATION);
      prog.current = easeInOut(lin);
      drawAll(prog.current);
      setPct(Math.round(lin * 100));
      if (lin < 1) {
        raf.current = requestAnimationFrame(tick);
      } else {
        setRunning(false);
      }
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, domain]);

  // keep crisp + redraw current frame on resize
  useEffect(() => {
    if (!domain) return undefined;
    const ro = new ResizeObserver(() => {
      measure();
      drawAll(prog.current || 1);
    });
    if (pathWrap.current) ro.observe(pathWrap.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain]);

  return (
    <div className="space-y-5">
      {/* header + live progress */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h3 className="text-base font-semibold text-white">Monte Carlo Simulation</h3>
          {infoEntry && <InfoButton entry={infoEntry} accent="#34d399" size={15} />}
        </div>
        <div className="flex items-center gap-2">
          <span className={`h-1.5 w-1.5 rounded-full ${running ? "animate-pulse bg-brand-400" : "bg-up"}`} />
          <span className="tnum text-xs text-gray-400">
            {ready ? (running ? `Simulating ${paths.length} paths… ${pct}%` : "Converged") : "Awaiting run"}
          </span>
        </div>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-ink-900">
        <div
          className="h-full rounded-full bg-brand-gradient transition-[width] duration-150 ease-out"
          style={{ width: `${ready ? pct : 0}%` }}
        />
      </div>

      {/* paths canvas */}
      <div ref={pathWrap} className="relative w-full" style={{ height: PATH_H }}>
        <canvas ref={pathCv} className="block w-full" />
        {(loading || !ready) && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500">
            {loading ? "Running simulation…" : "Adjust inputs and run the simulation."}
          </div>
        )}
      </div>

      <div className="border-t border-line/60 pt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Terminal Price Distribution · <span className="text-up">green = in-the-money</span>
        </p>
        <div ref={histWrap} className="relative w-full" style={{ height: HIST_H }}>
          <canvas ref={histCv} className="block w-full" />
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500">—</div>
          )}
        </div>
      </div>
    </div>
  );
}
