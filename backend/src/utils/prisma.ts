import { PrismaClient } from "@prisma/client";

declare global {
  var __prisma: PrismaClient | undefined;
}

export function getPrismaClient(): PrismaClient {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  }
  return global.__prisma;
}
