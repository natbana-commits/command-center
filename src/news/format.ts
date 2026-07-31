import type { NewsStory } from "./curate.js";

export function formatStoryMessages(stories: NewsStory[]): { text: string }[] {
  return stories.map((story) => ({ text: `${story.blurb}\n${story.url}` }));
}

export function formatMorePrompt(held: NewsStory[]): { text: string } {
  if (held.length === 0) {
    return { text: "That's everything today." };
  }
  const teasers = held.map((s) => `• ${s.teaser}`).join("\n");
  return {
    text: `${held.length} more:\n${teasers}\n\nWant them? Reply yes.`,
  };
}
