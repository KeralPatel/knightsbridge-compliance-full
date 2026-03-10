import { ethers } from "ethers";
import type { Logger } from "pino";
import { getProvider, withRetry } from "./utils/rpc";
import { getPrismaClient } from "./utils/prisma";
import { ERC20_TRANSFER_TOPIC, ERC20_ABI } from "./utils/abis";

interface PaymentConfig {
  walletEth: string;
  walletPolygon: string;
  usdtContractEth: string;
  usdtContractPolygon: string;
}

export class PaymentDetector {
  private logger: Logger;
  private provider: ethers.JsonRpcProvider;
  private prisma = getPrismaClient();
  private config: PaymentConfig;
  private erc20Interface = new ethers.Interface(ERC20_ABI);

  constructor(logger: Logger) {
    this.logger = logger.child({ component: "PaymentDetector" });
    this.provider = getProvider(1);
    this.config = {
      walletEth: (process.env.USDT_WALLET_ETH || "").toLowerCase(),
      walletPolygon: (process.env.USDT_WALLET_POLYGON || "").toLowerCase(),
      usdtContractEth: (process.env.USDT_CONTRACT_ETH || "0xdAC17F958D2ee523a2206206994597C13D831ec7").toLowerCase(),
      usdtContractPolygon: (process.env.USDT_CONTRACT_POLYGON || "0xc2132D05D31c914a87C6611C10748AEb04B58e8F").toLowerCase(),
    };
  }

  async scanForPayments(fromBlock: number, toBlock: number): Promise<void> {
    if (!this.config.walletEth) return; // Not configured

    try {
      // Scan for USDT transfers TO our payment wallet
      const logs = await withRetry(() =>
        this.provider.getLogs({
          fromBlock,
          toBlock,
          address: this.config.usdtContractEth,
          topics: [
            ERC20_TRANSFER_TOPIC,
            null,
            // Pad the wallet address to 32 bytes for topic filter
            ethers.zeroPadValue(this.config.walletEth, 32),
          ],
        })
      );

      for (const log of logs) {
        await this.processPaymentLog(log).catch((err) =>
          this.logger.warn({ err }, "Failed to process payment log")
        );
      }
    } catch (err) {
      this.logger.warn({ err }, "Failed to scan for payments");
    }
  }

  private async processPaymentLog(log: ethers.Log): Promise<void> {
    try {
      const decoded = this.erc20Interface.decodeEventLog("Transfer", log.data, log.topics);
      const from = (decoded[0] as string).toLowerCase();
      const to = (decoded[1] as string).toLowerCase();
      const value = decoded[2] as bigint;

      if (to !== this.config.walletEth) return;

      // USDT has 6 decimals
      const amount = Number(value) / 1e6;

      this.logger.info(
        { from, amount, txHash: log.transactionHash },
        "USDT payment received"
      );

      // Find matching pending payment
      const payment = await this.prisma.payment.findFirst({
        where: {
          fromWallet: from,
          status: "PENDING",
          network: "ETHEREUM",
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      });

      if (!payment) {
        this.logger.warn({ from, amount, txHash: log.transactionHash }, "No matching pending payment");
        return;
      }

      // Verify amount matches (allow small tolerance for rounding)
      if (Math.abs(amount - payment.amount) > 0.01) {
        this.logger.warn(
          { expected: payment.amount, received: amount },
          "Payment amount mismatch"
        );
        return;
      }

      // Confirm payment
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "CONFIRMED",
          txHash: log.transactionHash,
          confirmedAt: new Date(),
        },
      });

      // Activate API key
      await this.activateUserPlan(payment.userId, payment.plan);

      this.logger.info(
        { userId: payment.userId, plan: payment.plan, txHash: log.transactionHash },
        "Payment confirmed, plan activated"
      );
    } catch (err) {
      this.logger.error({ err }, "Error processing payment log");
    }
  }

  private async activateUserPlan(userId: string, plan: string): Promise<void> {
    // Update user plan
    await this.prisma.user.update({
      where: { id: userId },
      data: { plan: plan as any },
    });

    // Update all active API keys for this user
    const rpmLimits: Record<string, number> = {
      FREE: 10,
      STARTER: parseInt(process.env.RATE_LIMIT_STARTER_RPM || "60"),
      PRO: parseInt(process.env.RATE_LIMIT_PRO_RPM || "600"),
      ENTERPRISE: parseInt(process.env.RATE_LIMIT_ENTERPRISE_RPM || "6000"),
    };

    const monthlyLimits: Record<string, number> = {
      FREE: 100,
      STARTER: 10000,
      PRO: 100000,
      ENTERPRISE: 10000000,
    };

    await this.prisma.apiKey.updateMany({
      where: { userId, isActive: true },
      data: {
        plan: plan as any,
        rpmLimit: rpmLimits[plan] || 60,
        monthlyLimit: monthlyLimits[plan] || 10000,
      },
    });
  }
}
