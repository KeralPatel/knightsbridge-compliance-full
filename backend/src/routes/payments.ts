import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { getPrismaClient } from "../utils/prisma";

const prisma = getPrismaClient();

const PLAN_PRICES: Record<string, Record<string, number>> = {
  STARTER:    { monthly: 29, yearly: 290 },
  PRO:        { monthly: 99, yearly: 990 },
  ENTERPRISE: { monthly: 299, yearly: 2990 },
};

const CreatePaymentSchema = z.object({
  plan: z.enum(["STARTER", "PRO", "ENTERPRISE"]),
  billing: z.enum(["monthly", "yearly"]).default("monthly"),
  network: z.enum(["ETHEREUM", "POLYGON"]).default("ETHEREUM"),
});

function verifyJWT(token: string): string {
  const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret") as { sub: string };
  return decoded.sub;
}

async function requireAuth(request: FastifyRequest, reply: any): Promise<void> {
  const auth = request.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Authorization required" });
  }
  try {
    const userId = verifyJWT(auth.slice(7));
    (request as any).userId = userId;
  } catch {
    return reply.status(401).send({ error: "Invalid token" });
  }
}

export async function paymentRoutes(app: FastifyInstance) {
  // ── Create payment invoice ─────────────────────────────────────────────────
  app.post(
    "/create",
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply) => {
      const parsed = CreatePaymentSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Validation Error",
          message: parsed.error.issues[0].message,
        });
      }

      const { plan, billing, network } = parsed.data;
      const userId = (request as any).userId;
      const amount = PLAN_PRICES[plan][billing];

      const toWallet = network === "ETHEREUM"
        ? process.env.USDT_WALLET_ETH!
        : process.env.USDT_WALLET_POLYGON!;

      if (!toWallet) {
        return reply.status(500).send({ error: "Payment wallet not configured" });
      }

      // Expire in 30 minutes
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      const payment = await prisma.payment.create({
        data: {
          userId,
          plan: plan as any,
          amount,
          currency: "USDT",
          network: network as any,
          toWallet,
          status: "PENDING",
          expiresAt,
        },
      });

      return reply.status(201).send({
        paymentId: payment.id,
        plan,
        amount,
        currency: "USDT",
        network,
        sendTo: toWallet,
        expiresAt: expiresAt.toISOString(),
        instructions: [
          `Send exactly ${amount} USDT to ${toWallet}`,
          `Network: ${network}`,
          `Payment expires in 30 minutes`,
          `Your plan will activate automatically after confirmation`,
        ],
      });
    }
  );

  // ── Check payment status ────────────────────────────────────────────────────
  app.get(
    "/status/:paymentId",
    { preHandler: [requireAuth] },
    async (request: FastifyRequest<{ Params: { paymentId: string } }>, reply) => {
      const userId = (request as any).userId;
      const payment = await prisma.payment.findFirst({
        where: { id: request.params.paymentId, userId },
      });

      if (!payment) {
        return reply.status(404).send({ error: "Payment not found" });
      }

      return reply.send({
        paymentId: payment.id,
        plan: payment.plan,
        amount: payment.amount,
        status: payment.status,
        confirmedAt: payment.confirmedAt,
        txHash: payment.txHash,
      });
    }
  );

  // ── Get plan pricing ───────────────────────────────────────────────────────
  app.get("/plans", async (_, reply) => {
    return reply.send({
      plans: [
        {
          id: "FREE",
          name: "Free",
          price: { monthly: 0, yearly: 0 },
          features: {
            rpmLimit: 10,
            monthlyLimit: 100,
            walletRisk: true,
            contractRisk: true,
            tokenRug: true,
            scamRegistry: true,
            batchRequests: false,
            prioritySupport: false,
          },
        },
        {
          id: "STARTER",
          name: "Starter",
          price: PLAN_PRICES.STARTER,
          features: {
            rpmLimit: parseInt(process.env.RATE_LIMIT_STARTER_RPM || "60"),
            monthlyLimit: 10000,
            walletRisk: true,
            contractRisk: true,
            tokenRug: true,
            scamRegistry: true,
            batchRequests: false,
            prioritySupport: false,
          },
        },
        {
          id: "PRO",
          name: "Pro",
          price: PLAN_PRICES.PRO,
          features: {
            rpmLimit: parseInt(process.env.RATE_LIMIT_PRO_RPM || "600"),
            monthlyLimit: 100000,
            walletRisk: true,
            contractRisk: true,
            tokenRug: true,
            scamRegistry: true,
            batchRequests: true,
            prioritySupport: false,
          },
        },
        {
          id: "ENTERPRISE",
          name: "Enterprise",
          price: PLAN_PRICES.ENTERPRISE,
          features: {
            rpmLimit: parseInt(process.env.RATE_LIMIT_ENTERPRISE_RPM || "6000"),
            monthlyLimit: 10000000,
            walletRisk: true,
            contractRisk: true,
            tokenRug: true,
            scamRegistry: true,
            batchRequests: true,
            prioritySupport: true,
          },
        },
      ],
    });
  });
}
