import sanitizeHtml from "sanitize-html";

// Newsletter HTML is third-party content that will eventually render on
// Donna's web view — strip anything that could execute or navigate away
// unexpectedly, while keeping the layout/images/links that make it worth
// reading. Images are almost always remote-hosted (Substack, Beehiiv,
// Mailchimp, etc. all work this way), so http(s) <img src> stays intact.
export function sanitizeNewsletterHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2", "span", "table", "tr", "td", "th", "tbody", "thead", "style"]),
    allowedAttributes: {
      "*": ["style", "class", "align", "width", "height"],
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "width", "height"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: {
      img: ["http", "https", "data"],
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
    },
    // Strip anything script-like outright rather than trying to allow-list
    // a "safe" subset of it.
    disallowedTagsMode: "discard",
  });
}
