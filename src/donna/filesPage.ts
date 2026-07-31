import type { ClassFolder } from "../drive/classFolders.js";
import type { DriveFile } from "../drive/list.js";
import type { Upload } from "../storage/uploads.js";
import { escapeHtml } from "../util/html.js";
import { BASE_STYLES } from "./styles.js";
import { renderNav, PWA_HEAD } from "./nav.js";

function renderUpload(u: Upload): string {
  const statusLabel =
    u.status === "done" ? "Done" : u.status === "failed" ? "Failed" : "Processing";
  const body =
    u.status === "done"
      ? `<div class="upload-notes">${escapeHtml(u.notes ?? "")}</div>`
      : u.status === "failed"
        ? `<div class="upload-notes">${escapeHtml(u.error ?? "Something went wrong.")}</div>`
        : "";

  return `
    <div class="upload-item">
      <div class="upload-status">${statusLabel} — ${escapeHtml(u.originalFilename)}</div>
      ${body}
    </div>`;
}

function renderClassBlock(
  cls: ClassFolder,
  files: DriveFile[],
  uploads: Upload[]
): string {
  const fileList = files.length
    ? `<ul class="file-list">${files
        .map(
          (f) =>
            `<li><a href="${escapeHtml(f.webViewLink)}" target="_blank" rel="noopener noreferrer">${escapeHtml(f.name)}</a></li>`
        )
        .join("")}</ul>`
    : `<p class="empty">No Drive files yet.</p>`;

  const uploadsList = uploads.length
    ? uploads.map(renderUpload).join("\n")
    : "";

  return `
    <div class="class-block">
      <div class="class-title">${escapeHtml(cls.className)}</div>
      ${fileList}
      ${uploadsList}
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
  googleConfigured: boolean;
}

export function buildFilesHtml(data: FilesPageData): string {
  const { classFolders, filesByClass, uploadsByClass, googleConfigured } = data;

  const classesHtml = classFolders.length
    ? classFolders
        .map((cls) => renderClassBlock(cls, filesByClass[cls.id] ?? [], uploadsByClass[cls.id] ?? []))
        .join("\n")
    : `<p class="empty">${
        googleConfigured
          ? "No classes set up yet — add one in Settings."
          : "Not connected yet — finish Google Drive setup, then add classes in Settings."
      }</p>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Donna Files</title>
${PWA_HEAD}
<style>
${BASE_STYLES}
</style>
</head>
<body>
  <header class="masthead">
    <div class="masthead-inner">
      <div class="wordmark">Donna</div>
    </div>
    <nav class="tab-bar">${renderNav("files")}</nav>
  </header>

  <main class="content">
    <section class="section">
      <h1 class="section-title">Classes</h1>
      ${classesHtml}
    </section>

    <section class="section">
      <h1 class="section-title">Upload a lecture recording</h1>
      <div class="upload-form">
        <select id="lecture-class">${renderClassOptions(classFolders)}</select>
        <input type="file" id="lecture-file" accept="audio/*" />
        <button class="btn" onclick="handleUpload('lecture', 'lecture-file', 'lecture-class', 'lecture-status')">Upload &amp; transcribe</button>
        <div class="hint" id="lecture-status"></div>
      </div>
    </section>

    <section class="section">
      <h1 class="section-title">Scan a photo or document</h1>
      <div class="upload-form">
        <select id="photo-class">${renderClassOptions(classFolders)}</select>
        <input type="file" id="photo-file" accept="image/*" />
        <button class="btn" onclick="handleUpload('photo', 'photo-file', 'photo-class', 'photo-status')">Upload &amp; extract text</button>
        <div class="hint" id="photo-status"></div>
      </div>
    </section>
  </main>

  <script>
${CLIENT_SCRIPT}
  </script>
</body>
</html>`;
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

      statusEl.textContent = "Processing…";
      fetch("/api/donna-upload-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId: initData.uploadId }),
      });

      pollStatus(initData.uploadId, statusEl);
    } catch (err) {
      statusEl.textContent = "Something went wrong.";
    }
  }

  async function pollStatus(uploadId, statusEl) {
    try {
      const res = await fetch("/api/donna-upload-status?id=" + uploadId);
      const data = await res.json();
      if (data.status === "done") {
        statusEl.textContent = "Done! Reloading…";
        setTimeout(() => location.reload(), 1000);
      } else if (data.status === "failed") {
        statusEl.textContent = "Failed: " + (data.error || "unknown error");
      } else {
        setTimeout(() => pollStatus(uploadId, statusEl), 3000);
      }
    } catch (err) {
      setTimeout(() => pollStatus(uploadId, statusEl), 5000);
    }
  }
`;
