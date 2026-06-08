import app from "./app";
import { logger } from "./lib/logger";
import { startDiscordBot } from "./bot/yuri";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  const selfUrl = process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}/healthz`
    : `http://localhost:${port}/healthz`;

  setInterval(async () => {
    try {
      await fetch(selfUrl);
      logger.debug("Keep-alive ping sent");
    } catch (err) {
      logger.warn({ err }, "Keep-alive ping failed");
    }
  }, 3 * 60 * 1000);
});

startDiscordBot();
