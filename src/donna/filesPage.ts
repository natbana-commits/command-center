import type { NavVisibility } from "../config.js";
import type { ClassFolder } from "../drive/classFolders.js";
import type { DriveFile } from "../drive/list.js";
import type { Reminder } from "../google/tasks.js";
import type { Upload } from "../storage/uploads.js";
import { escapeHtml } from "../util/html.js";
import { withTimeSuffix } from "../util/time.js";
import { renderLayout } from "./layout.js";

// Exported for schoolPage.ts, which shows the same combined Drive-files +
// app-uploads listing scoped to just the active class instead of every
// class — rather than re-deriving this shape in two places.
export interface LibraryRow {
  title: string;
  className: string;
  dateIso: string;
  dateLabel: string;
  status: string;
  link?: string;
  icon: string;
  // Only set for app-uploaded rows (lecture/photo/file) — real Drive rows
  // get no rename/move/delete controls in Edit Files mode. Editing or
  // deleting a real Drive file is a bigger, more destructive action this
  // app doesn't own; do that in Drive directly.
  uploadId?: number;
  // The upload's actual class_id (or null for general/unclassed) — kept
  // separate from the display-only className label so the move dropdown
  // can preselect the file's current class.
  classId?: number | null;
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
    // Only once the upload has actually finished — a still-processing or
    // failed row has nothing in place to view yet.
    link: u.status === "done" ? `/api/donna-upload?view=${u.id}` : undefined,
    icon: u.kind === "lecture" ? "\u{1F3A7}" : u.kind === "photo" ? "\u{1F5BC}\u{FE0F}" : "\u{1F4C4}",
    uploadId: u.id,
    classId: u.classId,
  };
}

export function buildLibraryRows(
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

// returnTo is where the rename/move/delete forms post back to — Files and
// School both render this same table but need the resulting redirect to
// land back on whichever page (and, for School, whichever class) it was
// opened from. classFolders backs the "move to class" dropdown — only
// needed when at least one row is an app upload, but always accepted for
// simplicity at the call sites.
export function renderLibraryTable(rows: LibraryRow[], returnTo: string, classFolders: ClassFolder[]): string {
  if (rows.length === 0) {
    return `<p class="empty">Nothing in your library yet.</p>`;
  }

  const classOptions = [...new Set(rows.map((r) => r.className))]
    .filter((c) => c !== "—")
    .sort((a, b) => a.localeCompare(b));
  const anyEditable = rows.some((r) => r.uploadId !== undefined);

  const trs = rows
    .map((r) => {
      const titleDisplay = r.link
        ? `<a href="${escapeHtml(r.link)}" target="_blank" rel="noopener noreferrer"><span class="file-icon">${r.icon}</span>${escapeHtml(r.title)}</a>`
        : `<span class="file-icon">${r.icon}</span>${escapeHtml(r.title)}`;
      const renameForm =
        r.uploadId !== undefined
          ? `<form method="POST" action="${escapeHtml(returnTo)}" class="file-table-rename-form">
              <input type="hidden" name="action" value="rename-upload" />
              <input type="hidden" name="id" value="${r.uploadId}" />
              <input type="text" name="filename" value="${escapeHtml(r.title)}" required />
              <button type="submit" class="btn-secondary btn-small">Save</button>
            </form>`
          : "";
      const actionCell =
        r.uploadId !== undefined
          ? `<form method="POST" action="${escapeHtml(returnTo)}" class="file-table-move-form">
              <input type="hidden" name="action" value="move-upload" />
              <input type="hidden" name="id" value="${r.uploadId}" />
              <select name="classId">
                <option value="">General</option>
                ${classFolders.map((c) => `<option value="${c.id}" ${c.id === r.classId ? "selected" : ""}>${escapeHtml(c.className)}</option>`).join("")}
              </select>
              <button type="submit" class="btn-secondary btn-small">Move</button>
            </form>
            <form method="POST" action="${escapeHtml(returnTo)}" onsubmit="return confirm('Remove ${escapeHtml(r.title)}? This deletes it from Donna\\'s storage and can\\'t be undone.');">
              <input type="hidden" name="action" value="delete-upload" />
              <input type="hidden" name="id" value="${r.uploadId}" />
              <button type="submit" class="btn-danger btn-small">Remove</button>
            </form>`
          : "";

      return `
        <tr data-title="${escapeHtml(r.title.toLowerCase())}" data-class="${escapeHtml(r.className)}">
          <td>${titleDisplay}${renameForm}</td>
          <td>${escapeHtml(r.className)}</td>
          <td data-sort-value="${escapeHtml(r.dateIso)}">${escapeHtml(r.dateLabel)}</td>
          <td>${escapeHtml(r.status)}</td>
          ${anyEditable ? `<td class="file-table-actions-cell">${actionCell}</td>` : ""}
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
      ${anyEditable ? `<button type="button" class="btn-secondary btn-small" id="file-table-edit-toggle" style="margin-left:auto;">Edit Files</button>` : ""}
    </div>
    <table class="file-table${anyEditable ? " file-table-editable" : ""}" id="file-table">
      <thead>
        <tr>
          <th data-key="title">Title</th>
          <th data-key="class">Class</th>
          <th data-key="date">Date Uploaded</th>
          <th data-key="status">Status</th>
          ${anyEditable ? `<th class="file-table-actions-cell"></th>` : ""}
        </tr>
      </thead>
      <tbody id="file-table-body">
        ${trs}
      </tbody>
    </table>`;
}

// Shows only classes that actually have an upcoming (dated) deadline —
// unlike the Reminders page's grouped view, an all-empty section here
// would just be noise on a page whose primary content is the file
// library. Uses the reminder's own (date-only) `due` field rather than
// the real-time reminder_notifications value, since a rough date is all
// a glance-view of "what's due" needs.
function renderDeadlinesSection(
  classFolders: ClassFolder[],
  reminders: Reminder[],
  classLinks: Map<string, number>
): string {
  const groups = classFolders
    .map((c) => ({
      className: c.className,
      items: reminders
        .filter((r) => classLinks.get(r.id) === c.id && r.due)
        .sort((a, b) => (a.due! < b.due! ? -1 : 1)),
    }))
    .filter((g) => g.items.length > 0);

  if (groups.length === 0) return "";

  const groupsHtml = groups
    .map(
      (g) => `
      <div class="reminder-group">
        <div class="reminder-group-label">${escapeHtml(g.className)}</div>
        ${g.items
          .map(
            (r) => `
          <div class="agenda-event-row">
            <div class="agenda-event-title">${escapeHtml(withTimeSuffix(r.title, null))}</div>
            <div class="agenda-event-time">${escapeHtml(formatDate(r.due!))}</div>
          </div>`
          )
          .join("\n")}
      </div>`
    )
    .join("\n");

  return `
    <div class="card" style="margin-bottom: var(--sp-3);">
      <h1 class="section-title">Upcoming Deadlines</h1>
      ${groupsHtml}
    </div>`;
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
  navOrder: string[];
  reminders: Reminder[];
  classLinks: Map<string, number>;
}

export function buildFilesHtml(data: FilesPageData): string {
  const {
    classFolders,
    filesByClass,
    uploadsByClass,
    generalUploads,
    googleConfigured,
    navVisibility,
    navOrder,
    reminders,
    classLinks,
  } = data;

  const rows = buildLibraryRows(classFolders, filesByClass, uploadsByClass, generalUploads);
  const libraryHtml =
    rows.length === 0 && classFolders.length === 0
      ? `<p class="empty">${
          googleConfigured
            ? "No classes set up yet. Add one in Settings."
            : "Not connected yet. Finish Google Drive setup, then add classes in Settings."
        }</p>`
      : renderLibraryTable(rows, "/donna/files", classFolders);

  const body = `
    <div class="file-library-layout">
      <div class="file-library">
        ${renderDeadlinesSection(classFolders, reminders, classLinks)}
        <div style="display:flex; align-items:center; justify-content:space-between; gap: var(--sp-2);">
          <h1 class="section-title" style="margin:0;">File Library</h1>
          <a class="btn-secondary btn-small" href="/donna/files?refresh=1" title="Re-check Drive for files added since the last load">Refresh</a>
        </div>
        ${libraryHtml}
      </div>

      <div class="action-panel">
        <h1 class="section-title">Upload a lecture recording</h1>
        <div class="hint">Select a class to associate the recording with, then choose your file.</div>
        <div class="upload-form">
          <select id="lecture-class">${renderClassOptions(classFolders)}</select>
          <input type="file" id="lecture-file" accept="audio/*" />
          <button class="btn btn-block" onclick="handleUpload('lecture', 'lecture-file', 'lecture-class', 'lecture-status', this)">Upload &amp; Transcribe</button>
          <div class="hint" id="lecture-status"></div>
        </div>

        <hr style="border: none; border-top: 1px solid var(--border); margin: 24px 0;" />

        <h1 class="section-title">Scan a photo or document</h1>
        <div class="hint">Select a class to associate the scan with, then choose your file.</div>
        <div class="upload-form">
          <select id="photo-class">${renderClassOptions(classFolders)}</select>
          <input type="file" id="photo-file" accept="image/*" />
          <button class="btn btn-block" onclick="handleUpload('photo', 'photo-file', 'photo-class', 'photo-status', this)">Upload &amp; Extract Text</button>
          <div class="hint" id="photo-status"></div>
        </div>

        <hr style="border: none; border-top: 1px solid var(--border); margin: 24px 0;" />

        <h1 class="section-title">Upload a file</h1>
        <div class="hint">Any file type: PDF, slides, docs, whatever. Stored as-is, no transcription or text extraction. Mirrored to the class's Drive folder if one's selected${googleConfigured ? "" : " (once Drive write access is set up)"}.</div>
        <div class="upload-form">
          <select id="file-class">${renderClassOptions(classFolders)}</select>
          <input type="file" id="file-file" />
          <button class="btn btn-block" onclick="handleUpload('file', 'file-file', 'file-class', 'file-status', this)">Upload</button>
          <div class="hint" id="file-status"></div>
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
    navOrder,
  });
}

// The search/sort behavior behind renderLibraryTable's controls — exported
// alongside it (see LibraryRow above) so schoolPage.ts's copy of the same
// table is actually functional instead of rendering inert search/sort
// controls with no script wired up to them.
export const FILE_TABLE_SCRIPT = `
  (function () {
    const searchInput = document.getElementById("file-search");
    const classFilter = document.getElementById("file-class-filter");
    const tbody = document.getElementById("file-table-body");
    if (!tbody) return;

    const editToggle = document.getElementById("file-table-edit-toggle");
    const table = document.getElementById("file-table");
    if (editToggle && table) {
      editToggle.addEventListener("click", function () {
        const editing = table.classList.toggle("file-table-editing");
        editToggle.textContent = editing ? "Done" : "Edit Files";
      });
    }

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

const CLIENT_SCRIPT = `
  async function handleUpload(kind, fileInputId, classSelectId, statusId, btn) {
    const fileInput = document.getElementById(fileInputId);
    const classSelect = document.getElementById(classSelectId);
    const statusEl = document.getElementById(statusId);
    const file = fileInput.files[0];
    if (!file) {
      statusEl.textContent = "Choose a file first.";
      return;
    }

    // Disabled for the whole upload+process round trip, not just
    // re-enabled at the end — this is a custom fetch flow, not a form
    // submit the router's own disable-on-submit handling would catch, and
    // a click during "Processing…" would kick off a second transcription/
    // OCR pass on the same file rather than just resubmitting a form.
    if (btn) btn.disabled = true;
    statusEl.textContent = "Uploading…";
    const classId = classSelect.value ? Number(classSelect.value) : null;

    try {
      const initRes = await fetch("/api/donna-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "init", filename: file.name, kind, classId }),
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
      const completeRes = await fetch("/api/donna-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "complete", uploadId: initData.uploadId }),
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
    } finally {
      if (btn) btn.disabled = false;
    }
  }
` + FILE_TABLE_SCRIPT;
