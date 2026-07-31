import "dotenv/config";
import { sendTelegramMessage } from "./telegram.js";
import { buildBriefMessages } from "./formatBrief.js";

async function main() {
  const messages = await buildBriefMessages();
  for (const message of messages) {
    await sendTelegramMessage(message.text, message.parseMode);
  }
  console.log("Message sent.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
