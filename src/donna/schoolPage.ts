import type { NavVisibility } from "../config.js";
import type { ClassFolder } from "../drive/classFolders.js";
import type { DriveFile } from "../drive/list.js";
import type { Upload } from "../storage/uploads.js";
import type { Flashcard } from "../school/flashcards.js";
import type { StudyStats } from "../school/studySessions.js";
import { escapeHtml } from "../util/html.js";
import { renderLayout } from "./layout.js";
import { renderPageEditLink } from "./editLink.js";
import { buildLibraryRows, renderLibraryTable, FILE_TABLE_SCRIPT } from "./filesPage.js";
import { iconChat, iconEdit, iconClock } from "./icons.js";
import { tileColorForSeed } from "./tileColor.js";

function tintStyle(tint: string): string {
  return `background-image: linear-gradient(135deg, ${tint} 0%, var(--card) 65%);`;
}

export interface ProjectPrepFileView {
  title: string;
  reason: string;
  link?: string;
}

export interface ProjectPrepView {
  description: string;
  error?: string;
  result?: {
    instructions: string;
    starterPrompt: string;
    files: ProjectPrepFileView[];
  };
}

function renderProjectPrepResult(result: NonNullable<ProjectPrepView["result"]>): string {
  const prepTint = tintStyle("var(--hw-markets-tint)");
  return `
    <div class="card" style="margin-top: var(--sp-2); ${prepTint}">
      <div style="display:flex; align-items:center; justify-content:space-between; gap: var(--sp-2);">
        <div class="card-title" style="margin:0;">Project Instructions</div>
        <button type="button" class="btn-secondary btn-small" onclick="copyPrepText(this, 'prep-instructions')">Copy</button>
      </div>
      <pre id="prep-instructions" style="white-space:pre-wrap; font-family:var(--sans); font-size:14px; margin: var(--sp-2) 0 0;">${escapeHtml(result.instructions)}</pre>
    </div>
    <div class="card" style="margin-top: var(--sp-2); ${prepTint}">
      <div style="display:flex; align-items:center; justify-content:space-between; gap: var(--sp-2);">
        <div class="card-title" style="margin:0;">Starter Prompt</div>
        <button type="button" class="btn-secondary btn-small" onclick="copyPrepText(this, 'prep-starter')">Copy</button>
      </div>
      <pre id="prep-starter" style="white-space:pre-wrap; font-family:var(--sans); font-size:14px; margin: var(--sp-2) 0 0;">${escapeHtml(result.starterPrompt)}</pre>
    </div>
    <div class="card" style="margin-top: var(--sp-2); ${prepTint}">
      <div class="card-title">Files to attach</div>
      ${
        result.files.length === 0
          ? `<p class="empty">No specific files picked. Attach whatever feels relevant, or none.</p>`
          : result.files
              .map(
                (f) => `
        <div style="padding: 8px 0; border-bottom: 1px solid var(--border);">
          <div style="font-weight:500;">${f.link ? `<a href="${escapeHtml(f.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(f.title)}</a>` : escapeHtml(f.title)}</div>
          <div class="hint" style="margin-top:2px;">${escapeHtml(f.reason)}</div>
        </div>`
              )
              .join("\n")
      }
    </div>`;
}

function renderProjectPrep(classId: number, view: ProjectPrepView | undefined): string {
  return `
    <div class="section" style="margin-top: var(--sp-3);" id="school-project-prep">
      <div class="fw-tile-head">
        <div class="fw-icon" style="--accent: var(--hw-markets);">${iconEdit}</div>
        <h1 class="section-title" style="margin:0;">Prep a Project</h1>
      </div>
      <p class="hint" style="margin-top:0; margin-bottom: var(--sp-2);">Describe an assignment or task, and Donna finds the relevant files here and writes tailored instructions plus a starter prompt for a new Claude.ai Project.</p>
      <form method="POST" action="/donna/school" data-swap-target="school-project-prep" class="card" style="${tintStyle("var(--hw-markets-tint)")}">
        <input type="hidden" name="action" value="prep-project" />
        <input type="hidden" name="classId" value="${classId}" />
        <textarea name="description" placeholder="e.g. Problem set 4, covers monetary policy and the IS-LM model" required style="min-height:70px; width:100%; padding:9px 12px; border:1px solid var(--border); border-radius:8px; font-size:14px; font-family:var(--sans); background:var(--card); color:var(--ink);">${view ? escapeHtml(view.description) : ""}</textarea>
        <button class="btn" type="submit" style="margin-top: var(--sp-2);">Prep it</button>
      </form>
      ${view?.error ? `<p class="hint" style="color:var(--danger); margin-top: var(--sp-2);">${escapeHtml(view.error)}</p>` : ""}
      ${view?.result ? renderProjectPrepResult(view.result) : ""}
    </div>`;
}

function renderClassTabs(classFolders: ClassFolder[], activeClassId: number): string {
  return classFolders
    .map(
      (c) =>
        `<a class="home-tab-btn${c.id === activeClassId ? " home-tab-btn-active" : ""}" href="/donna/school?classId=${c.id}">${escapeHtml(c.className)}</a>`
    )
    .join("");
}

function renderUploadRow(u: Upload): string {
  const canGenerate = u.status === "done" && u.transcript;
  const { tint } = tileColorForSeed(String(u.id));
  return `
    <div class="agenda-event-row" style="border-radius:8px; padding:10px 8px; margin-bottom:4px; ${tintStyle(tint)}">
      <div class="agenda-event-title">${escapeHtml(u.originalFilename)}</div>
      ${
        canGenerate
          ? `<form method="POST" action="/donna/school">
              <input type="hidden" name="action" value="generate-flashcards" />
              <input type="hidden" name="classId" value="${u.classId}" />
              <input type="hidden" name="uploadId" value="${u.id}" />
              <button type="submit" class="btn btn-secondary btn-small">Generate flashcards</button>
            </form>`
          : `<span class="hint">${u.status === "done" ? "No transcript to generate from" : "Processing…"}</span>`
      }
    </div>`;
}

function renderFlashcard(card: Flashcard, classId: number, isDue: boolean): string {
  const { tint } = tileColorForSeed(String(card.id));
  return `
    <details class="card" style="margin-bottom: var(--sp-2); ${tintStyle(tint)}">
      <summary>${escapeHtml(card.question)}</summary>
      <p style="margin: var(--sp-2) 0;">${escapeHtml(card.answer)}</p>
      ${
        isDue
          ? `<div style="display:flex; gap: var(--sp-2);">
              <form method="POST" action="/donna/school">
                <input type="hidden" name="action" value="review-flashcard" />
                <input type="hidden" name="classId" value="${classId}" />
                <input type="hidden" name="flashcardId" value="${card.id}" />
                <input type="hidden" name="gotIt" value="1" />
                <button type="submit" class="btn btn-small">Got it</button>
              </form>
              <form method="POST" action="/donna/school">
                <input type="hidden" name="action" value="review-flashcard" />
                <input type="hidden" name="classId" value="${classId}" />
                <input type="hidden" name="flashcardId" value="${card.id}" />
                <input type="hidden" name="gotIt" value="0" />
                <button type="submit" class="btn btn-danger btn-small">Missed it</button>
              </form>
            </div>`
          : `<span class="hint">Reviewed ${card.reviewCount} time${card.reviewCount === 1 ? "" : "s"} · next due ${card.nextReviewAt ? new Date(card.nextReviewAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "now"}</span>`
      }
    </details>`;
}

function renderStudyTimer(classId: number, stats: StudyStats): string {
  const streakLabel = stats.streakDays > 0 ? `${stats.streakDays} day${stats.streakDays === 1 ? "" : "s"} streak` : "No streak yet";
  return `
    <div class="card" style="margin-top: var(--sp-3); ${tintStyle("var(--hw-activity-tint)")}" id="study-timer" data-class-id="${classId}">
      <div class="card-header">
        <div class="fw-icon" style="--accent: var(--hw-activity);">${iconClock}</div>
        <h2 class="section-title" style="margin:0;">Study Timer</h2>
      </div>
      <p style="font-family: var(--mono); font-size: 32px; margin: 0 0 12px;" id="timer-display">00:00</p>
      <div style="display:flex; gap: 8px;">
        <button type="button" class="btn" id="timer-start-btn">Start</button>
        <button type="button" class="btn-secondary" id="timer-pause-btn" style="display:none;">Pause</button>
        <button type="button" class="btn-secondary" id="timer-resume-btn" style="display:none;">Resume</button>
        <button type="button" class="btn-danger" id="timer-finish-btn">Finish</button>
      </div>
      <p class="hint" style="margin-top: 8px;">${escapeHtml(streakLabel)} · ${stats.weeklyMinutes} min this week</p>
    </div>`;
}

export interface SchoolPageData {
  classFolders: ClassFolder[];
  activeClass: ClassFolder | null;
  uploads: Upload[];
  driveFiles: DriveFile[];
  dueFlashcards: Flashcard[];
  otherFlashcards: Flashcard[];
  studyStats: StudyStats;
  navVisibility: NavVisibility;
  navOrder: string[];
  projectPrep?: ProjectPrepView;
}

export function buildSchoolHtml(data: SchoolPageData): string {
  const { classFolders, activeClass, uploads, driveFiles, dueFlashcards, otherFlashcards, studyStats, navVisibility, navOrder, projectPrep } = data;

  if (classFolders.length === 0) {
    return renderLayout({
      title: "Donna · School",
      activeTab: "school",
      bodyHtml: `
        <div class="section">
          <h1 class="page-title">School</h1>
          <p class="page-sub">No classes set up yet</p>
        </div>
        <p class="empty">Add a class and its Drive folder from <a href="/donna/settings">Settings</a> first. School auto-loads that folder's files as study context.</p>`,
      showChatFab: true,
      navVisibility,
      navOrder,
    });
  }

  const cls = activeClass!;

  const body = `
    <div class="section">
      <h1 class="page-title">School</h1>
      <p class="page-sub">Studying for ${escapeHtml(cls.className)}</p>
      ${renderPageEditLink("settings-classes", "Classes")}
    </div>

    <div class="home-tabs">${renderClassTabs(classFolders, cls.id)}</div>

    <div class="card" style="margin-top: var(--sp-3); display:flex; align-items:center; justify-content:space-between; gap: var(--sp-2); ${tintStyle("var(--hw-classes-tint)")}">
      <div style="display:flex; align-items:center; gap:12px; min-width:0;">
        <div class="fw-icon" style="--accent: var(--hw-classes);">${iconChat}</div>
        <p style="margin:0;">Ask questions, get practice problems, or work through material for ${escapeHtml(cls.className)}. The chat auto-loads this class's Drive files as context.</p>
      </div>
      <a class="btn" href="/donna/chat?mode=school&classId=${cls.id}" style="flex:0 0 auto;">Chat about ${escapeHtml(cls.className)}</a>
    </div>

    ${renderProjectPrep(cls.id, projectPrep)}

    ${renderStudyTimer(cls.id, studyStats)}

    <div class="section" style="margin-top: var(--sp-3);">
      <h1 class="section-title">Flashcards${dueFlashcards.length > 0 ? ` · ${dueFlashcards.length} due` : ""}</h1>
      ${
        dueFlashcards.length === 0
          ? `<p class="empty">Nothing due right now.</p>`
          : dueFlashcards.map((c) => renderFlashcard(c, cls.id, true)).join("\n")
      }
      ${
        otherFlashcards.length > 0
          ? `<details style="margin-top: var(--sp-2);">
              <summary class="hint">${otherFlashcards.length} more card${otherFlashcards.length === 1 ? "" : "s"} not due yet</summary>
              ${otherFlashcards.map((c) => renderFlashcard(c, cls.id, false)).join("\n")}
            </details>`
          : ""
      }
    </div>

    <div class="section" style="margin-top: var(--sp-3);">
      <h1 class="section-title">Files</h1>
      ${renderLibraryTable(buildLibraryRows([cls], { [cls.id]: driveFiles }, { [cls.id]: uploads }, []), `/donna/school?classId=${cls.id}`, classFolders)}
    </div>

    <div class="section" style="margin-top: var(--sp-3);">
      <h1 class="section-title">Lecture Uploads</h1>
      <p class="hint" style="margin-top:-8px; margin-bottom: var(--sp-2);">Transcribed lectures can generate flashcards below. Everything else for ${escapeHtml(cls.className)} (including plain Drive files) is in Files above.</p>
      ${uploads.length === 0 ? `<p class="empty">No lecture uploads for ${escapeHtml(cls.className)} yet. Upload one from the Files page.</p>` : uploads.map(renderUploadRow).join("\n")}
    </div>`;

  return renderLayout({
    title: "Donna · School",
    activeTab: "school",
    bodyHtml: body,
    showChatFab: true,
    navVisibility,
    navOrder,
    pageScript: STUDY_TIMER_SCRIPT + FILE_TABLE_SCRIPT + PROJECT_PREP_SCRIPT,
  });
}

const PROJECT_PREP_SCRIPT = `
function copyPrepText(btn, elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  const original = btn.textContent;
  navigator.clipboard
    .writeText(el.textContent)
    .then(function () {
      btn.textContent = "Copied!";
      setTimeout(function () { btn.textContent = original; }, 1500);
    })
    .catch(function () {
      btn.textContent = "Copy failed";
      setTimeout(function () { btn.textContent = original; }, 1500);
    });
}
`;

// Deliberately client-side-only: an in-progress or paused timer lives
// entirely in page state and is lost on refresh — only a session that
// actually finishes (5+ minutes) gets POSTed and persisted. No periodic
// autosave, no resume-after-reload; that's the tradeoff Nathan chose over
// a server-persisted timer that survives a closed tab.
const STUDY_TIMER_SCRIPT = `
(function () {
  const root = document.getElementById("study-timer");
  if (!root) return;
  const classId = root.dataset.classId;
  const display = document.getElementById("timer-display");
  const startBtn = document.getElementById("timer-start-btn");
  const pauseBtn = document.getElementById("timer-pause-btn");
  const resumeBtn = document.getElementById("timer-resume-btn");
  const finishBtn = document.getElementById("timer-finish-btn");

  let seconds = 0;
  let intervalId = null;

  function render() {
    const m = String(Math.floor(seconds / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    display.textContent = m + ":" + s;
  }

  function start() {
    if (intervalId) return;
    intervalId = setInterval(() => { seconds++; render(); }, 1000);
    startBtn.style.display = "none";
    pauseBtn.style.display = "";
    resumeBtn.style.display = "none";
  }

  function pause() {
    clearInterval(intervalId);
    intervalId = null;
    pauseBtn.style.display = "none";
    resumeBtn.style.display = "";
  }

  async function finish() {
    clearInterval(intervalId);
    intervalId = null;
    const minutes = Math.floor(seconds / 60);
    if (minutes >= 5) {
      finishBtn.disabled = true;
      finishBtn.textContent = "Saving…";
      try {
        await fetch("/donna/school", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: "action=log-study-session&classId=" + encodeURIComponent(classId) + "&durationMinutes=" + minutes,
        });
      } catch (err) {
        // Fall through to reload regardless — worst case the session
        // wasn't logged and the streak/weekly total just won't reflect it.
      }
      window.location.reload();
    } else {
      seconds = 0;
      render();
      startBtn.style.display = "";
      pauseBtn.style.display = "none";
      resumeBtn.style.display = "none";
    }
  }

  startBtn.addEventListener("click", start);
  pauseBtn.addEventListener("click", pause);
  resumeBtn.addEventListener("click", start);
  finishBtn.addEventListener("click", finish);
  render();
})();
`;
