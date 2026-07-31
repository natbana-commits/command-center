import "dotenv/config";
import { sendTelegramMessage } from "./telegram.js";

async function main() {
  await sendTelegramMessage("Command Center test message — if you're seeing this, the pipeline works.");
  console.log("Message sent.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
