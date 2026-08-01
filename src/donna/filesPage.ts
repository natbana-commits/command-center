import type { NavVisibility } from "../config.js";
import type { ClassFolder } from "../drive/classFolders.js";
import type { DriveFile } from "../drive/list.js";
import type { Upload } from "../storage/uploads.js";
import { escapeHtml } from "../util/html.js";
import { renderLayout } from "./layout.js";

interface LibraryRow {
  title: string;
  className: string;
  dateIso: string;
  dateLabel: string;
  status: string;
  link?: string;
  icon: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function uploadStatusLabel(status: Upload["status"]): string {
  if (status === "done") return "Done";
  if (status === "failed") return "Failed";
  return "Processing";
}

function uploadToRow(u: Upload, className: string): LibraryRow {
  return {
    title: u.originalFilename,
    className,
    dateIso: u.createdAt,
    dateLabel: formatDate(u.createdAt),
    status: uploadStatusLabel(u.status),
    icon: u.kind === "lecture" ? "\u{1F3A7}" : "\u{1F5BC}\u{FE0F}",
  };
}

function buildLibraryRows(
  classFolders: ClassFolder[],
  filesByClass: Record<number, DriveFile[]>,
  uploadsByClass: Record<number, Upload[]>,
  generalUploads: Upload[]
): LibraryRow[] {
  const rows: LibraryRow[] = [];

  for (const cls of classFolders) {
    for (const f of filesByClass[cls.id] ?? []) {
      rows.push({
        title: f.name,
        className: cls.className,
        dateIso: f.modifiedTime,
        dateLabel: formatDate(f.modifiedTime),
        status: "Reference",
        link: f.webViewLink,
        icon: "\u{1F4C4}",
      });
    }
    for (const u of uploadsByClass[cls.id] ?? []) {
      rows.push(uploadToRow(u, cls.className));
    }
  }

  for (const u of generalUploads) {
    rows.push(uploadToRow(u, "—"));
  }

  return rows;
}

function renderLibraryTable(rows: LibraryRow[]): string {
  if (rows.length === 0) {
    return `<p class="empty">Nothing in your library yet.</p>`;
  }

  const classOptions = [...new Set(rows.map((r) => r.className))]
    .filter((c) => c !== "—")
    .sort((a, b) => a.localeCompare(b));

  const trs = rows
    .map((r) => {
      const titleCell = r.link
        ? `<a href="${escapeHtml(r.link)}" target="_blank" rel="noopener noreferrer"><span class="file-icon">${r.icon}</span>${escapeHtml(r.title)}</a>`
        : `<span class="file-icon">${r.icon}</span>${escapeHtml(r.title)}`;

      return `
        <tr data-title="${escapeHtml(r.title.toLowerCase())}" data-class="${escapeHtml(r.className)}">
          <td>${titleCell}</td>
          <td>${escapeHtml(r.className)}</td>
          <td data-sort-value="${escapeHtml(r.dateIso)}">${escapeHtml(r.dateLabel)}</td>
          <td>${escapeHtml(r.status)}</td>
        </tr>`;
    })
    .join("\n");

  return `
    <div class="file-table-controls">
      <input type="text" id="file-search" placeholder="Search files…" />
      <select id="file-class-filter">
        <option value="">All classes</option>
        ${classOptions.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}
      </select>
    </div>
    <table class="file-table" id="file-table">
      <thead>
        <tr>
          <th data-key="title">Title</th>
          <th data-key="class">Class</th>
          <th data-key="date">Date Uploaded</th>
          <th data-key="status">Status</th>
        </tr>
      </thead>
      <tbody id="file-table-body">
        ${trs}
      </tbody>
    </table>`;
}

function renderClassOptions(classFolders: ClassFolder[]): string {
  const options = classFolders
    .map((c) => `<option value="${c.id}">${escapeHtml(c.className)}</option>`)
    .join("");
  return `<option value="">General (no class)</option>${options}`;
}

export interface FilesPageData {
  classFolders: ClassFolder[];
  filesByClass: Record<number, DriveFile[]>;
  uploadsByClass: Record<number, Upload[]>;
  generalUploads: Upload[];
  googleConfigured: boolean;
  navVisibility: NavVisibility;
}

export function buildFilesHtml(data: FilesPageData): string {
  const { classFolders, filesByClass, uploadsByClass, generalUploads, googleConfigured, navVisibility } = data;

  const rows = buildLibraryRows(classFolders, filesByClass, uploadsByClass, generalUploads);
  const libraryHtml =
    rows.length === 0 && classFolders.length === 0
      ? `<p class="empty">${
          googleConfigured
            ? "No classes set up yet — add one in Settings."
            : "Not connected yet — finish Google Drive setup, then add classes in Settings."
        }</p>`
      : renderLibraryTable(rows);

  const body = `
    <div class="file-library-layout">
      <div class="file-library">
        <h1 class="section-title">File Library</h1>
        ${libraryHtml}
      </div>

      <div class="action-panel">
        <h1 class="section-title">Upload a lecture recording</h1>
        <div class="hint">Select a class to associate the recording with, then choose your file.</div>
        <div class="upload-form">
          <select id="lecture-class">${renderClassOptions(classFolders)}</select>
          <input type="file" id="lecture-file" accept="audio/*" />
          <button class="btn btn-block" onclick="handleUpload('lecture', 'lecture-file', 'lecture-class', 'lecture-status')">Upload &amp; Transcribe</button>
          <div class="hint" id="lecture-status"></div>
        </div>

        <hr style="border: none; border-top: 1px solid var(--border); margin: 24px 0;" />

        <h1 class="section-title">Scan a photo or document</h1>
        <div class="hint">Select a class to associate the scan with, then choose your file.</div>
        <div class="upload-form">
          <select id="photo-class">${renderClassOptions(classFolders)}</select>
          <input type="file" id="photo-file" accept="image/*" />
          <button class="btn btn-block" onclick="handleUpload('photo', 'photo-file', 'photo-class', 'photo-status')">Upload &amp; Extract Text</button>
          <div class="hint" id="photo-status"></div>
        </div>
      </div>
    </div>`;

  return renderLayout({
    title: "Donna Files",
    activeTab: "files",
    bodyHtml: body,
    pageScript: CLIENT_SCRIPT,
    showChatFab: true,
    navVisibility,
  });
}

const CLIENT_SCRIPT = `
  async function handleUpload(kind, fileInputId, classSelectId, statusId) {
    const fileInput = document.getElementById(fileInputId);
    const classSelect = document.getElementById(classSelectId);
    const statusEl = document.getElementById(statusId);
    const file = fileInput.files[0];
    if (!file) {
      statusEl.textContent = "Choose a file first.";
      return;
    }

    statusEl.textContent = "Uploading…";
    const classId = classSelect.value ? Number(classSelect.value) : null;

    try {
      const initRes = await fetch("/api/donna-upload-init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, kind, classId }),
      });
      const initData = await initRes.json();
      if (!initRes.ok) {
        statusEl.textContent = "Error: " + (initData.error || "upload init failed");
        return;
      }

      const putRes = await fetch(initData.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!putRes.ok) {
        statusEl.textContent = "Upload failed.";
        return;
      }

      statusEl.textContent = "Processing… this can take a minute.";
      const completeRes = await fetch("/api/donna-upload-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId: initData.uploadId }),
      });
      const completeData = await completeRes.json();

      if (completeData.status === "done") {
        statusEl.textContent = "Done! Reloading…";
        setTimeout(() => location.reload(), 1000);
      } else {
        statusEl.textContent = "Failed: " + (completeData.error || "unknown error");
      }
    } catch (err) {
      statusEl.textContent = "Something went wrong.";
    }
  }

  (function () {
    const searchInput = document.getElementById("file-search");
    const classFilter = document.getElementById("file-class-filter");
    const tbody = document.getElementById("file-table-body");
    if (!tbody) return;

    function applyFilters() {
      const query = (searchInput.value || "").toLowerCase().trim();
      const cls = classFilter.value;
      Array.from(tbody.rows).forEach((row) => {
        const title = row.dataset.title || "";
        const rowClass = row.dataset.class || "";
        const matchesSearch = !query || title.includes(query) || rowClass.toLowerCase().includes(query);
        const matchesClass = !cls || rowClass === cls;
        row.style.display = matchesSearch && matchesClass ? "" : "none";
      });
    }

    if (searchInput) searchInput.addEventListener("input", applyFilters);
    if (classFilter) classFilter.addEventListener("change", applyFilters);

    let sortKey = null;
    let sortAsc = true;

    function cellValue(row, key) {
      if (key === "title") return row.cells[0].textContent.trim().toLowerCase();
      if (key === "class") return row.cells[1].textContent.trim().toLowerCase();
      if (key === "date") return row.cells[2].getAttribute("data-sort-value") || "";
      if (key === "status") return row.cells[3].textContent.trim().toLowerCase();
      return "";
    }

    document.querySelectorAll("#file-table th[data-key]").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.getAttribute("data-key");
        sortAsc = sortKey === key ? !sortAsc : true;
        sortKey = key;

        document.querySelectorAll("#file-table th[data-key] .sort-indicator").forEach((el) => el.remove());
        const indicator = document.createElement("span");
        indicator.className = "sort-indicator";
        indicator.textContent = sortAsc ? "▲" : "▼";
        th.appendChild(indicator);

        const rows = Array.from(tbody.rows);
        rows.sort((a, b) => {
          const av = cellValue(a, key);
          const bv = cellValue(b, key);
          if (av < bv) return sortAsc ? -1 : 1;
          if (av > bv) return sortAsc ? 1 : -1;
          return 0;
        });
        rows.forEach((row) => tbody.appendChild(row));
      });
    });
  })();
`;
