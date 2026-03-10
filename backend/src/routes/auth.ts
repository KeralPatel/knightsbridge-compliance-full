import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { getPrismaClient } from "../utils/prisma";
import { nanoid } from "nanoid";

const prisma = getPrismaClient();

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(100).optional(),
  company: z.string().max(200).optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

function signJWT(userId: string): string {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET || "secret", {
    expiresIn: "7d",
  });
}

export async function authRoutes(app: FastifyInstance) {
  // ── Register ───────────────────────────────────────────────────────────────
  app.post(
    "/register",
    {
      schema: {
        tags: ["Auth"],
        summary: "Register a new user",
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string" },
            password: { type: "string" },
            name: { type: "string" },
            company: { type: "string" },
          },
        },
      },
    },
    async (request: FastifyRequest, reply) => {
      const parsed = RegisterSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Validation Error",
          message: parsed.error.issues[0].message,
        });
      }

      const { email, password, name, company } = parsed.data;

      const exists = await prisma.user.findUnique({ where: { email } });
      if (exists) {
        return reply.status(409).send({ error: "Email already registered" });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const user = await prisma.user.create({
        data: { email, passwordHash, name, company, plan: "FREE" },
        select: { id: true, email: true, name: true, plan: true },
      });

      // Create initial free API key
      const apiKey = await prisma.apiKey.create({
        data: {
          key: `kcc_free_${nanoid(32)}`,
          name: "Default Free Key",
          userId: user.id,
          plan: "FREE",
          rpmLimit: 10,
          monthlyLimit: 100,
        },
      });

      const token = signJWT(user.id);

      return reply.status(201).send({
        user,
        token,
        apiKey: { key: apiKey.key, plan: apiKey.plan },
        message: "Account created. Free plan active.",
      });
    }
  );

  // ── Login ──────────────────────────────────────────────────────────────────
  app.post(
    "/login",
    {
      schema: {
        tags: ["Auth"],
        summary: "Login",
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string" },
            password: { type: "string" },
          },
        },
      },
    },
    async (request: FastifyRequest, reply) => {
      const parsed = LoginSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid input" });
      }

      const { email, password } = parsed.data;

      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true, email: true, name: true, plan: true,
          passwordHash: true, isActive: true,
          apiKeys: {
            where: { isActive: true },
            select: { key: true, plan: true },
            take: 1,
          },
        },
      });

      if (!user || !user.passwordHash) {
        return reply.status(401).send({ error: "Invalid credentials" });
      }

      if (!user.isActive) {
        return reply.status(403).send({ error: "Account suspended" });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return reply.status(401).send({ error: "Invalid credentials" });
      }

      const token = signJWT(user.id);
      const { passwordHash: _, ...safeUser } = user;

      return reply.send({
        user: safeUser,
        token,
        apiKey: user.apiKeys[0] || null,
      });
    }
  );

  // ── Generate API Key ───────────────────────────────────────────────────────
  app.post(
    "/api-keys",
    {
      preHandler: [verifyJWT],
      schema: {
        tags: ["Auth"],
        summary: "Generate a new API key",
        body: {
          type: "object",
          properties: { name: { type: "string" } },
        },
      },
    },
    async (request: FastifyRequest, reply) => {
      const userId = (request as any).userId;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { plan: true },
      });

      if (!user) return reply.status(404).send({ error: "User not found" });

      const planLimits: Record<string, { rpm: number; monthly: number }> = {
        FREE: { rpm: 10, monthly: 100 },
        STARTER: { rpm: 60, monthly: 10000 },
        PRO: { rpm: 600, monthly: 100000 },
        ENTERPRISE: { rpm: 6000, monthly: 10000000 },
      };

      const limits = planLimits[user.plan] || planLimits.FREE;

      const apiKey = await prisma.apiKey.create({
        data: {
          key: `kcc_${user.plan.toLowerCase()}_${nanoid(32)}`,
          name: (request.body as any)?.name || "API Key",
          userId,
          plan: user.plan as any,
          rpmLimit: limits.rpm,
          monthlyLimit: limits.monthly,
        },
      });

      return reply.status(201).send({
        key: apiKey.key,
        plan: apiKey.plan,
        rpmLimit: apiKey.rpmLimit,
        monthlyLimit: apiKey.monthlyLimit,
      });
    }
  );

  // ── Get API Keys ───────────────────────────────────────────────────────────
  app.get(
    "/api-keys",
    { preHandler: [verifyJWT] },
    async (request: FastifyRequest, reply) => {
      const userId = (request as any).userId;
      const keys = await prisma.apiKey.findMany({
        where: { userId },
        select: {
          id: true,
          key: true,
          name: true,
          plan: true,
          isActive: true,
          rpmLimit: true,
          monthlyLimit: true,
          totalRequests: true,
          monthRequests: true,
          lastUsed: true,
          createdAt: true,
        },
      });

      return reply.send(keys);
    }
  );
}

async function verifyJWT(request: FastifyRequest, reply: any): Promise<void> {
  const auth = request.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Authorization required" });
  }

  try {
    const token = auth.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret") as { sub: string };
    (request as any).userId = decoded.sub;
  } catch {
    return reply.status(401).send({ error: "Invalid token" });
  }
}
