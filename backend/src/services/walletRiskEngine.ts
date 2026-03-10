import { ethers } from "ethers";
import { getPrismaClient } from "../utils/prisma";
import { KNOWN_MIXERS } from "../utils/abis";

const prisma = getPrismaClient();

export interface WalletRiskResult {
  wallet: string;
  chainId: number;
  risk_score: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  flags: string[];
  details: {
    txCount: number;
    scamInteractions: number;
    rugInteractions: number;
    mixerInteractions: number;
    firstSeen: string | null;
    lastSeen: string | null;
    totalVolume: string;
  };
  cached: boolean;
}

interface RpcProvider {
  provider: ethers.JsonRpcProvider;
}

export class WalletRiskEngine {
  private providers: Map<number, ethers.JsonRpcProvider> = new Map();

  constructor() {
    // Initialize providers
    if (process.env.ETH_RPC_URL) {
      this.providers.set(1, new ethers.JsonRpcProvider(process.env.ETH_RPC_URL, 1));
    }
    if (process.env.POLYGON_RPC_URL) {
      this.providers.set(137, new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL, 137));
    }
  }

  async analyzeWallet(address: string, chainId = 1): Promise<WalletRiskResult> {
    const normalizedAddress = address.toLowerCase();

    // ── Check cache ────────────────────────────────────────────────────────
    const cached = await prisma.walletRiskScore.findUnique({
      where: {
        walletAddress_chainId: { walletAddress: normalizedAddress, chainId },
      },
    });

    if (cached && cached.expiresAt > new Date()) {
      return {
        wallet: cached.walletAddress,
        chainId: cached.chainId,
        risk_score: cached.riskScore,
        risk_level: cached.riskLevel as any,
        flags: cached.flags,
        details: {
          txCount: cached.txCount || 0,
          scamInteractions: cached.scamInteractions || 0,
          rugInteractions: cached.rugInteractions || 0,
          mixerInteractions: cached.mixerInteractions || 0,
          firstSeen: cached.firstSeen?.toISOString() || null,
          lastSeen: cached.lastSeen?.toISOString() || null,
          totalVolume: cached.totalVolume?.toString() || "0",
        },
        cached: true,
      };
    }

    // ── Perform fresh analysis ──────────────────────────────────────────────
    const result = await this.computeRisk(normalizedAddress, chainId);

    // ── Save to cache ──────────────────────────────────────────────────────
    const CACHE_HOURS = result.risk_score > 50 ? 1 : 6;
    await prisma.walletRiskScore.upsert({
      where: {
        walletAddress_chainId: { walletAddress: normalizedAddress, chainId },
      },
      update: {
        riskScore: result.risk_score,
        riskLevel: result.risk_level as any,
        flags: result.flags,
        details: result.details as any,
        scamInteractions: result.details.scamInteractions,
        rugInteractions: result.details.rugInteractions,
        mixerInteractions: result.details.mixerInteractions,
        calculatedAt: new Date(),
        expiresAt: new Date(Date.now() + CACHE_HOURS * 60 * 60 * 1000),
      },
      create: {
        walletAddress: normalizedAddress,
        chainId,
        riskScore: result.risk_score,
        riskLevel: result.risk_level as any,
        flags: result.flags,
        details: result.details as any,
        scamInteractions: result.details.scamInteractions,
        rugInteractions: result.details.rugInteractions,
        mixerInteractions: result.details.mixerInteractions,
        calculatedAt: new Date(),
        expiresAt: new Date(Date.now() + CACHE_HOURS * 60 * 60 * 1000),
      },
    });

    return result;
  }

  private async computeRisk(address: string, chainId: number): Promise<WalletRiskResult> {
    const flags: string[] = [];
    let riskScore = 0;

    // ── 1. Check scam registry ─────────────────────────────────────────────
    const scamEntry = await prisma.scamRegistry.findFirst({
      where: {
        OR: [{ walletAddress: address }],
        verificationStatus: "VERIFIED",
      },
    });

    if (scamEntry) {
      flags.push("confirmed_scam_wallet");
      riskScore += 60;
    }

    // ── 2. Check known bad addresses ───────────────────────────────────────
    const badAddr = await prisma.knownBadAddress.findUnique({
      where: { address_chainId: { address, chainId } },
    });

    if (badAddr) {
      flags.push(`known_${badAddr.category}`);
      riskScore += 40;
    }

    // ── 3. Mixer interaction check ─────────────────────────────────────────
    const mixerAddresses = KNOWN_MIXERS[chainId] || [];
    const mixerInteractions = await this.checkMixerInteractions(address, mixerAddresses);
    if (mixerInteractions > 0) {
      flags.push("mixer_interaction");
      riskScore += Math.min(30, mixerInteractions * 10);
    }

    // ── 4. Rug-pull token interactions ─────────────────────────────────────
    const rugInteractions = await this.checkRugPullInteractions(address);
    if (rugInteractions > 0) {
      flags.push("rug_pull_token_interaction");
      riskScore += Math.min(25, rugInteractions * 5);
    }

    // ── 5. Scam interactions (transacted with known scam wallets) ──────────
    const scamInteractions = await this.checkScamInteractions(address);
    if (scamInteractions > 0) {
      flags.push("scam_interaction");
      riskScore += Math.min(20, scamInteractions * 5);
    }

    // ── 6. Transaction burst analysis ─────────────────────────────────────
    const txBurst = await this.checkTransactionBurst(address, chainId);
    if (txBurst) {
      flags.push("abnormal_tx_burst");
      riskScore += 15;
    }

    // ── 7. Check reports against this wallet ─────────────────────────────
    const reportsAgainst = await prisma.scamReport.count({
      where: { targetWallet: address, status: { in: ["VERIFIED", "UNDER_REVIEW"] } },
    });

    if (reportsAgainst > 3) {
      flags.push("multiple_scam_reports");
      riskScore += 20;
    } else if (reportsAgainst > 0) {
      flags.push("scam_report_filed");
      riskScore += 10;
    }

    riskScore = Math.min(riskScore, 100);
    const riskLevel = this.scoreToLevel(riskScore);

    return {
      wallet: address,
      chainId,
      risk_score: riskScore,
      risk_level: riskLevel,
      flags,
      details: {
        txCount: 0,
        scamInteractions,
        rugInteractions,
        mixerInteractions,
        firstSeen: null,
        lastSeen: null,
        totalVolume: "0",
      },
      cached: false,
    };
  }

  private async checkMixerInteractions(address: string, mixers: string[]): Promise<number> {
    if (mixers.length === 0) return 0;

    const count = await prisma.indexedEvent.count({
      where: {
        contractAddress: { in: mixers.map((m) => m.toLowerCase()) },
        eventData: {
          path: ["from"],
          equals: address,
        },
      },
    });

    return count;
  }

  private async checkRugPullInteractions(address: string): Promise<number> {
    const rugTokens = await prisma.tokenRugScore.findMany({
      where: { rugRiskScore: { gte: 70 } },
      select: { tokenAddress: true },
      take: 100,
    });

    if (rugTokens.length === 0) return 0;

    const tokenAddresses = rugTokens.map((t) => t.tokenAddress.toLowerCase());

    const count = await prisma.indexedEvent.count({
      where: {
        contractAddress: { in: tokenAddresses },
        eventName: "Transfer",
        OR: [
          { eventData: { path: ["from"], equals: address } },
          { eventData: { path: ["to"], equals: address } },
        ],
      },
    });

    return count;
  }

  private async checkScamInteractions(address: string): Promise<number> {
    const scamWallets = await prisma.scamRegistry.findMany({
      where: { verificationStatus: "VERIFIED", walletAddress: { not: null } },
      select: { walletAddress: true },
      take: 100,
    });

    if (scamWallets.length === 0) return 0;

    const wallets = scamWallets
      .map((s) => s.walletAddress?.toLowerCase())
      .filter(Boolean) as string[];

    const count = await prisma.indexedEvent.count({
      where: {
        eventName: "Transfer",
        OR: [
          { eventData: { path: ["from"], equals: address } },
          { eventData: { path: ["to"], equals: address } },
        ],
        contractAddress: { in: wallets },
      },
    });

    return count;
  }

  private async checkTransactionBurst(address: string, chainId: number): Promise<boolean> {
    // Check for >50 transactions in 1 hour window
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const count = await prisma.indexedEvent.count({
      where: {
        chainId,
        timestamp: { gte: oneHourAgo },
        OR: [
          { eventData: { path: ["from"], equals: address } },
          { eventData: { path: ["to"], equals: address } },
        ],
      },
    });

    return count > 50;
  }

  private scoreToLevel(score: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
    if (score >= 75) return "CRITICAL";
    if (score >= 50) return "HIGH";
    if (score >= 25) return "MEDIUM";
    return "LOW";
  }
}
