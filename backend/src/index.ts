import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { getPrismaClient } from "./utils/prisma";

// ── Route Imports ─────────────────────────────────────────────────────────────
import { walletRiskRoutes } from "./routes/walletRisk";
import { contractRiskRoutes } from "./routes/contractRisk";
import { tokenRugRoutes } from "./routes/tokenRug";
import { scamRegistryRoutes } from "./routes/scamRegistry";
import { authRoutes } from "./routes/auth";
import { adminRoutes } from "./routes/admin";
import { paymentRoutes } from "./routes/payments";

const app = Fastify({
  logger: {
    transport: {
      target: "pino-pretty",
      options: { colorize: true, translateTime: "HH:MM:ss" },
    },
    level: process.env.LOG_LEVEL || "info",
  },
});

async function bootstrap() {
  const prisma = getPrismaClient();

  // ── Security headers ───────────────────────────────────────────────────────
  await app.register(helmet, {
    contentSecurityPolicy: false, // Handled by Next.js
  });

  // ── CORS ───────────────────────────────────────────────────────────────────
  await app.register(cors, {
    origin: [
      process.env.FRONTEND_URL || "http://localhost:3000",
      /^https:\/\/.*\.knightsbridge\.com$/,
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
    credentials: true,
  });

  // ── Global rate limiting (fallback) ───────────────────────────────────────
  await app.register(rateLimit, {
    global: true,
    max: 1000,
    timeWindow: "1 minute",
    keyGenerator: (request) => {
      return (request.headers["x-api-key"] as string) || request.ip;
    },
    errorResponseBuilder: () => ({
      code: "RATE_LIMIT_EXCEEDED",
      error: "Too Many Requests",
      message: "Rate limit exceeded. Upgrade your plan for higher limits.",
      statusCode: 429,
    }),
  });

  // ── Swagger API Docs ──────────────────────────────────────────────────────
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Knightsbridge Compliance Centre API",
        description: "Blockchain compliance intelligence API",
        version: "1.0.0",
        contact: {
          name: "Knightsbridge Support",
          email: "api@knightsbridge.com",
        },
      },
      components: {
        securitySchemes: {
          apiKey: {
            type: "apiKey",
            in: "header",
            name: "x-api-key",
          },
        },
      },
      security: [{ apiKey: [] }],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: false,
    },
  });

  // ── Health Check ──────────────────────────────────────────────────────────
  app.get("/health", async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: "ok", timestamp: new Date().toISOString(), db: "connected" };
    } catch {
      return { status: "degraded", timestamp: new Date().toISOString(), db: "disconnected" };
    }
  });

  // ── Routes ────────────────────────────────────────────────────────────────
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(walletRiskRoutes, { prefix: "/api" });
  await app.register(contractRiskRoutes, { prefix: "/api" });
  await app.register(tokenRugRoutes, { prefix: "/api" });
  await app.register(scamRegistryRoutes, { prefix: "/api" });
  await app.register(paymentRoutes, { prefix: "/api/payments" });
  await app.register(adminRoutes, { prefix: "/admin" });

  // ── 404 Handler ───────────────────────────────────────────────────────────
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      statusCode: 404,
      error: "Not Found",
      message: `Route ${request.method} ${request.url} not found`,
    });
  });

  // ── Error Handler ─────────────────────────────────────────────────────────
  app.setErrorHandler((error: any, request, reply) => {
    app.log.error({ err: error, url: request.url }, "Request error");

    if (error.statusCode) {
      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        error: error.name,
        message: error.message,
      });
    }

    reply.status(500).send({
      statusCode: 500,
      error: "Internal Server Error",
      message: "An unexpected error occurred",
    });
  });

  // ── Start Server ──────────────────────────────────────────────────────────
  const host = process.env.BACKEND_HOST || "0.0.0.0";
  const port = parseInt(process.env.BACKEND_PORT || "4000", 10);

  await app.listen({ host, port });
  app.log.info(`✓ KCC API running at http://${host}:${port}`);
  app.log.info(`✓ Swagger docs at http://${host}:${port}/docs`);
}

bootstrap().catch((err) => {
  console.error("Fatal bootstrap error:", err);
  process.exit(1);
});
