import type { FastifyRequest, FastifyReply, FastifyPluginCallback } from "fastify";
import fp from "fastify-plugin";
import { getPrismaClient } from "../utils/prisma";

const prisma = getPrismaClient();

// In-memory rate limit window cache: apiKeyId -> { count, windowStart }
const rateLimitCache = new Map<string, { count: number; windowStart: number }>();

export async function verifyApiKey(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const apiKey = request.headers["x-api-key"] as string;

  if (!apiKey) {
    return reply.status(401).send({
      statusCode: 401,
      error: "Unauthorized",
      message: "API key required. Include x-api-key header.",
    });
  }

  // Look up API key
  const keyRecord = await prisma.apiKey.findUnique({
    where: { key: apiKey },
    include: { user: { select: { isActive: true, plan: true } } },
  });

  if (!keyRecord || !keyRecord.isActive) {
    return reply.status(401).send({
      statusCode: 401,
      error: "Unauthorized",
      message: "Invalid or inactive API key.",
    });
  }

  if (!keyRecord.user.isActive) {
    return reply.status(403).send({
      statusCode: 403,
      error: "Forbidden",
      message: "Account suspended.",
    });
  }

  if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
    return reply.status(401).send({
      statusCode: 401,
      error: "Unauthorized",
      message: "API key expired.",
    });
  }

  // ── Per-minute rate limiting ───────────────────────────────────────────────
  const now = Date.now();
  const windowMs = 60 * 1000;
  const cache = rateLimitCache.get(keyRecord.id) || { count: 0, windowStart: now };

  if (now - cache.windowStart > windowMs) {
    // Reset window
    cache.count = 1;
    cache.windowStart = now;
  } else {
    cache.count++;
  }

  rateLimitCache.set(keyRecord.id, cache);

  if (cache.count > keyRecord.rpmLimit) {
    reply.header("X-RateLimit-Limit", keyRecord.rpmLimit);
    reply.header("X-RateLimit-Remaining", 0);
    reply.header("X-RateLimit-Reset", Math.ceil((cache.windowStart + windowMs) / 1000));
    return reply.status(429).send({
      statusCode: 429,
      error: "Too Many Requests",
      message: `Rate limit exceeded. Your plan allows ${keyRecord.rpmLimit} requests/minute.`,
      plan: keyRecord.plan,
      upgradeUrl: "/api-plans",
    });
  }

  // ── Monthly limit check ────────────────────────────────────────────────────
  if (keyRecord.monthRequests >= keyRecord.monthlyLimit) {
    return reply.status(429).send({
      statusCode: 429,
      error: "Monthly Limit Exceeded",
      message: `Monthly request limit (${keyRecord.monthlyLimit}) reached.`,
    });
  }

  // Set rate limit headers
  reply.header("X-RateLimit-Limit", keyRecord.rpmLimit);
  reply.header("X-RateLimit-Remaining", Math.max(0, keyRecord.rpmLimit - cache.count));
  reply.header("X-Plan", keyRecord.plan);

  // Attach to request for route handlers
  (request as any).apiKey = keyRecord;
  (request as any).apiUserId = keyRecord.userId;

  // Async usage logging (don't await to avoid blocking response)
  updateUsageStats(keyRecord.id, request).catch(() => {});
}

export async function verifyAdminKey(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const adminKey = request.headers["x-api-key"] as string;

  if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
    return reply.status(401).send({
      statusCode: 401,
      error: "Unauthorized",
      message: "Invalid admin credentials.",
    });
  }
}

async function updateUsageStats(apiKeyId: string, request: FastifyRequest): Promise<void> {
  const startTime = (request as any).startTime || Date.now();

  await Promise.all([
    prisma.apiKey.update({
      where: { id: apiKeyId },
      data: {
        totalRequests: { increment: 1 },
        monthRequests: { increment: 1 },
        lastUsed: new Date(),
      },
    }),
    prisma.apiUsage.create({
      data: {
        apiKeyId,
        endpoint: request.url,
        method: request.method,
        statusCode: 200,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
        responseTimeMs: Date.now() - startTime,
      },
    }),
  ]).catch(() => {});
}
