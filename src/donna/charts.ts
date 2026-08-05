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
export function renderBarChart(
  points: BarPoint[],
  opts?: { formatValue?: (v: number) => string; showAxes?: boolean }
): string {
  if (points.length === 0) return "";

  const max = Math.max(...points.map((p) => p.value), 1);
  const formatValue = opts?.formatValue ?? ((v: number) => v.toFixed(0));
  const showAxes = opts?.showAxes ?? false;

  // Vertical gridlines shared across every bar's track (so they all read
  // against the same dollar scale) plus one axis-label row at the bottom
  // — opt-in since Home's compact widgets don't have the room for this.
  const TICKS = 4;
  const gridlineHtml = showAxes
    ? Array.from({ length: TICKS + 1 }, (_, i) => {
        const pct = (i / TICKS) * 100;
        return `<div style="position:absolute; left:${pct}%; top:0; bottom:0; width:1px; background:var(--border);"></div>`;
      }).join("\n")
    : "";
  const axisLabelsHtml = showAxes
    ? `<div style="display:flex; justify-content:space-between; margin-top:4px; padding-left:0;">
        ${Array.from({ length: TICKS + 1 }, (_, i) => `<span style="font-size:10px; color:var(--text-muted); font-variant-numeric: tabular-nums;">${escapeHtml(formatValue((max * i) / TICKS))}</span>`).join("\n")}
      </div>`
    : "";

  return `<div style="display:flex; flex-direction:column; gap:12px;">
    ${points
      .map((p) => {
        const pct = Math.max(3, Math.round((p.value / max) * 100));
        return `<div>
          <div style="display:flex; justify-content:space-between; gap: var(--sp-2); font-size:13px; margin-bottom:4px;">
            <span style="color:var(--ink);">${escapeHtml(p.label)}</span>
            <span style="color:var(--text-secondary); font-variant-numeric: tabular-nums; flex:0 0 auto;">${escapeHtml(formatValue(p.value))}</span>
          </div>
          <div style="position:relative; height:8px; border-radius:4px; background:var(--taupe); overflow:hidden;">
            ${gridlineHtml}
            <div style="height:100%; width:${pct}%; border-radius:4px; background:var(--accent);"></div>
          </div>
        </div>`;
      })
      .join("\n")}
    ${axisLabelsHtml}
  </div>`;
}

interface LineChartCoord {
  x: number;
  y: number;
}

// Y-axis gridlines + $ labels, and a handful of x-axis date labels (first/
// middle/last point, not every single one — with 90 daily points that
// would just be an unreadable smear of overlapping text).
function renderLineChartAxes(args: {
  min: number;
  max: number;
  leftPad: number;
  rightPad: number;
  topPad: number;
  bottomPad: number;
  width: number;
  height: number;
  formatValue: (v: number) => string;
  formatLabel: (label: string) => string;
  points: ChartPoint[];
  coords: LineChartCoord[];
}): string {
  const { min, max, leftPad, rightPad, topPad, bottomPad, width, height, formatValue, formatLabel, points, coords } = args;
  const GRIDLINES = 4;
  const innerHeight = height - topPad - bottomPad;

  const gridlines = Array.from({ length: GRIDLINES + 1 }, (_, i) => {
    const frac = i / GRIDLINES;
    const y = topPad + innerHeight * frac;
    const value = max - (max - min) * frac;
    return `
      <line x1="${leftPad}" y1="${y.toFixed(1)}" x2="${width - rightPad}" y2="${y.toFixed(1)}" style="stroke:var(--border); stroke-width:1;" />
      <text x="${(leftPad - 8).toFixed(1)}" y="${y.toFixed(1)}" text-anchor="end" dominant-baseline="middle" style="font-size:10px; fill:var(--text-muted);">${escapeHtml(formatValue(value))}</text>`;
  }).join("\n");

  const labelIndices =
    points.length <= 3 ? points.map((_, i) => i) : [0, Math.floor((points.length - 1) / 2), points.length - 1];
  const xLabels = labelIndices
    .map(
      (i) =>
        `<text x="${coords[i].x.toFixed(1)}" y="${(height - bottomPad + 16).toFixed(1)}" text-anchor="middle" style="font-size:10px; fill:var(--text-muted);">${escapeHtml(formatLabel(points[i].label))}</text>`
    )
    .join("\n");

  return `${gridlines}\n${xLabels}`;
}

// A small self-contained inline-SVG line chart — no charting dependency,
// matching this codebase's existing zero-external-dependency posture for
// graphics (icons.ts). Colors are set via inline `style` (not bare `fill`/
// `stroke` attributes) specifically so `var(--accent)` etc. resolve against
// the page's current theme — SVG presentation attributes don't support
// CSS custom properties, but properties set through `style` do.
export function renderLineChart(
  points: ChartPoint[],
  opts?: {
    width?: number;
    height?: number;
    showAxes?: boolean;
    formatValue?: (v: number) => string;
    formatLabel?: (label: string) => string;
  }
): string {
  if (points.length === 0) return "";

  const showAxes = opts?.showAxes ?? false;
  const width = opts?.width ?? 640;
  const height = opts?.height ?? (showAxes ? 220 : 160);
  const formatValue = opts?.formatValue ?? ((v: number) => v.toFixed(0));
  const formatLabel = opts?.formatLabel ?? ((label: string) => label);

  // Axes need room for the $ labels on the left and date labels along the
  // bottom — the bare sparkline (Home's compact widgets) keeps the old
  // tight padding since it has neither.
  const leftPad = showAxes ? 52 : 20;
  const rightPad = 20;
  const topPad = 16;
  const bottomPad = showAxes ? 28 : 20;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const innerWidth = width - leftPad - rightPad;
  const innerHeight = height - topPad - bottomPad;
  const stepX = points.length > 1 ? innerWidth / (points.length - 1) : 0;

  const coords = points.map((p, i) => ({
    x: leftPad + i * stepX,
    y: topPad + innerHeight - ((p.value - min) / range) * innerHeight,
  }));

  const axesHtml = showAxes
    ? renderLineChartAxes({ min, max, leftPad, rightPad, topPad, bottomPad, width, height, formatValue, formatLabel, points, coords })
    : "";

  // A single point still needs to render as something visible — draw it
  // centered rather than trying to build a zero-length path.
  if (coords.length === 1) {
    const { x, y } = coords[0];
    return `<svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto; display:block;">
      ${axesHtml}
      <circle cx="${x}" cy="${y}" r="4" style="fill:var(--accent);" />
    </svg>`;
  }

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${height - bottomPad} L${coords[0].x.toFixed(1)},${height - bottomPad} Z`;
  const last = coords[coords.length - 1];

  return `<svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto; display:block;">
    ${axesHtml}
    <path d="${areaPath}" style="fill:var(--accent); fill-opacity:0.12; stroke:none;" />
    <path d="${linePath}" style="fill:none; stroke:var(--accent); stroke-width:2; stroke-linecap:round; stroke-linejoin:round;" />
    <circle cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="3.5" style="fill:var(--accent);" />
  </svg>`;
}
