import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { verifyApiKey } from "../middleware/apiAuth";
import { WalletRiskEngine } from "../services/walletRiskEngine";
import { ethers } from "ethers";

const engine = new WalletRiskEngine();

const ParamsSchema = z.object({
  address: z.string().refine((v) => ethers.isAddress(v), "Invalid Ethereum address"),
});

const QuerySchema = z.object({
  chainId: z.coerce.number().optional().default(1),
});

export async function walletRiskRoutes(app: FastifyInstance) {
  app.get(
    "/wallet-risk/:address",
    {
      preHandler: [verifyApiKey],
      schema: {
        tags: ["Wallet Risk"],
        summary: "Analyze wallet risk score",
        description: "Returns a risk score (0-100) and flags for the given wallet address",
        params: {
          type: "object",
          properties: { address: { type: "string", description: "Ethereum wallet address (0x...)" } },
          required: ["address"],
        },
        querystring: {
          type: "object",
          properties: { chainId: { type: "number", default: 1 } },
        },
        response: {
          200: {
            type: "object",
            properties: {
              wallet: { type: "string" },
              chainId: { type: "number" },
              risk_score: { type: "number" },
              risk_level: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
              flags: { type: "array", items: { type: "string" } },
              details: { type: "object" },
              cached: { type: "boolean" },
            },
          },
        },
        security: [{ apiKey: [] }],
      },
    },
    async (request: FastifyRequest<{ Params: { address: string }; Querystring: { chainId?: number } }>, reply) => {
      const params = ParamsSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: params.error.issues[0].message,
        });
      }

      const query = QuerySchema.safeParse(request.query);
      const chainId = query.success ? query.data.chainId : 1;

      try {
        const result = await engine.analyzeWallet(params.data.address, chainId);
        return reply.send(result);
      } catch (err: any) {
        app.log.error({ err, address: params.data.address }, "Wallet risk analysis failed");
        return reply.status(500).send({
          statusCode: 500,
          error: "Analysis Failed",
          message: err.message || "Failed to analyze wallet",
        });
      }
    }
  );

  // Batch wallet risk endpoint (Pro+ only)
  app.post(
    "/wallet-risk/batch",
    {
      preHandler: [verifyApiKey],
      schema: {
        tags: ["Wallet Risk"],
        summary: "Batch analyze multiple wallets (Pro+)",
        body: {
          type: "object",
          required: ["addresses"],
          properties: {
            addresses: {
              type: "array",
              items: { type: "string" },
              maxItems: 50,
            },
            chainId: { type: "number", default: 1 },
          },
        },
        security: [{ apiKey: [] }],
      },
    },
    async (request: FastifyRequest<{ Body: { addresses: string[]; chainId?: number } }>, reply) => {
      const apiKey = (request as any).apiKey;
      if (apiKey?.plan === "FREE" || apiKey?.plan === "STARTER") {
        return reply.status(403).send({
          statusCode: 403,
          error: "Plan Restriction",
          message: "Batch analysis requires Pro or Enterprise plan",
        });
      }

      const { addresses, chainId = 1 } = request.body;

      if (!Array.isArray(addresses) || addresses.length === 0) {
        return reply.status(400).send({ error: "addresses array required" });
      }

      const validAddresses = addresses.filter((a) => ethers.isAddress(a));

      const results = await Promise.allSettled(
        validAddresses.map((addr) => engine.analyzeWallet(addr, chainId))
      );

      return reply.send({
        results: results.map((r, i) => ({
          address: validAddresses[i],
          ...(r.status === "fulfilled" ? r.value : { error: (r as any).reason?.message }),
        })),
        total: validAddresses.length,
      });
    }
  );
}
