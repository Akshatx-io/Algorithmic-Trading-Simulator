import { useEffect, useRef } from "react";
import { turbo } from "../../utils/colormap";

/**
 * VolSurface3D — dependency-free 3D implied-vol surface on <canvas>.
 * Manual 3D->2D projection (yaw/pitch + perspective), painter's-algorithm depth
 * sort, per-quad Lambert shading + turbo colormap, gridded floor and projected
 * axis ticks (moneyness / expiry / IV). Drag to rotate; optional auto-spin.
 */
const HEIGHT = 0.92;
const ZBASE = -HEIGHT / 2;
const ZTOP = HEIGHT / 2;
const LIGHT = (() => { const v = [0.35, -0.5, 0.79]; const m = Math.hypot(...v); return v.map((c) => c / m); })();

export default function VolSurface3D({
  iv = [], zmin = 0, zmax = 1, moneyness = [], expiries = [], autoRotate = false, height = 470,
}) {
  const wrap = useRef(null);
  const cv = useRef(null);
  const raf = useRef(0);
  const yaw = useRef(-0.68);
  const pitch = useRef(-0.96);
  const drag = useRef(null);
  const spin = useRef(autoRotate);
  const ctxRef = useRef({ cx: 0, cy: 0, scale: 1 });

  useEffect(() => {
    spin.current = autoRotate;
    if (autoRotate) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRotate]);

  const ny = iv.length;
  const nx = ny ? iv[0].length : 0;

  const project = (x, y, z) => {
    const { cx, cy, scale } = ctxRef.current;
    const ca = Math.cos(yaw.current), sa = Math.sin(yaw.current);
    const cp = Math.cos(pitch.current), sp = Math.sin(pitch.current);
    const x1 = x * ca - y * sa, y1 = x * sa + y * ca, z1 = z;
    const y2 = y1 * cp - z1 * sp, z2 = y1 * sp + z1 * cp, x2 = x1;
    const persp = 1 / (1 + y2 * 0.3);
    return { sx: cx + x2 * scale * persp, sy: cy - z2 * scale * persp, depth: y2 };
  };

  const NX = (i) => i / (nx - 1) - 0.5;
  const NY = (j) => j / (ny - 1) - 0.5;

  const draw = () => {
    const c = cv.current, w = wrap.current;
    if (!c || !w || !ny) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = w.clientWidth, H = height;
    if (c.width !== Math.round(W * dpr)) {
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      c.style.width = `${W}px`; c.style.height = `${H}px`;
    }
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    ctxRef.current = { cx: W * 0.44, cy: H * 0.54, scale: Math.min(W, H) * 0.52 };
    ctx.font = "10px ui-sans-serif, system-ui, sans-serif";

    ctx.strokeStyle = "rgba(148,163,184,0.13)";
    ctx.lineWidth = 1;
    const stepI = Math.max(1, Math.round(nx / 8));
    const stepJ = Math.max(1, Math.round(ny / 8));
    for (let j = 0; j < ny; j += stepJ) {
      ctx.beginPath();
      for (let i = 0; i < nx; i++) {
        const p = project(NX(i), NY(j), ZBASE);
        if (i === 0) ctx.moveTo(p.sx, p.sy); else ctx.lineTo(p.sx, p.sy);
      }
      ctx.stroke();
    }
    for (let i = 0; i < nx; i += stepI) {
      ctx.beginPath();
      for (let j = 0; j < ny; j++) {
        const p = project(NX(i), NY(j), ZBASE);
        if (j === 0) ctx.moveTo(p.sx, p.sy); else ctx.lineTo(p.sx, p.sy);
      }
      ctx.stroke();
    }

    const sp_ = Math.max(1e-6, zmax - zmin);
    const P = (i, j) => {
      const zv = (iv[j][i] - zmin) / sp_;
      return { x: NX(i), y: NY(j), z: (zv - 0.5) * HEIGHT, zv };
    };
    const quads = [];
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = P(i, j), b = P(i + 1, j), d = P(i + 1, j + 1), e = P(i, j + 1);
        const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z;
        const vx = e.x - a.x, vy = e.y - a.y, vz = e.z - a.z;
        let nxn = uy * vz - uz * vy, nyn = uz * vx - ux * vz, nzn = ux * vy - uy * vx;
        const nm = Math.hypot(nxn, nyn, nzn) || 1; nxn /= nm; nyn /= nm; nzn /= nm;
        const shade = 0.4 + 0.6 * Math.max(0, nxn * LIGHT[0] + nyn * LIGHT[1] + nzn * LIGHT[2]);
        const pa = project(a.x, a.y, a.z), pb = project(b.x, b.y, b.z);
        const pd = project(d.x, d.y, d.z), pe = project(e.x, e.y, e.z);
        quads.push({
          pts: [pa, pb, pd, pe],
          depth: (pa.depth + pb.depth + pd.depth + pe.depth) / 4,
          zv: (a.zv + b.zv + d.zv + e.zv) / 4,
          shade,
        });
      }
    }
    quads.sort((p, q) => q.depth - p.depth);
    for (const q of quads) {
      const [r, g, bl] = turbo(q.zv);
      const s = q.shade;
      ctx.beginPath();
      ctx.moveTo(q.pts[0].sx, q.pts[0].sy);
      for (let m = 1; m < 4; m++) ctx.lineTo(q.pts[m].sx, q.pts[m].sy);
      ctx.closePath();
      ctx.fillStyle = `rgb(${Math.round(r * s)},${Math.round(g * s)},${Math.round(bl * s)})`;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    ctx.fillStyle = "#94a3b8";
    ctx.strokeStyle = "rgba(148,163,184,0.4)";
    ctx.lineWidth = 1;
    ctx.textAlign = "center";
    for (let i = 0; i < nx; i += Math.max(1, Math.round(nx / 6))) {
      const p = project(NX(i), NY(0), ZBASE);
      ctx.fillText(`${moneyness[i]}%`, p.sx, p.sy + 13);
    }
    ctx.textAlign = "right";
    for (let j = 0; j < ny; j += Math.max(1, Math.round(ny / 6))) {
      const p = project(NX(0), NY(j), ZBASE);
      ctx.fillText(`${expiries[j]}y`, p.sx - 6, p.sy + 4);
    }
    const z0 = project(NX(0), NY(0), ZBASE), z1 = project(NX(0), NY(0), ZTOP);
    ctx.beginPath(); ctx.moveTo(z0.sx, z0.sy); ctx.lineTo(z1.sx, z1.sy); ctx.stroke();
    for (let t = 0; t <= 4; t++) {
      const val = zmin + (zmax - zmin) * (t / 4);
      const p = project(NX(0), NY(0), ZBASE + (ZTOP - ZBASE) * (t / 4));
      ctx.fillText(`${val.toFixed(0)}%`, p.sx - 8, p.sy + 3);
    }
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "center";
    const mx = project(NX((nx - 1) / 2), NY(0), ZBASE);
    ctx.fillText("Moneyness", mx.sx, mx.sy + 28);

    const bw = 10, bh = H * 0.46, bx = W - 24, by = H * 0.2;
    for (let t = 0; t < bh; t++) {
      const [r, g, bl] = turbo(1 - t / bh);
      ctx.fillStyle = `rgb(${r},${g},${bl})`;
      ctx.fillRect(bx, by + t, bw, 1);
    }
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "right";
    ctx.fillText(`${zmax.toFixed(0)}%`, bx - 4, by + 8);
    ctx.fillText(`${zmin.toFixed(0)}%`, bx - 4, by + bh);
    ctx.textAlign = "left";
    ctx.fillStyle = "#64748b";
    ctx.fillText("IV", bx, by - 6);
  };

  const start = () => {
    cancelAnimationFrame(raf.current);
    const loop = () => {
      if (spin.current && !drag.current) yaw.current += 0.0035;
      draw();
      if (spin.current && !drag.current) raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    draw();
    if (spin.current) start();
    const ro = new ResizeObserver(() => draw());
    if (wrap.current) ro.observe(wrap.current);
    return () => { cancelAnimationFrame(raf.current); ro.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iv, zmin, zmax, height]);

  const onDown = (e) => { drag.current = { x: e.clientX, y: e.clientY }; cancelAnimationFrame(raf.current); };
  const onMove = (e) => {
    if (!drag.current) return;
    yaw.current += (e.clientX - drag.current.x) * 0.01;
    pitch.current = Math.max(-1.45, Math.min(-0.05, pitch.current + (e.clientY - drag.current.y) * 0.008));
    drag.current = { x: e.clientX, y: e.clientY };
    draw();
  };
  const onUp = () => { drag.current = null; if (spin.current) start(); };

  return (
    <div ref={wrap} className="w-full select-none" style={{ height }}>
      <canvas
        ref={cv}
        className="block w-full cursor-grab active:cursor-grabbing"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      />
    </div>
  );
}
