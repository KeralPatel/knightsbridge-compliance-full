import type { FastifyInstance, FastifyRequest } from "fastify";
import { verifyAdminKey } from "../middleware/apiAuth";
import { getPrismaClient } from "../utils/prisma";

const prisma = getPrismaClient();

export async function adminRoutes(app: FastifyInstance) {
  // All admin routes require admin key
  app.addHook("preHandler", verifyAdminKey);

  // ── Dashboard stats ────────────────────────────────────────────────────────
  app.get("/stats", async (_, reply) => {
    const [
      totalUsers,
      activeApiKeys,
      pendingReports,
      verifiedScams,
      totalPayments,
      confirmedPayments,
      recentHighRiskTokens,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.apiKey.count({ where: { isActive: true } }),
      prisma.scamReport.count({ where: { status: "PENDING" } }),
      prisma.scamRegistry.count({ where: { verificationStatus: "VERIFIED" } }),
      prisma.payment.count(),
      prisma.payment.count({ where: { status: "CONFIRMED" } }),
      prisma.tokenRugScore.count({ where: { rugRiskScore: { gte: 70 } } }),
    ]);

    const revenue = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: "CONFIRMED" },
    });

    return reply.send({
      users: {
        total: totalUsers,
        activeApiKeys,
      },
      scamReports: {
        pending: pendingReports,
        verified: verifiedScams,
      },
      payments: {
        total: totalPayments,
        confirmed: confirmedPayments,
        revenue: revenue._sum.amount || 0,
      },
      tokens: {
        highRisk: recentHighRiskTokens,
      },
    });
  });

  // ── List API users ─────────────────────────────────────────────────────────
  app.get(
    "/api-users",
    async (
      request: FastifyRequest<{ Querystring: { limit?: number; offset?: number; plan?: string } }>,
      reply
    ) => {
      const limit = Math.min(Number(request.query.limit) || 50, 200);
      const offset = Number(request.query.offset) || 0;

      const where: any = {};
      if (request.query.plan) where.plan = request.query.plan;

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            name: true,
            company: true,
            plan: true,
            isActive: true,
            createdAt: true,
            apiKeys: {
              select: {
                key: true,
                plan: true,
                totalRequests: true,
                monthRequests: true,
                lastUsed: true,
                isActive: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.user.count({ where }),
      ]);

      return reply.send({ users, total, limit, offset });
    }
  );

  // ── List payments ──────────────────────────────────────────────────────────
  app.get(
    "/payments",
    async (
      request: FastifyRequest<{ Querystring: { limit?: number; offset?: number; status?: string } }>,
      reply
    ) => {
      const limit = Math.min(Number(request.query.limit) || 50, 200);
      const offset = Number(request.query.offset) || 0;

      const where: any = {};
      if (request.query.status) where.status = request.query.status;

      const [payments, total] = await Promise.all([
        prisma.payment.findMany({
          where,
          include: { user: { select: { email: true, name: true } } },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.payment.count({ where }),
      ]);

      return reply.send({ payments, total });
    }
  );

  // ── Pending scam reports ────────────────────────────────────────────────────
  app.get(
    "/reports/pending",
    async (_, reply) => {
      const reports = await prisma.scamReport.findMany({
        where: { status: { in: ["PENDING", "UNDER_REVIEW"] } },
        include: { reporter: { select: { email: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      return reply.send({ reports, total: reports.length });
    }
  );

  // ── Verify scam report ─────────────────────────────────────────────────────
  app.post(
    "/reports/:id/verify",
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { riskScore: number; notes?: string };
      }>,
      reply
    ) => {
      const { id } = request.params;
      const { riskScore, notes } = request.body as any;

      const report = await prisma.scamReport.findUnique({ where: { id } });
      if (!report) return reply.status(404).send({ error: "Report not found" });

      const riskLevel = riskScore >= 75 ? "CRITICAL" :
                        riskScore >= 50 ? "HIGH" :
                        riskScore >= 25 ? "MEDIUM" : "LOW";

      // Update report status
      await prisma.scamReport.update({
        where: { id },
        data: { status: "VERIFIED", adminNotes: notes },
      });

      // Add to scam registry
      await prisma.scamRegistry.create({
        data: {
          walletAddress: report.targetWallet,
          contractAddress: report.targetContract,
          scamType: report.scamType,
          riskScore,
          riskLevel: riskLevel as any,
          evidenceIpfsHash: report.evidenceIpfsHash,
          reporterWallet: report.reporterWallet,
          verificationStatus: "VERIFIED",
          description: report.description,
          verifiedAt: new Date(),
          verifiedBy: "admin",
        },
      });

      return reply.send({ success: true, message: "Report verified and added to registry" });
    }
  );

  // ── Reject scam report ─────────────────────────────────────────────────────
  app.post(
    "/reports/:id/reject",
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: { reason: string } }>,
      reply
    ) => {
      const { id } = request.params;
      const { reason } = request.body as any;

      await prisma.scamReport.update({
        where: { id },
        data: { status: "REJECTED", adminNotes: reason },
      });

      return reply.send({ success: true });
    }
  );

  // ── API usage analytics ────────────────────────────────────────────────────
  app.get("/analytics/usage", async (_, reply) => {
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const usageByEndpoint = await prisma.apiUsage.groupBy({
      by: ["endpoint"],
      _count: { id: true },
      where: { createdAt: { gte: last7Days } },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    });

    const dailyUsage = await prisma.$queryRaw<{ date: string; count: bigint }[]>`
      SELECT DATE_TRUNC('day', created_at)::date as date, COUNT(*) as count
      FROM api_usage
      WHERE created_at >= ${last7Days}
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY date ASC
    `;

    return reply.send({
      topEndpoints: usageByEndpoint.map((e) => ({
        endpoint: e.endpoint,
        requests: e._count.id,
      })),
      dailyUsage: dailyUsage.map((d) => ({
        date: d.date,
        count: Number(d.count),
      })),
    });
  });
}
