import { ethers } from "ethers";
import type { Logger } from "pino";
import { getProvider, withRetry } from "../utils/rpc";
import { getPrismaClient } from "../utils/prisma";
import { ERC20_ABI, UNISWAP_V2_PAIR_ABI, DANGEROUS_FUNCTION_SIGS } from "../utils/abis";

// ─────────────────────────────────────────────────────────────────────────────
// Rug-Pull Detection Engine
// Analyzes newly launched tokens for rug-pull signals
// ─────────────────────────────────────────────────────────────────────────────

export interface RugRiskResult {
  token: string;
  tokenName: string;
  tokenSymbol: string;
  rug_risk_score: number;
  rug_risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  warnings: string[];
  details: {
    devWalletPercent: number;
    liquidityUSD: number;
    liquidityLocked: boolean;
    hasOwnerMint: boolean;
    hasBlacklist: boolean;
    hasTransferTax: boolean;
    isVerified: boolean;
    deployerAddress: string;
    totalSupply: string;
    holderCount: number;
    topHolderPercent: number;
  };
}

interface TokenHolder {
  address: string;
  balance: bigint;
  percent: number;
}

export class RugPullDetector {
  private logger: Logger;
  private provider: ethers.JsonRpcProvider;
  private prisma = getPrismaClient();
  private analysisQueue = new Set<string>(); // prevent duplicate analysis

  // High-risk bytecode signatures
  private readonly HONEYPOT_SIGS = [
    "0x15d7e7a5", // _takeFee or similar hidden fee
    "0x4a02f76b", // anti-whale with hidden lockout
  ];

  constructor(logger: Logger) {
    this.logger = logger.child({ component: "RugPullDetector" });
    this.provider = getProvider(1);
  }

  async analyzeToken(tokenAddress: string, pairAddress?: string): Promise<RugRiskResult | null> {
    const addr = tokenAddress.toLowerCase();

    // Prevent duplicate analysis
    if (this.analysisQueue.has(addr)) return null;
    this.analysisQueue.add(addr);

    try {
      // Check cache
      const cached = await this.prisma.tokenRugScore.findUnique({
        where: { tokenAddress_chainId: { tokenAddress: addr, chainId: 1 } },
      });

      if (cached && cached.expiresAt > new Date()) {
        return this.mapDbToResult(cached);
      }

      const result = await this.performAnalysis(addr, pairAddress);
      if (result) {
        await this.saveResult(result);
        this.logger.info(
          { token: addr, score: result.rug_risk_score, level: result.rug_risk_level },
          "Rug analysis complete"
        );
      }

      return result;
    } finally {
      this.analysisQueue.delete(addr);
    }
  }

  private async performAnalysis(tokenAddress: string, pairAddress?: string): Promise<RugRiskResult | null> {
    try {
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);

      // ── Fetch basic token data ─────────────────────────────────────────────
      const [name, symbol, totalSupplyRaw, deployerAddress] = await Promise.all([
        withRetry(() => contract.name()).catch(() => "Unknown"),
        withRetry(() => contract.symbol()).catch(() => "???"),
        withRetry(() => contract.totalSupply()).catch(() => 0n),
        this.getDeployerAddress(tokenAddress),
      ]);

      const totalSupply = BigInt(totalSupplyRaw || 0n);
      const totalSupplyStr = totalSupply.toString();

      // ── Analyse contract bytecode ──────────────────────────────────────────
      const bytecodeAnalysis = await this.analyzeContractBytecode(tokenAddress);

      // ── Check deployer balance ─────────────────────────────────────────────
      let devWalletPercent = 0;
      if (deployerAddress && deployerAddress !== ethers.ZeroAddress && totalSupply > 0n) {
        try {
          const devBalance = await withRetry(() => contract.balanceOf(deployerAddress));
          devWalletPercent = Number((BigInt(devBalance) * 10000n) / totalSupply) / 100;
        } catch {}
      }

      // ── Analyse liquidity ──────────────────────────────────────────────────
      const liquidityData = pairAddress
        ? await this.analyzeLiquidity(pairAddress)
        : { liquidityUSD: 0, liquidityLocked: false };

      // ── Build warnings list ────────────────────────────────────────────────
      const warnings: string[] = [];
      let riskScore = 0;

      // Dev wallet holding signals
      if (devWalletPercent > 40) {
        warnings.push("dev_wallet_high_supply");
        riskScore += 30;
      } else if (devWalletPercent > 20) {
        warnings.push("dev_wallet_moderate_supply");
        riskScore += 15;
      }

      // Liquidity signals
      if (!liquidityData.liquidityLocked) {
        warnings.push("liquidity_not_locked");
        riskScore += 25;
      }

      if (liquidityData.liquidityUSD < 5000) {
        warnings.push("low_liquidity");
        riskScore += 15;
      }

      // Contract capability signals
      if (bytecodeAnalysis.hasOwnerMint) {
        warnings.push("owner_mint_enabled");
        riskScore += 20;
      }

      if (bytecodeAnalysis.hasBlacklist) {
        warnings.push("blacklist_function_detected");
        riskScore += 15;
      }

      if (bytecodeAnalysis.hasTransferTax) {
        warnings.push("transfer_tax_detected");
        riskScore += 10;
      }

      if (bytecodeAnalysis.isProxy) {
        warnings.push("upgradeable_proxy_detected");
        riskScore += 10;
      }

      if (bytecodeAnalysis.hasPauseFunction) {
        warnings.push("pause_function_detected");
        riskScore += 5;
      }

      if (!bytecodeAnalysis.isVerified) {
        warnings.push("contract_not_verified");
        riskScore += 10;
      }

      // Cap score at 100
      riskScore = Math.min(riskScore, 100);

      const riskLevel = this.scoreToLevel(riskScore);

      return {
        token: tokenAddress,
        tokenName: String(name),
        tokenSymbol: String(symbol),
        rug_risk_score: riskScore,
        rug_risk_level: riskLevel,
        warnings,
        details: {
          devWalletPercent,
          liquidityUSD: liquidityData.liquidityUSD,
          liquidityLocked: liquidityData.liquidityLocked,
          hasOwnerMint: bytecodeAnalysis.hasOwnerMint,
          hasBlacklist: bytecodeAnalysis.hasBlacklist,
          hasTransferTax: bytecodeAnalysis.hasTransferTax,
          isVerified: bytecodeAnalysis.isVerified,
          deployerAddress: deployerAddress || ethers.ZeroAddress,
          totalSupply: totalSupplyStr,
          holderCount: 0, // Would require indexing all transfers
          topHolderPercent: devWalletPercent,
        },
      };
    } catch (err) {
      this.logger.warn({ err, tokenAddress }, "Failed to analyse token");
      return null;
    }
  }

  private async analyzeContractBytecode(address: string): Promise<{
    hasOwnerMint: boolean;
    hasBlacklist: boolean;
    hasTransferTax: boolean;
    isProxy: boolean;
    hasPauseFunction: boolean;
    isVerified: boolean;
  }> {
    let bytecode = "";
    try {
      bytecode = await withRetry(() => this.provider.getCode(address));
    } catch {
      return {
        hasOwnerMint: false,
        hasBlacklist: false,
        hasTransferTax: false,
        isProxy: false,
        hasPauseFunction: false,
        isVerified: false,
      };
    }

    const bc = bytecode.toLowerCase();

    // Detect function signatures in bytecode
    const hasOwnerMint =
      bc.includes("40c10f19") || // mint(address,uint256)
      bc.includes("a0712d68");   // mint(uint256)

    const hasBlacklist =
      bc.includes("4906b849") || // blacklist(address)
      bc.includes("537df3b6") || // unblacklist(address)
      bc.includes("blacklist".toLowerCase()); // literal string

    // Transfer tax: look for fee deduction patterns
    // Rough heuristic: presence of fee/tax-related operations
    const hasTransferTax =
      bc.includes("_taxFee") ||
      bc.includes("_liquidityFee") ||
      bc.length > 50000; // Very large bytecode often has complex fee logic

    // EIP-1967 proxy patterns
    const isProxy =
      bc.includes("360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc") ||
      bc.includes("delegatecall");

    const hasPauseFunction =
      bc.includes("8456cb59") || // pause()
      bc.includes("3f4ba83a");   // unpause()

    // Very rough proxy for verification: unverified contracts tend to have no metadata
    const isVerified = bytecode.endsWith("0033") || bytecode.length > 200;

    return { hasOwnerMint, hasBlacklist, hasTransferTax, isProxy, hasPauseFunction, isVerified };
  }

  private async analyzeLiquidity(pairAddress: string): Promise<{
    liquidityUSD: number;
    liquidityLocked: boolean;
  }> {
    try {
      const pair = new ethers.Contract(pairAddress, UNISWAP_V2_PAIR_ABI, this.provider);
      const reserves = await withRetry(() => pair.getReserves());
      const reserve0 = BigInt(reserves[0]);
      const reserve1 = BigInt(reserves[1]);

      // Rough USD estimate: if one side is WETH, 1 WETH ~ $3000
      const ethLiquidity = Number(ethers.formatEther(reserve0 > reserve1 ? reserve0 : reserve1));
      const liquidityUSD = ethLiquidity * 3000; // rough estimate

      // Check DB for lock data
      const poolRecord = await this.prisma.liquidityPool.findUnique({
        where: { poolAddress: pairAddress.toLowerCase() },
      });

      return {
        liquidityUSD,
        liquidityLocked: poolRecord?.isLocked ?? false,
      };
    } catch {
      return { liquidityUSD: 0, liquidityLocked: false };
    }
  }

  private async getDeployerAddress(tokenAddress: string): Promise<string | null> {
    try {
      // Get the transaction that created the contract
      // Requires archive node or Etherscan API
      // Simple approach: check Etherscan-like endpoint
      const code = await this.provider.getCode(tokenAddress);
      if (code === "0x") return null;

      // As a fallback, try to call owner() which many tokens expose
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      try {
        const owner = await withRetry(() => contract.owner());
        return owner as string;
      } catch {
        return null;
      }
    } catch {
      return null;
    }
  }

  private async saveResult(result: RugRiskResult): Promise<void> {
    const CACHE_HOURS = result.rug_risk_score > 50 ? 1 : 6;

    await this.prisma.tokenRugScore.upsert({
      where: {
        tokenAddress_chainId: {
          tokenAddress: result.token.toLowerCase(),
          chainId: 1,
        },
      },
      update: {
        rugRiskScore: result.rug_risk_score,
        rugRiskLevel: result.rug_risk_level as any,
        warnings: result.warnings,
        details: result.details as any,
        tokenName: result.tokenName,
        tokenSymbol: result.tokenSymbol,
        devWalletPercent: result.details.devWalletPercent,
        liquidityUSD: result.details.liquidityUSD,
        liquidityLocked: result.details.liquidityLocked,
        hasOwnerMint: result.details.hasOwnerMint,
        hasBlacklist: result.details.hasBlacklist,
        hasTransferTax: result.details.hasTransferTax,
        isVerified: result.details.isVerified,
        deployerAddress: result.details.deployerAddress,
        totalSupply: result.details.totalSupply,
        calculatedAt: new Date(),
        expiresAt: new Date(Date.now() + CACHE_HOURS * 60 * 60 * 1000),
      },
      create: {
        tokenAddress: result.token.toLowerCase(),
        chainId: 1,
        tokenName: result.tokenName,
        tokenSymbol: result.tokenSymbol,
        deployerAddress: result.details.deployerAddress,
        rugRiskScore: result.rug_risk_score,
        rugRiskLevel: result.rug_risk_level as any,
        warnings: result.warnings,
        details: result.details as any,
        devWalletPercent: result.details.devWalletPercent,
        liquidityUSD: result.details.liquidityUSD,
        liquidityLocked: result.details.liquidityLocked,
        hasOwnerMint: result.details.hasOwnerMint,
        hasBlacklist: result.details.hasBlacklist,
        hasTransferTax: result.details.hasTransferTax,
        isVerified: result.details.isVerified,
        totalSupply: result.details.totalSupply,
        expiresAt: new Date(Date.now() + CACHE_HOURS * 60 * 60 * 1000),
      },
    });
  }

  private scoreToLevel(score: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
    if (score >= 75) return "CRITICAL";
    if (score >= 50) return "HIGH";
    if (score >= 25) return "MEDIUM";
    return "LOW";
  }

  private mapDbToResult(record: any): RugRiskResult {
    return {
      token: record.tokenAddress,
      tokenName: record.tokenName || "Unknown",
      tokenSymbol: record.tokenSymbol || "???",
      rug_risk_score: record.rugRiskScore,
      rug_risk_level: record.rugRiskLevel,
      warnings: record.warnings,
      details: record.details as any,
    };
  }
}
