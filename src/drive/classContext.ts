import { isGoogleConfigured } from "../google/auth.js";
import { listFilesInFolder } from "./list.js";
import { getFileContent } from "./content.js";
import type { ClassFolder } from "./classFolders.js";

const MAX_FILES_PER_CLASS = 10;
const MAX_CHARS_PER_FILE = 6000;

// Shared by the general chat's get_class_files tool and the School page's
// auto-loaded per-class context — one place for "what does a class's
// Drive folder look like as plain text" rather than two copies drifting
// apart.
export async function getClassFileContext(classFolder: ClassFolder): Promise<string> {
  if (!isGoogleConfigured()) {
    return "Drive isn't connected yet — Nathan needs to finish the Google OAuth setup first.";
  }

  let files;
  try {
    files = await listFilesInFolder(classFolder.driveFolderId);
  } catch (err) {
    // A missing/inaccessible folder (deleted, wrong ID, revoked access)
    // throws rather than returning an empty list — degrade to a plain
    // explanation instead of letting this break the whole chat turn.
    console.error(`Failed to list files for ${classFolder.className}:`, err);
    return `Couldn't read the ${classFolder.className} Drive folder — the folder ID in Settings may be wrong or inaccessible.`;
  }

  if (files.length === 0) {
    return `The ${classFolder.className} folder exists but has no files in it yet.`;
  }

  const contents = await Promise.all(
    files.slice(0, MAX_FILES_PER_CLASS).map(async (f) => {
      const text = await getFileContent(f);
      return text
        ? `--- ${f.name} ---\n${text.slice(0, MAX_CHARS_PER_FILE)}`
        : `--- ${f.name} ---\n(unsupported file type, no text extracted)`;
    })
  );

  return contents.join("\n\n");
}
