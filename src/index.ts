import "dotenv/config";
import { sendTelegramMessage } from "./telegram.js";
import { formatBrief } from "./formatBrief.js";

async function main() {
  await sendTelegramMessage(formatBrief());
  console.log("Message sent.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
