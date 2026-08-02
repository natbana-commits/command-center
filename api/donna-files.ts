import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadSettings } from "../src/config.js";
import { getClassFolders } from "../src/drive/classFolders.js";
import { listFilesInFolder, type DriveFile } from "../src/drive/list.js";
import { getUploadsForClass, getGeneralUploads, getUpload, type Upload } from "../src/storage/uploads.js";
import { isGoogleConfigured } from "../src/google/auth.js";
import { listRemindersSafe } from "../src/google/tasks.js";
import { getClassLinksForTasks } from "../src/reminders/classLinks.js";
import { buildFilesHtml } from "../src/donna/filesPage.js";
import { buildSchoolHtml } from "../src/donna/schoolPage.js";
import { getFlashcardsForClass, createFlashcards, reviewFlashcard } from "../src/school/flashcards.js";
import { generateFlashcardsFromTranscript } from "../src/school/generateFlashcards.js";
import { logStudySession, getStudyStats } from "../src/school/studySessions.js";
import { resolveTimezone } from "../src/util/time.js";
import { requireAuth } from "../src/auth/session.js";

// School is folded into this file (rather than a new one) to stay under
// Vercel Hobby's 12-function cap — same "?page=" query-param branching
// used for login/logout/info in api/donna.ts. It lives here specifically
// because it shares class_folders/uploads data with the Files page. The
// per-class chat itself lives on the dedicated Chat tab (api/donna-chat.ts)
// instead of here — this page links out to it rather than embedding its
// own copy of the same conversation.
async function handleSchoolPage(req: VercelRequest, res: VercelResponse) {
  const classFolders = await getClassFolders();

  if (req.method === "POST") {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const action = body.action as string | undefined;

    try {
      if (action === "generate-flashcards") {
        const classId = Number(body.classId);
        const uploadId = Number(body.uploadId);
        const cls = classFolders.find((c) => c.id === classId);
        const upload = cls && Number.isFinite(uploadId) ? await getUpload(uploadId) : null;
        if (cls && upload?.transcript) {
          const cards = await generateFlashcardsFromTranscript(upload.transcript, cls.className);
          await createFlashcards(classId, uploadId, cards);
        }
        res.redirect(303, `/donna/school?classId=${classId}`);
        return;
      }

      if (action === "review-flashcard") {
        const flashcardId = Number(body.flashcardId);
        const classId = Number(body.classId);
        const gotIt = body.gotIt === "1" || body.gotIt === true;
        if (Number.isFinite(flashcardId)) {
          await reviewFlashcard(flashcardId, gotIt);
        }
        res.redirect(303, `/donna/school?classId=${classId}`);
        return;
      }

      if (action === "log-study-session") {
        const classId = Number(body.classId);
        const durationMinutes = Number(body.durationMinutes);
        if (Number.isFinite(classId) && Number.isFinite(durationMinutes) && durationMinutes > 0) {
          await logStudySession(classId, Math.round(durationMinutes));
        }
        res.redirect(303, `/donna/school?classId=${classId}`);
        return;
      }

      res.status(400).json({ error: "Unknown action" });
    } catch (err) {
      console.error("School action failed:", err);
      const classId = Number(body.classId);
      res.redirect(303, Number.isFinite(classId) ? `/donna/school?classId=${classId}` : "/donna/school");
    }
    return;
  }

  const settings = await loadSettings();

  if (classFolders.length === 0) {
    const html = buildSchoolHtml({
      classFolders: [],
      activeClass: null,
      uploads: [],
      dueFlashcards: [],
      otherFlashcards: [],
      studyStats: { streakDays: 0, weeklyMinutes: 0 },
      navVisibility: settings.dashboardConfig.navVisibility,
      navOrder: settings.dashboardConfig.navOrder,
    });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
    return;
  }

  const requestedClassId = typeof req.query.classId === "string" ? Number(req.query.classId) : undefined;
  const activeClass = classFolders.find((c) => c.id === requestedClassId) ?? classFolders[0];

  const [uploads, allFlashcards, studyStats] = await Promise.all([
    getUploadsForClass(activeClass.id).catch(() => []),
    getFlashcardsForClass(activeClass.id).catch(() => []),
    getStudyStats(activeClass.id, resolveTimezone(settings.timezone)).catch(() => ({ streakDays: 0, weeklyMinutes: 0 })),
  ]);

  const now = Date.now();
  const dueFlashcards = allFlashcards.filter((c) => !c.nextReviewAt || new Date(c.nextReviewAt).getTime() <= now);
  const otherFlashcards = allFlashcards.filter((c) => c.nextReviewAt && new Date(c.nextReviewAt).getTime() > now);

  const html = buildSchoolHtml({
    classFolders,
    activeClass,
    uploads,
    dueFlashcards,
    otherFlashcards,
    studyStats,
    navVisibility: settings.dashboardConfig.navVisibility,
    navOrder: settings.dashboardConfig.navOrder,
  });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!(await requireAuth(req, res))) return;

  if (req.query.page === "school") {
    await handleSchoolPage(req, res);
    return;
  }

  const googleConfigured = isGoogleConfigured();
  const [settings, classFolders, reminders] = await Promise.all([
    loadSettings(),
    getClassFolders(),
    listRemindersSafe(),
  ]);
  const classLinks = await getClassLinksForTasks(reminders.map((r) => r.id)).catch(() => new Map<string, number>());

  const filesByClass: Record<number, DriveFile[]> = {};
  const uploadsByClass: Record<number, Upload[]> = {};

  const [generalUploads] = await Promise.all([
    getGeneralUploads().catch(() => []),
    Promise.all(
      classFolders.map(async (cls) => {
        uploadsByClass[cls.id] = await getUploadsForClass(cls.id).catch(() => []);
        if (googleConfigured) {
          try {
            filesByClass[cls.id] = await listFilesInFolder(cls.driveFolderId);
          } catch (err) {
            console.error(`Failed to list files for ${cls.className}:`, err);
            filesByClass[cls.id] = [];
          }
        }
      })
    ),
  ]);

  const html = buildFilesHtml({
    classFolders,
    filesByClass,
    uploadsByClass,
    generalUploads,
    googleConfigured,
    navVisibility: settings.dashboardConfig.navVisibility,
    navOrder: settings.dashboardConfig.navOrder,
    reminders,
    classLinks,
  });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
