import "dotenv/config";
import pino from "pino";
import { BlockScanner } from "./blockScanner";
import { PaymentDetector } from "./paymentDetector";
import { RugPullDetector } from "./engines/rugPullDetector";
import { getPrismaClient } from "./utils/prisma";

export const logger = pino({
  transport: {
    target: "pino-pretty",
    options: { colorize: true, translateTime: "HH:MM:ss" },
  },
  level: process.env.LOG_LEVEL || "info",
});

async function main() {
  logger.info("╔══════════════════════════════════════════════════════╗");
  logger.info("║  Knightsbridge Compliance Centre — Indexer Service   ║");
  logger.info("╚══════════════════════════════════════════════════════╝");

  const prisma = getPrismaClient();

  // Test DB connection
  try {
    await prisma.$connect();
    logger.info("✓ Database connected");
  } catch (err) {
    logger.error({ err }, "✗ Database connection failed");
    process.exit(1);
  }

  // Initialize detectors
  const rugPullDetector = new RugPullDetector(logger);
  const paymentDetector = new PaymentDetector(logger);
  const blockScanner = new BlockScanner(logger, rugPullDetector, paymentDetector);

  // Start indexing
  await blockScanner.start();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    await blockScanner.stop();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("uncaughtException", (err) => {
    logger.error({ err }, "Uncaught exception");
    process.exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    logger.error({ reason }, "Unhandled rejection");
  });
}

main().catch((err) => {
  logger.error({ err }, "Fatal error in indexer");
  process.exit(1);
});
