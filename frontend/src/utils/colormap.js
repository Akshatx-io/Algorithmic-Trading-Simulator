// Turbo-style perceptual colormap (t in [0,1] -> rgb). Deps-free.
const STOPS = [
  [48, 18, 59], [62, 73, 204], [33, 144, 231], [27, 205, 194],
  [104, 222, 99], [223, 227, 53], [253, 154, 42], [221, 61, 30],
];

export function turbo(t) {
  const x = t <= 0 ? 0 : t >= 1 ? 1 : t;
  const seg = x * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(seg));
  const f = seg - i;
  const a = STOPS[i], b = STOPS[i + 1];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

export const turboCss = (t) => {
  const [r, g, b] = turbo(t);
  return `rgb(${r},${g},${b})`;
};
