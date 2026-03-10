import type { FastifyInstance, FastifyRequest } from "fastify";
import { ethers } from "ethers";
import { z } from "zod";
import { verifyApiKey } from "../middleware/apiAuth";
import { getPrismaClient } from "../utils/prisma";
import axios from "axios";

const prisma = getPrismaClient();

const ReportScamSchema = z.object({
  targetWallet: z.string().optional(),
  targetContract: z.string().optional(),
  scamType: z.enum([
    "RUG_PULL", "PHISHING", "HONEYPOT", "FAKE_TOKEN", "PUMP_AND_DUMP",
    "MIXER", "MALICIOUS_CONTRACT", "EXPLOIT", "SOCIAL_ENGINEERING", "OTHER",
  ]),
  description: z.string().min(20).max(2000),
  evidenceUrls: z.array(z.string().url()).max(5).optional().default([]),
  reporterWallet: z.string().optional(),
}).refine(
  (data) => data.targetWallet || data.targetContract,
  { message: "Must provide targetWallet or targetContract" }
);

export async function scamRegistryRoutes(app: FastifyInstance) {
  // ── GET scam registry ──────────────────────────────────────────────────────
  app.get(
    "/scam-registry",
    {
      preHandler: [verifyApiKey],
      schema: {
        tags: ["Scam Registry"],
        summary: "Browse verified scam entries",
        querystring: {
          type: "object",
          properties: {
            limit: { type: "number", default: 20 },
            offset: { type: "number", default: 0 },
            scamType: { type: "string" },
            riskLevel: { type: "string" },
            search: { type: "string" },
          },
        },
        security: [{ apiKey: [] }],
      },
    },
    async (
      request: FastifyRequest<{
        Querystring: {
          limit?: number;
          offset?: number;
          scamType?: string;
          riskLevel?: string;
          search?: string;
        };
      }>,
      reply
    ) => {
      const limit = Math.min(Number(request.query.limit) || 20, 100);
      const offset = Number(request.query.offset) || 0;

      const where: any = { verificationStatus: "VERIFIED", isActive: true };

      if (request.query.scamType) where.scamType = request.query.scamType;
      if (request.query.riskLevel) where.riskLevel = request.query.riskLevel;

      if (request.query.search) {
        const s = request.query.search.toLowerCase();
        where.OR = [
          { walletAddress: { contains: s } },
          { contractAddress: { contains: s } },
          { description: { contains: s, mode: "insensitive" } },
        ];
      }

      const [entries, total] = await Promise.all([
        prisma.scamRegistry.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.scamRegistry.count({ where }),
      ]);

      return reply.send({ entries, total, limit, offset });
    }
  );

  // ── GET single scam entry ──────────────────────────────────────────────────
  app.get(
    "/scam-registry/:id",
    {
      preHandler: [verifyApiKey],
      schema: {
        tags: ["Scam Registry"],
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        security: [{ apiKey: [] }],
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const entry = await prisma.scamRegistry.findUnique({
        where: { id: request.params.id },
      });

      if (!entry) {
        return reply.status(404).send({ error: "Entry not found" });
      }

      return reply.send(entry);
    }
  );

  // ── POST report scam ───────────────────────────────────────────────────────
  app.post(
    "/report-scam",
    {
      preHandler: [verifyApiKey],
      schema: {
        tags: ["Scam Registry"],
        summary: "Submit a scam report",
        body: {
          type: "object",
          required: ["scamType", "description"],
          properties: {
            targetWallet: { type: "string" },
            targetContract: { type: "string" },
            scamType: { type: "string" },
            description: { type: "string" },
            evidenceUrls: { type: "array", items: { type: "string" } },
            reporterWallet: { type: "string" },
          },
        },
        security: [{ apiKey: [] }],
      },
    },
    async (request: FastifyRequest, reply) => {
      const parsed = ReportScamSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Validation Error",
          message: parsed.error.issues.map((i) => i.message).join(", "),
        });
      }

      const data = parsed.data;
      const apiKey = (request as any).apiKey;

      // Validate addresses if provided
      if (data.targetWallet && !ethers.isAddress(data.targetWallet)) {
        return reply.status(400).send({ error: "Invalid target wallet address" });
      }
      if (data.targetContract && !ethers.isAddress(data.targetContract)) {
        return reply.status(400).send({ error: "Invalid target contract address" });
      }

      // Upload evidence to IPFS if URLs provided
      let ipfsHash: string | null = null;
      if (data.evidenceUrls && data.evidenceUrls.length > 0) {
        ipfsHash = await uploadEvidenceToIPFS(data).catch(() => null);
      }

      const report = await prisma.scamReport.create({
        data: {
          reporterId: apiKey?.userId,
          reporterWallet: data.reporterWallet,
          targetWallet: data.targetWallet?.toLowerCase(),
          targetContract: data.targetContract?.toLowerCase(),
          scamType: data.scamType as any,
          description: data.description,
          evidenceUrls: data.evidenceUrls || [],
          evidenceIpfsHash: ipfsHash || undefined,
          status: "PENDING",
        },
      });

      return reply.status(201).send({
        id: report.id,
        status: report.status,
        message: "Report submitted successfully. Our team will review it.",
        reportId: report.id,
      });
    }
  );

  // ── GET check address in scam registry ───────────────────────────────────
  app.get(
    "/scam-check/:address",
    {
      preHandler: [verifyApiKey],
      schema: {
        tags: ["Scam Registry"],
        summary: "Quick check if address is in scam registry",
        security: [{ apiKey: [] }],
      },
    },
    async (request: FastifyRequest<{ Params: { address: string } }>, reply) => {
      const { address } = request.params;

      if (!ethers.isAddress(address)) {
        return reply.status(400).send({ error: "Invalid address" });
      }

      const normalized = address.toLowerCase();

      const [walletEntry, contractEntry] = await Promise.all([
        prisma.scamRegistry.findFirst({
          where: { walletAddress: normalized, verificationStatus: "VERIFIED" },
          select: { id: true, scamType: true, riskScore: true, riskLevel: true, createdAt: true },
        }),
        prisma.scamRegistry.findFirst({
          where: { contractAddress: normalized, verificationStatus: "VERIFIED" },
          select: { id: true, scamType: true, riskScore: true, riskLevel: true, createdAt: true },
        }),
      ]);

      const entry = walletEntry || contractEntry;

      return reply.send({
        address,
        isScam: !!entry,
        entry: entry || null,
      });
    }
  );
}

async function uploadEvidenceToIPFS(data: any): Promise<string | null> {
  const pinataApiKey = process.env.PINATA_API_KEY;
  const pinataSecretKey = process.env.PINATA_SECRET_KEY;

  if (!pinataApiKey || !pinataSecretKey) return null;

  try {
    const response = await axios.post(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      {
        pinataContent: {
          scamReport: {
            targetWallet: data.targetWallet,
            targetContract: data.targetContract,
            scamType: data.scamType,
            description: data.description,
            evidenceUrls: data.evidenceUrls,
            reportedAt: new Date().toISOString(),
          },
        },
        pinataMetadata: {
          name: `KCC Scam Report - ${Date.now()}`,
        },
      },
      {
        headers: {
          pinata_api_key: pinataApiKey,
          pinata_secret_api_key: pinataSecretKey,
        },
      }
    );

    return response.data.IpfsHash;
  } catch {
    return null;
  }
}
