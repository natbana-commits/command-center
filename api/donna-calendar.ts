import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadSettings } from "../src/config.js";
import { resolveTimezone, dayBounds, localDateKey, localWeekdayIndex } from "../src/util/time.js";
import { getEventsInRange, type CalendarEvent } from "../src/calendar.js";
import { buildCalendarHtml, type CalendarDayGroup, type CalendarView } from "../src/donna/calendarPage.js";
import { requireAuth } from "../src/auth/session.js";
import { getClassFolders } from "../src/drive/classFolders.js";
import { listFilesInFolder, type DriveFile } from "../src/drive/list.js";
import { getUploadsForClass, getGeneralUploads, getUpload, deleteUpload, updateUpload, type Upload } from "../src/storage/uploads.js";
import { isGoogleConfigured } from "../src/google/auth.js";
import { listRemindersSafe } from "../src/google/tasks.js";
import { getClassLinksForTasks } from "../src/reminders/classLinks.js";
import { getPendingNotificationsForTasks } from "../src/reminders/notifications.js";
import { buildFilesHtml } from "../src/donna/filesPage.js";
import { invalidateCache } from "../src/util/cache.js";
import { buildSchoolHtml, type ProjectPrepView, type ProjectPrepFileView } from "../src/donna/schoolPage.js";
import { getFlashcardsForClass, createFlashcards, reviewFlashcard } from "../src/school/flashcards.js";
import { generateFlashcardsFromTranscript } from "../src/school/generateFlashcards.js";
import { logStudySession, getStudyStats } from "../src/school/studySessions.js";
import { generateProjectPrep, type ProjectPrepFileCandidate } from "../src/school/generateProjectPrep.js";
import type { ClassFolder } from "../src/drive/classFolders.js";
import type { Settings } from "../src/config.js";

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

// Groups a contiguous run of day-starts against a flat event list — shared
// by all three views, which differ only in how many days they cover and
// where the range starts.
function groupEventsByDay(dayStarts: Date[], events: CalendarEvent[], timezone: string, todayKey: string): CalendarDayGroup[] {
  return dayStarts.map((start, i) => {
    const nextStart = dayStarts[i + 1] ?? new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const dayEvents = events.filter((e) => e.start >= start && e.start < nextStart);
    const dateKey = localDateKey(start, timezone);
    const dateLabel = start.toLocaleDateString("en-US", { timeZone: timezone, weekday: "long", month: "long", day: "numeric" });
    return { dateLabel, dateKey, events: dayEvents, isToday: dateKey === todayKey };
  });
}

async function handleCalendarPage(req: VercelRequest, res: VercelResponse, settingsPromise: Promise<Settings>) {
  // Has no dependency on settings/timezone/the ICS fetch below — kicked
  // off immediately so its latency overlaps theirs instead of stacking
  // after them (this used to be the very next thing awaited after the
  // whole view-specific ICS fetch completed).
  const remindersPromise = listRemindersSafe();

  const settings = await settingsPromise;
  const timezone = resolveTimezone(settings.timezone);

  // The whole ICS feed is cached under one key for 2 minutes (fetching it
  // is free — a plain HTTP GET, no API cost — this is just to avoid
  // re-fetching on every page load). ?refresh=1 clears it so an event
  // added moments ago on your phone shows up immediately instead of
  // waiting out the cache.
  if (req.query.refresh === "1") {
    await invalidateCache("calendar:ics");
  }

  const rawView = typeof req.query.view === "string" ? req.query.view : "day";
  const view: CalendarView = rawView === "week" || rawView === "month" ? rawView : "day";

  const { start: todayStart } = dayBounds(new Date(), timezone);
  const todayKey = localDateKey(todayStart, timezone);

  let offset = 0;
  let headerLabel = "";
  let days: CalendarDayGroup[] = [];
  let monthWeeks: CalendarDayGroup[][] = [];
  let configured = true;

  if (view === "day") {
    // A month-grid cell click passes an absolute ?date=; Prev/Next passes a
    // relative ?day= offset from today. Either way, the resulting offset is
    // recomputed from today so this page's own Prev/Next links keep working
    // in relative terms regardless of how the day was reached. Shows the
    // target day plus the next one — a rolling 2-day window, so Prev/Next
    // (stepping the offset by 1, unchanged) scrolls smoothly a day at a
    // time rather than jumping in non-overlapping pairs.
    const dateParam = typeof req.query.date === "string" ? req.query.date : undefined;
    const targetStart =
      dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
        ? dayBounds(new Date(`${dateParam}T12:00:00`), timezone).start
        : addLocalDays(todayStart, Number.isFinite(Number(req.query.day)) ? Math.trunc(Number(req.query.day)) : 0, timezone);
    offset = Math.round((targetStart.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000));
    const secondDayStart = addLocalDays(targetStart, 1, timezone);

    const rangeEnd = new Date(secondDayStart.getTime() + 24 * 60 * 60 * 1000);
    let events: CalendarEvent[] = [];
    try {
      events = (await getEventsInRange(timezone, targetStart, rangeEnd)).events;
    } catch {
      configured = false;
    }
    days = groupEventsByDay([targetStart, secondDayStart], events, timezone, todayKey);
    // Short form ("Aug 4 – Aug 5") for the page header — the full weekday
    // names are already shown in each day column's own mini header below.
    headerLabel = `${targetStart.toLocaleDateString("en-US", { timeZone: timezone, month: "short", day: "numeric" })} – ${secondDayStart.toLocaleDateString("en-US", { timeZone: timezone, month: "short", day: "numeric" })}`;
  } else if (view === "month") {
    const parsedMonthOffset = Number(req.query.month);
    const monthOffset = Number.isFinite(parsedMonthOffset) ? Math.trunc(parsedMonthOffset) : 0;
    offset = monthOffset;

    const [todayY, todayM] = localDateKey(todayStart, timezone).split("-").map(Number);
    const totalMonths = todayM - 1 + monthOffset;
    const targetYear = todayY + Math.floor(totalMonths / 12);
    const targetMonth1 = (((totalMonths % 12) + 12) % 12) + 1;
    const firstOfMonthKey = `${targetYear}-${String(targetMonth1).padStart(2, "0")}-01`;
    const firstOfMonthStart = dayBounds(new Date(`${firstOfMonthKey}T12:00:00`), timezone).start;

    const gridStart = addLocalDays(firstOfMonthStart, -localWeekdayIndex(firstOfMonthStart, timezone), timezone);
    const CELLS = 42; // 6 weeks × 7 days — always enough to cover any month's grid
    const monthDayStarts: Date[] = [];
    let cursor = gridStart;
    for (let i = 0; i < CELLS; i++) {
      monthDayStarts.push(cursor);
      const { end } = dayBounds(cursor, timezone);
      cursor = new Date(end.getTime() + 1);
    }

    const rangeStart = monthDayStarts[0];
    const rangeEnd = new Date(monthDayStarts[CELLS - 1].getTime() + 24 * 60 * 60 * 1000);
    let events: CalendarEvent[] = [];
    try {
      events = (await getEventsInRange(timezone, rangeStart, rangeEnd)).events;
    } catch {
      configured = false;
    }

    const monthDayGroups = groupEventsByDay(monthDayStarts, events, timezone, todayKey).map((d) => ({
      ...d,
      inCurrentMonth: d.dateKey.slice(0, 7) === firstOfMonthKey.slice(0, 7),
    }));
    for (let i = 0; i < CELLS; i += 7) monthWeeks.push(monthDayGroups.slice(i, i + 7));
    headerLabel = firstOfMonthStart.toLocaleDateString("en-US", { timeZone: timezone, month: "long", year: "numeric" });
  } else {
    const parsedOffset = Number(req.query.week);
    const weekOffset = Number.isFinite(parsedOffset) ? Math.trunc(parsedOffset) : 0;
    offset = weekOffset;

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
    try {
      events = (await getEventsInRange(timezone, rangeStart, rangeEnd)).events;
    } catch {
      configured = false;
    }
    days = groupEventsByDay(dayStarts, events, timezone, todayKey);
    headerLabel = `${dayStarts[0].toLocaleDateString("en-US", { timeZone: timezone, month: "short", day: "numeric" })} – ${dayStarts[6].toLocaleDateString("en-US", { timeZone: timezone, month: "short", day: "numeric" })}`;
  }

  const todayReminders = await remindersPromise;
  const reminderNotifications = await getPendingNotificationsForTasks(todayReminders.map((r) => r.id)).catch(
    () => new Map()
  );

  const html = buildCalendarHtml({
    view,
    offset,
    headerLabel,
    days,
    monthWeeks,
    timezone,
    configured,
    todayReminders,
    reminderNotifications,
    navVisibility: settings.dashboardConfig.navVisibility,
    navOrder: settings.dashboardConfig.navOrder,
  });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}

async function buildProjectPrepView(
  cls: ClassFolder,
  description: string,
  googleConfigured: boolean
): Promise<ProjectPrepView> {
  const [driveFiles, uploads] = await Promise.all([
    googleConfigured ? listFilesInFolder(cls.driveFolderId).catch(() => []) : Promise.resolve([]),
    getUploadsForClass(cls.id).catch(() => []),
  ]);

  const candidates: ProjectPrepFileCandidate[] = [
    ...driveFiles.map((f) => ({ id: `drive:${f.id}`, title: f.name })),
    ...uploads.map((u) => ({
      id: `upload:${u.id}`,
      title: u.originalFilename,
      snippet: u.transcript ?? u.notes ?? undefined,
    })),
  ];

  const result = await generateProjectPrep(description, cls.className, candidates);

  const driveById = new Map(driveFiles.map((f) => [`drive:${f.id}`, f]));
  const uploadById = new Map(uploads.map((u) => [`upload:${u.id}`, u]));
  const files: ProjectPrepFileView[] = result.selectedFileIds.map(({ id, reason }) => {
    const driveFile = driveById.get(id);
    if (driveFile) return { title: driveFile.name, reason, link: driveFile.webViewLink };
    const upload = uploadById.get(id);
    if (upload) return { title: upload.originalFilename, reason, link: upload.status === "done" ? `/api/donna-upload?view=${upload.id}` : undefined };
    return { title: id, reason };
  });

  return { description, result: { instructions: result.instructions, starterPrompt: result.starterPrompt, files } };
}

// Shares class_folders/uploads data with the Files page above, which is
// why it's grouped in this same function rather than off on its own. The
// per-class chat itself lives on the dedicated Chat tab (api/donna-chat.ts)
// instead of here — this page links out to it rather than embedding its
// own copy of the same conversation.
async function handleSchoolPage(req: VercelRequest, res: VercelResponse, settingsPromise: Promise<Settings>) {
  const [classFolders, settings] = await Promise.all([getClassFolders(), settingsPromise]);

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

      if (action === "delete-upload" || action === "rename-upload" || action === "move-upload") {
        const uploadId = Number(body.id);
        if (Number.isFinite(uploadId)) {
          if (action === "delete-upload") {
            await deleteUpload(uploadId);
          } else if (action === "rename-upload") {
            const filename = String(body.filename ?? "").trim();
            if (filename) await updateUpload(uploadId, { originalFilename: filename });
          } else {
            const newClassId = String(body.classId ?? "").trim();
            await updateUpload(uploadId, { classId: newClassId ? Number(newClassId) : null });
          }
        }
        const classId = typeof req.query.classId === "string" ? req.query.classId : undefined;
        res.redirect(303, classId ? `/donna/school?classId=${classId}` : "/donna/school");
        return;
      }

      if (action === "prep-project") {
        const classId = Number(body.classId);
        const description = String(body.description ?? "").trim();
        const cls = classFolders.find((c) => c.id === classId);

        let projectPrep: ProjectPrepView;
        if (!cls || !description) {
          projectPrep = { description, error: "Missing a class or task description." };
        } else {
          try {
            projectPrep = await buildProjectPrepView(cls, description, isGoogleConfigured());
          } catch (err) {
            console.error("Project prep failed:", err);
            projectPrep = { description, error: "Something went wrong generating this — try again." };
          }
        }

        await renderSchoolPage(res, classFolders, settings, classId, projectPrep);
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

  const requestedClassId = typeof req.query.classId === "string" ? Number(req.query.classId) : undefined;
  await renderSchoolPage(res, classFolders, settings, requestedClassId);
}

async function handleFilesPage(req: VercelRequest, res: VercelResponse, settingsPromise: Promise<Settings>) {
  if (req.method === "POST") {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const uploadId = Number(body.id);
    try {
      if (Number.isFinite(uploadId)) {
        if (body.action === "delete-upload") {
          await deleteUpload(uploadId);
        } else if (body.action === "rename-upload") {
          const filename = String(body.filename ?? "").trim();
          if (filename) await updateUpload(uploadId, { originalFilename: filename });
        } else if (body.action === "move-upload") {
          const classId = String(body.classId ?? "").trim();
          await updateUpload(uploadId, { classId: classId ? Number(classId) : null });
        }
      }
    } catch (err) {
      console.error("File library action failed:", err);
    }
    res.redirect(303, "/donna/files");
    return;
  }

  const googleConfigured = isGoogleConfigured();
  const [settings, classFolders, reminders] = await Promise.all([
    settingsPromise,
    getClassFolders(),
    listRemindersSafe(),
  ]);
  // classLinks only depends on `reminders` (already resolved above) and
  // touches a different table than everything below it — kicked off now
  // so it overlaps the refresh-cache-invalidation and Drive/uploads fan-out
  // instead of blocking in front of them (it used to be a full extra round
  // trip before that fan-out even started).
  const classLinksPromise = getClassLinksForTasks(reminders.map((r) => r.id)).catch(() => new Map<string, number>());

  // listFilesInFolder caches each folder's listing for 5 minutes (Drive API
  // has no per-call cost, this is purely to avoid re-hitting it on every
  // page load) — a file added directly in Drive can be invisible for up to
  // that long otherwise. ?refresh=1 (the Files page's Refresh link) clears
  // every folder's entry before fetching, forcing a live re-read.
  if (req.query.refresh === "1") {
    await Promise.all(classFolders.map((cls) => invalidateCache(`drive:files:${cls.driveFolderId}`)));
  }

  const filesByClass: Record<number, DriveFile[]> = {};
  const uploadsByClass: Record<number, Upload[]> = {};

  const [generalUploads, classLinks] = await Promise.all([
    getGeneralUploads().catch(() => []),
    classLinksPromise,
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

async function renderSchoolPage(
  res: VercelResponse,
  classFolders: ClassFolder[],
  settings: Settings,
  requestedClassId: number | undefined,
  projectPrep?: ProjectPrepView
) {
  if (classFolders.length === 0) {
    const html = buildSchoolHtml({
      classFolders: [],
      activeClass: null,
      uploads: [],
      driveFiles: [],
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

  const activeClass = classFolders.find((c) => c.id === requestedClassId) ?? classFolders[0];

  const googleConfigured = isGoogleConfigured();
  const [uploads, driveFiles, allFlashcards, studyStats] = await Promise.all([
    getUploadsForClass(activeClass.id).catch(() => []),
    googleConfigured ? listFilesInFolder(activeClass.driveFolderId).catch(() => []) : Promise.resolve([]),
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
    driveFiles,
    dueFlashcards,
    otherFlashcards,
    studyStats,
    navVisibility: settings.dashboardConfig.navVisibility,
    navOrder: settings.dashboardConfig.navOrder,
    projectPrep,
  });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}

// Calendar, Files, and School folded into one function (Vercel Hobby's
// 12-function cap) — Files/School were already merged; Calendar joins them
// here since real traffic to any of the three now keeps all three warm.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Independent of which user/session this is — starting it alongside
  // requireAuth's own Supabase read overlaps two round trips that used to
  // run fully serially in front of every route this file serves. The
  // extra .catch() below is just to prevent an unhandled-rejection
  // warning on the auth-failure path, where this promise is discarded
  // without ever being awaited — the real error (if any) is still
  // surfaced wherever a handler actually awaits settingsPromise.
  const settingsPromise = loadSettings();
  settingsPromise.catch(() => undefined);

  if (!(await requireAuth(req, res))) return;

  if (req.query.page === "school") {
    await handleSchoolPage(req, res, settingsPromise);
    return;
  }
  if (req.query.page === "files") {
    await handleFilesPage(req, res, settingsPromise);
    return;
  }

  await handleCalendarPage(req, res, settingsPromise);
}
