import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateExplanation } from "../src/donna/ask.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  const text = (req.body?.text ?? "").toString().trim();
  if (!text) {
    res.status(400).json({ error: "Missing text" });
    return;
  }

  try {
    const explanation = await generateExplanation(text);
    res.status(200).json({ explanation });
  } catch (err) {
    console.error("Donna ask failed:", err);
    res.status(500).json({ error: "Failed to generate explanation" });
  }
}
