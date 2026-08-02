import { escapeHtml } from "../util/html.js";

export interface ChartPoint {
  label: string;
  value: number;
}

export interface BarPoint {
  label: string;
  value: number;
}

// Horizontal bars over plain HTML/CSS rather than SVG — text labels of
// varying length (category names) are simpler to lay out and wrap this
// way than as SVG <text>, and the fill still resolves var(--accent)
// against the page's current theme same as renderLineChart above.
export function renderBarChart(points: BarPoint[], opts?: { formatValue?: (v: number) => string }): string {
  if (points.length === 0) return "";

  const max = Math.max(...points.map((p) => p.value), 1);
  const formatValue = opts?.formatValue ?? ((v: number) => v.toFixed(0));

  return `<div style="display:flex; flex-direction:column; gap:12px;">
    ${points
      .map((p) => {
        const pct = Math.max(3, Math.round((p.value / max) * 100));
        return `<div>
          <div style="display:flex; justify-content:space-between; gap: var(--sp-2); font-size:13px; margin-bottom:4px;">
            <span style="color:var(--ink);">${escapeHtml(p.label)}</span>
            <span style="color:var(--text-secondary); font-variant-numeric: tabular-nums; flex:0 0 auto;">${escapeHtml(formatValue(p.value))}</span>
          </div>
          <div style="height:8px; border-radius:4px; background:var(--taupe); overflow:hidden;">
            <div style="height:100%; width:${pct}%; border-radius:4px; background:var(--accent);"></div>
          </div>
        </div>`;
      })
      .join("\n")}
  </div>`;
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
