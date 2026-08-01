import type { NavVisibility } from "../config.js";
import type { ClassFolder } from "../drive/classFolders.js";
import type { Upload } from "../storage/uploads.js";
import type { Flashcard } from "../school/flashcards.js";
import { escapeHtml } from "../util/html.js";
import { renderLayout } from "./layout.js";

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
  return `
    <div class="agenda-event-row">
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
  return `
    <details class="card" style="margin-bottom: var(--sp-2);">
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

export interface SchoolPageData {
  classFolders: ClassFolder[];
  activeClass: ClassFolder | null;
  uploads: Upload[];
  dueFlashcards: Flashcard[];
  otherFlashcards: Flashcard[];
  navVisibility: NavVisibility;
  navOrder: string[];
}

export function buildSchoolHtml(data: SchoolPageData): string {
  const { classFolders, activeClass, uploads, dueFlashcards, otherFlashcards, navVisibility, navOrder } = data;

  if (classFolders.length === 0) {
    return renderLayout({
      title: "Donna — School",
      activeTab: "school",
      bodyHtml: `
        <div class="section">
          <h1 class="page-title">School</h1>
          <p class="page-sub">No classes set up yet</p>
        </div>
        <p class="empty">Add a class and its Drive folder from <a href="/donna/settings">Settings</a> first — School auto-loads that folder's files as study context.</p>`,
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
    </div>

    <div class="home-tabs">${renderClassTabs(classFolders, cls.id)}</div>

    <div class="card" style="margin-top: var(--sp-3); display:flex; align-items:center; justify-content:space-between;">
      <p style="margin:0;">Ask questions, get practice problems, or work through material for ${escapeHtml(cls.className)} — the chat auto-loads this class's Drive files as context.</p>
      <a class="btn" href="/donna/chat?mode=school&classId=${cls.id}">Chat about ${escapeHtml(cls.className)}</a>
    </div>

    <div class="section" style="margin-top: var(--sp-3);">
      <h1 class="section-title">Flashcards${dueFlashcards.length > 0 ? ` — ${dueFlashcards.length} due` : ""}</h1>
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
      <h1 class="section-title">Lecture Uploads</h1>
      ${uploads.length === 0 ? `<p class="empty">No lecture uploads for ${escapeHtml(cls.className)} yet — upload one from the Files page.</p>` : uploads.map(renderUploadRow).join("\n")}
    </div>`;

  return renderLayout({
    title: "Donna — School",
    activeTab: "school",
    bodyHtml: body,
    showChatFab: true,
    navVisibility,
    navOrder,
  });
}
