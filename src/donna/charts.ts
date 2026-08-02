export interface ChartPoint {
  label: string;
  value: number;
}

// A small self-contained inline-SVG line chart — no charting dependency,
// matching this codebase's existing zero-external-dependency posture for
// graphics (icons.ts). Colors are set via inline `style` (not bare `fill`/
// `stroke` attributes) specifically so `var(--accent)` etc. resolve against
// the page's current theme — SVG presentation attributes don't support
// CSS custom properties, but properties set through `style` do.
export function renderLineChart(points: ChartPoint[], opts?: { width?: number; height?: number }): string {
  if (points.length === 0) return "";

  const width = opts?.width ?? 640;
  const height = opts?.height ?? 160;
  const padding = 20;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const stepX = points.length > 1 ? innerWidth / (points.length - 1) : 0;

  const coords = points.map((p, i) => ({
    x: padding + i * stepX,
    y: padding + innerHeight - ((p.value - min) / range) * innerHeight,
  }));

  // A single point still needs to render as something visible — draw it
  // centered rather than trying to build a zero-length path.
  if (coords.length === 1) {
    const { x, y } = coords[0];
    return `<svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto; display:block;">
      <circle cx="${x}" cy="${y}" r="4" style="fill:var(--accent);" />
    </svg>`;
  }

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${height - padding} L${coords[0].x.toFixed(1)},${height - padding} Z`;
  const last = coords[coords.length - 1];

  return `<svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto; display:block;">
    <path d="${areaPath}" style="fill:var(--accent); fill-opacity:0.12; stroke:none;" />
    <path d="${linePath}" style="fill:none; stroke:var(--accent); stroke-width:2; stroke-linecap:round; stroke-linejoin:round;" />
    <circle cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="3.5" style="fill:var(--accent);" />
  </svg>`;
}
