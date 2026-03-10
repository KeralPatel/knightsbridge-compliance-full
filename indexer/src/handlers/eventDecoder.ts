import { ethers } from "ethers";
import type { Logger } from "pino";
import { getPrismaClient } from "../utils/prisma";
import { ERC20_ABI } from "../utils/abis";

interface DecodedTransfer {
  from: string;
  to: string;
  value: bigint;
  tokenAddress: string;
  txHash: string;
  blockNumber: number;
  logIndex: number;
}

export class EventDecoder {
  private logger: Logger;
  private provider: ethers.JsonRpcProvider;
  private prisma = getPrismaClient();
  private erc20Interface = new ethers.Interface(ERC20_ABI);

  // Cache token metadata to avoid redundant RPC calls
  private tokenCache = new Map<string, { name: string; symbol: string; decimals: number }>();

  constructor(logger: Logger, provider: ethers.JsonRpcProvider) {
    this.logger = logger.child({ component: "EventDecoder" });
    this.provider = provider;
  }

  async decodeTransferEvent(log: ethers.Log): Promise<DecodedTransfer | null> {
    try {
      const decoded = this.erc20Interface.decodeEventLog("Transfer", log.data, log.topics);
      const transfer: DecodedTransfer = {
        from: (decoded[0] as string).toLowerCase(),
        to: (decoded[1] as string).toLowerCase(),
        value: decoded[2] as bigint,
        tokenAddress: log.address.toLowerCase(),
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        logIndex: log.index,
      };

      // Store large transfers only (> 10k tokens equivalent — rough filter)
      // In production you'd check USD value via price feed
      if (transfer.value > ethers.parseEther("1000")) {
        await this.storeTransfer(transfer, log);
      }

      return transfer;
    } catch {
      return null;
    }
  }

  private async storeTransfer(transfer: DecodedTransfer, log: ethers.Log): Promise<void> {
    try {
      // Get block timestamp
      let timestamp = new Date();
      try {
        const block = await this.provider.getBlock(log.blockNumber);
        if (block) timestamp = new Date(Number(block.timestamp) * 1000);
      } catch {}

      await this.prisma.indexedEvent.upsert({
        where: {
          txHash_logIndex: {
            txHash: transfer.txHash,
            logIndex: transfer.logIndex,
          },
        },
        update: {},
        create: {
          txHash: transfer.txHash,
          logIndex: transfer.logIndex,
          blockNumber: BigInt(transfer.blockNumber),
          chainId: 1,
          contractAddress: transfer.tokenAddress,
          eventName: "Transfer",
          eventData: {
            from: transfer.from,
            to: transfer.to,
            value: transfer.value.toString(),
          },
          timestamp,
        },
      });
    } catch {}
  }

  async getTokenMetadata(address: string): Promise<{ name: string; symbol: string; decimals: number } | null> {
    const cached = this.tokenCache.get(address.toLowerCase());
    if (cached) return cached;

    try {
      const contract = new ethers.Contract(address, ERC20_ABI, this.provider);
      const [name, symbol, decimals] = await Promise.all([
        contract.name().catch(() => "Unknown"),
        contract.symbol().catch(() => "???"),
        contract.decimals().catch(() => 18),
      ]);

      const meta = { name: String(name), symbol: String(symbol), decimals: Number(decimals) };
      this.tokenCache.set(address.toLowerCase(), meta);
      return meta;
    } catch {
      return null;
    }
  }

  async decodeContractCreation(txHash: string): Promise<string | null> {
    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);
      if (receipt && receipt.contractAddress) {
        return receipt.contractAddress;
      }
      return null;
    } catch {
      return null;
    }
  }
}
