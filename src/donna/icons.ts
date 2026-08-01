// Small hand-picked set of outline icons in the Lucide (MIT-licensed) style —
// inlined directly as SVG markup rather than pulled from a CDN or icon font,
// matching this project's zero-external-dependency posture.

function svg(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

export const iconHome = svg(
  `<path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h14V10" /><path d="M9.5 20v-6h5v6" />`
);

export const iconFolder = svg(
  `<path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />`
);

export const iconCalendar = svg(
  `<rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9.5h18" /><path d="M8 3v4" /><path d="M16 3v4" />`
);

export const iconBell = svg(
  `<path d="M6 9a6 6 0 0 1 12 0c0 4.5 1.5 6 1.5 6h-15S6 13.5 6 9Z" /><path d="M10 19a2 2 0 0 0 4 0" />`
);

export const iconSettings = svg(
  `<circle cx="12" cy="12" r="3" /><path d="M19.4 13a7.6 7.6 0 0 0 0-2l1.9-1.5-2-3.4-2.3.9a7.6 7.6 0 0 0-1.7-1L15 3.5h-4l-.3 2.5a7.6 7.6 0 0 0-1.7 1l-2.3-.9-2 3.4L6.6 11a7.6 7.6 0 0 0 0 2l-1.9 1.5 2 3.4 2.3-.9a7.6 7.6 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7.6 7.6 0 0 0 1.7-1l2.3.9 2-3.4Z" />`
);

export const iconSearch = svg(
  `<circle cx="11" cy="11" r="7" /><path d="m21 21-3.5-3.5" />`
);

export const iconFilter = svg(`<path d="M4 5h16l-6 8v6l-4-2v-4Z" />`);

export const iconUpload = svg(
  `<path d="M12 15V4" /><path d="m7 8 5-5 5 5" /><path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />`
);

export const iconChevronDown = svg(`<path d="m6 9 6 6 6-6" />`);

export const iconUser = svg(
  `<circle cx="12" cy="8" r="4" /><path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6" />`
);

export const iconX = svg(`<path d="M18 6 6 18" /><path d="M6 6l12 12" />`);

export const iconInfo = svg(
  `<circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" />`
);

export const iconSend = svg(`<path d="M4 20 20 12 4 4v6l12 2-12 2Z" />`);
