import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { ethers } from "ethers";
import { verifyApiKey } from "../middleware/apiAuth";
import { ContractAnalyzer } from "../services/contractAnalyzer";

const analyzer = new ContractAnalyzer();

const ParamsSchema = z.object({
  address: z.string().refine((v) => ethers.isAddress(v), "Invalid contract address"),
});

export async function contractRiskRoutes(app: FastifyInstance) {
  app.get(
    "/contract-risk/:address",
    {
      preHandler: [verifyApiKey],
      schema: {
        tags: ["Contract Risk"],
        summary: "Analyze smart contract risk",
        description: "Scans contract bytecode for dangerous functions and risk signals",
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
      const parsed = ParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: parsed.error.issues[0].message,
        });
      }

      const chainId = Number(request.query.chainId) || 1;

      try {
        const result = await analyzer.analyzeContract(parsed.data.address, chainId);
        return reply.send(result);
      } catch (err: any) {
        return reply.status(500).send({
          statusCode: 500,
          error: "Analysis Failed",
          message: err.message,
        });
      }
    }
  );
}
