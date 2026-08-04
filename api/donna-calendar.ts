import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadSettings } from "../src/config.js";
import { resolveTimezone, dayBounds, localDateKey, localWeekdayIndex } from "../src/util/time.js";
import { getEventsInRange, type CalendarEvent } from "../src/calendar.js";
import { buildCalendarHtml, type CalendarDayGroup } from "../src/donna/calendarPage.js";
import { requireAuth } from "../src/auth/session.js";
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

const DAYS_PER_WEEK = 7;

// Steps a day at a time (rather than adding days*86400000ms in one shot)
// so each step re-resolves the timezone offset via dayBounds — the same
// self-correcting technique this file already used for its old rolling
// 14-day window, generalized here to also go backwards (negative `days`)
// for "previous week" navigation. A raw ms offset over a multi-day span
// can land on the wrong local date across a DST transition; this can't.
function addLocalDays(from: Date, days: number, timezone: string): Date {
  let cursor = from;
  const step = days >= 0 ? 1 : -1;
  for (let i = 0; i < Math.abs(days); i++) {
    const { start, end } = dayBounds(cursor, timezone);
    cursor = step > 0 ? new Date(end.getTime() + 1) : new Date(start.getTime() - 1);
  }
  return dayBounds(cursor, timezone).start;
}

async function handleCalendarPage(req: VercelRequest, res: VercelResponse) {
  const settings = await loadSettings();
  const timezone = resolveTimezone(settings.timezone);

  const parsedOffset = Number(req.query.week);
  const weekOffset = Number.isFinite(parsedOffset) ? Math.trunc(parsedOffset) : 0;

  const { start: todayStart } = dayBounds(new Date(), timezone);
  const todayKey = localDateKey(todayStart, timezone);
  const currentWeekSunday = addLocalDays(todayStart, -localWeekdayIndex(todayStart, timezone), timezone);
  const weekStart = addLocalDays(currentWeekSunday, weekOffset * DAYS_PER_WEEK, timezone);

  const dayStarts: Date[] = [];
  let cursor = weekStart;
  for (let i = 0; i < DAYS_PER_WEEK; i++) {
    dayStarts.push(cursor);
    const { end } = dayBounds(cursor, timezone);
    cursor = new Date(end.getTime() + 1);
  }

  const rangeStart = dayStarts[0];
  const rangeEnd = new Date(dayStarts[dayStarts.length - 1].getTime() + 24 * 60 * 60 * 1000);

  let events: CalendarEvent[] = [];
  let configured = true;
  try {
    const result = await getEventsInRange(timezone, rangeStart, rangeEnd);
    events = result.events;
  } catch (err) {
    configured = false;
  }

  const days: CalendarDayGroup[] = dayStarts.map((start, i) => {
    const nextStart = dayStarts[i + 1] ?? new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const dayEvents = events.filter((e) => e.start >= start && e.start < nextStart);
    const dateKey = localDateKey(start, timezone);
    const dateLabel = start.toLocaleDateString("en-US", {
      timeZone: timezone,
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    return { dateLabel, dateKey, events: dayEvents, isToday: dateKey === todayKey };
  });

  const weekLabel = `${dayStarts[0].toLocaleDateString("en-US", { timeZone: timezone, month: "short", day: "numeric" })} – ${dayStarts[6].toLocaleDateString("en-US", { timeZone: timezone, month: "short", day: "numeric" })}`;

  const html = buildCalendarHtml({
    days,
    weekLabel,
    weekOffset,
    timezone,
    configured,
    navVisibility: settings.dashboardConfig.navVisibility,
    navOrder: settings.dashboardConfig.navOrder,
  });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}

async function handleFilesPage(req: VercelRequest, res: VercelResponse) {
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

// Shares class_folders/uploads data with the Files page above, which is
// why it's grouped in this same function rather than off on its own. The
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

// Calendar, Files, and School folded into one function (Vercel Hobby's
// 12-function cap) — Files/School were already merged; Calendar joins them
// here since real traffic to any of the three now keeps all three warm.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!(await requireAuth(req, res))) return;

  if (req.query.page === "school") {
    await handleSchoolPage(req, res);
    return;
  }
  if (req.query.page === "files") {
    await handleFilesPage(req, res);
    return;
  }

  await handleCalendarPage(req, res);
}
