import type { FastifyInstance, FastifyRequest } from "fastify";
import { ethers } from "ethers";
import { z } from "zod";
import { verifyApiKey } from "../middleware/apiAuth";
import { getPrismaClient } from "../utils/prisma";

const prisma = getPrismaClient();

export async function tokenRugRoutes(app: FastifyInstance) {
  app.get(
    "/token-rug-risk/:address",
    {
      preHandler: [verifyApiKey],
      schema: {
        tags: ["Token Rug Risk"],
        summary: "Get token rug-pull risk score",
        description: "Returns rug-pull risk analysis for a token address",
        params: {
          type: "object",
          properties: { address: { type: "string" } },
          required: ["address"],
        },
        querystring: {
          type: "object",
          properties: { chainId: { type: "number", default: 1 } },
        },
        security: [{ apiKey: [] }],
      },
    },
    async (
      request: FastifyRequest<{
        Params: { address: string };
        Querystring: { chainId?: number };
      }>,
      reply
    ) => {
      const { address } = request.params;
      const chainId = Number(request.query.chainId) || 1;

      if (!ethers.isAddress(address)) {
        return reply.status(400).send({ error: "Invalid token address" });
      }

      const normalized = address.toLowerCase();

      const record = await prisma.tokenRugScore.findUnique({
        where: { tokenAddress_chainId: { tokenAddress: normalized, chainId } },
      });

      if (!record) {
        // Token not yet indexed — return basic response
        return reply.send({
          token: address,
          tokenName: "Unknown",
          tokenSymbol: "???",
          rug_risk_score: null,
          rug_risk_level: "UNKNOWN",
          warnings: ["token_not_indexed"],
          details: null,
          message: "Token not yet indexed. It will be analyzed when detected on-chain.",
        });
      }

      return reply.send({
        token: record.tokenAddress,
        tokenName: record.tokenName,
        tokenSymbol: record.tokenSymbol,
        rug_risk_score: record.rugRiskScore,
        rug_risk_level: record.rugRiskLevel,
        warnings: record.warnings,
        details: {
          devWalletPercent: record.devWalletPercent,
          liquidityUSD: record.liquidityUSD,
          liquidityLocked: record.liquidityLocked,
          hasOwnerMint: record.hasOwnerMint,
          hasBlacklist: record.hasBlacklist,
          hasTransferTax: record.hasTransferTax,
          isVerified: record.isVerified,
          deployerAddress: record.deployerAddress,
          totalSupply: record.totalSupply,
          deployedAt: record.deployedAt,
          calculatedAt: record.calculatedAt,
        },
      });
    }
  );

  // Recent high-risk tokens feed
  app.get(
    "/token-rug-risk/feed/high-risk",
    {
      preHandler: [verifyApiKey],
      schema: {
        tags: ["Token Rug Risk"],
        summary: "High-risk token feed",
        querystring: {
          type: "object",
          properties: {
            limit: { type: "number", default: 20 },
            offset: { type: "number", default: 0 },
          },
        },
        security: [{ apiKey: [] }],
      },
    },
    async (
      request: FastifyRequest<{ Querystring: { limit?: number; offset?: number } }>,
      reply
    ) => {
      const limit = Math.min(Number(request.query.limit) || 20, 100);
      const offset = Number(request.query.offset) || 0;

      const tokens = await prisma.tokenRugScore.findMany({
        where: { rugRiskScore: { gte: 50 } },
        orderBy: { calculatedAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          tokenAddress: true,
          tokenName: true,
          tokenSymbol: true,
          rugRiskScore: true,
          rugRiskLevel: true,
          warnings: true,
          liquidityUSD: true,
          calculatedAt: true,
        },
      });

      const total = await prisma.tokenRugScore.count({
        where: { rugRiskScore: { gte: 50 } },
      });

      return reply.send({ tokens, total, limit, offset });
    }
  );
}
