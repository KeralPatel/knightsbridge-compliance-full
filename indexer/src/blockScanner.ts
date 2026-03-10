import { ethers } from "ethers";
import type { Logger } from "pino";
import { getProvider, withRetry } from "./utils/rpc";
import { getPrismaClient } from "./utils/prisma";
import { EventDecoder } from "./handlers/eventDecoder";
import { RugPullDetector } from "./engines/rugPullDetector";
import { PaymentDetector } from "./paymentDetector";
import {
  PAIR_CREATED_TOPIC,
  POOL_CREATED_V3_TOPIC,
  ERC20_TRANSFER_TOPIC,
  UNISWAP_V2_FACTORY_ABI,
  UNISWAP_V3_FACTORY_ABI,
} from "./utils/abis";

export class BlockScanner {
  private logger: Logger;
  private rugPullDetector: RugPullDetector;
  private paymentDetector: PaymentDetector;
  private eventDecoder: EventDecoder;
  private provider: ethers.JsonRpcProvider;
  private prisma = getPrismaClient();
  private running = false;
  private currentBlock = 0;
  private processedBlocks = 0;

  // Known DEX factory addresses on Ethereum mainnet
  private readonly DEX_FACTORIES: Record<string, string> = {
    uniswapV2: process.env.UNISWAP_V2_FACTORY || "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
    uniswapV3: process.env.UNISWAP_V3_FACTORY || "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    sushiswap: process.env.SUSHISWAP_FACTORY  || "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac",
  };

  constructor(logger: Logger, rugPullDetector: RugPullDetector, paymentDetector: PaymentDetector) {
    this.logger = logger.child({ component: "BlockScanner" });
    this.rugPullDetector = rugPullDetector;
    this.paymentDetector = paymentDetector;
    this.provider = getProvider(1);
    this.eventDecoder = new EventDecoder(this.logger, this.provider);
  }

  async start(): Promise<void> {
    this.running = true;
    this.logger.info("Starting block scanner...");

    // Determine start block
    const startBlockEnv = process.env.INDEXER_START_BLOCK;
    if (startBlockEnv && startBlockEnv !== "latest") {
      this.currentBlock = parseInt(startBlockEnv, 10);
    } else {
      this.currentBlock = await withRetry(() => this.provider.getBlockNumber()) - 5;
    }

    this.logger.info({ startBlock: this.currentBlock }, "Block scanner started");

    while (this.running) {
      try {
        await this.scanNewBlocks();
      } catch (err) {
        this.logger.error({ err }, "Error in block scanner loop");
      }

      // Poll interval
      const pollInterval = parseInt(process.env.INDEXER_POLL_INTERVAL_MS || "5000", 10);
      await new Promise((r) => setTimeout(r, pollInterval));
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    this.logger.info("Block scanner stopped");
  }

  private async scanNewBlocks(): Promise<void> {
    const latestBlock = await withRetry(() => this.provider.getBlockNumber());

    if (latestBlock <= this.currentBlock) return;

    const batchSize = parseInt(process.env.INDEXER_BATCH_SIZE || "100", 10);
    const toBlock = Math.min(this.currentBlock + batchSize, latestBlock);

    this.logger.debug({ from: this.currentBlock + 1, to: toBlock }, "Scanning blocks");

    // Fetch logs in parallel for efficiency
    await Promise.all([
      this.scanTokenCreations(this.currentBlock + 1, toBlock),
      this.scanTransfers(this.currentBlock + 1, toBlock),
      this.paymentDetector.scanForPayments(this.currentBlock + 1, toBlock),
    ]);

    // Index the blocks
    await this.indexBlocks(this.currentBlock + 1, toBlock);

    this.currentBlock = toBlock;
    this.processedBlocks += toBlock - this.currentBlock + 1;

    if (this.processedBlocks % 10 === 0) {
      this.logger.info({
        currentBlock: this.currentBlock,
        latestBlock,
        behind: latestBlock - this.currentBlock,
      }, "Indexer status");
    }
  }

  private async scanTokenCreations(fromBlock: number, toBlock: number): Promise<void> {
    try {
      // Scan for Uniswap V2 PairCreated events
      const v2Logs = await withRetry(() =>
        this.provider.getLogs({
          fromBlock,
          toBlock,
          address: Object.values(this.DEX_FACTORIES),
          topics: [PAIR_CREATED_TOPIC],
        })
      );

      // Scan for Uniswap V3 PoolCreated events
      const v3Logs = await withRetry(() =>
        this.provider.getLogs({
          fromBlock,
          toBlock,
          address: this.DEX_FACTORIES.uniswapV3,
          topics: [POOL_CREATED_V3_TOPIC],
        })
      );

      const allPairLogs = [...v2Logs, ...v3Logs];

      for (const log of allPairLogs) {
        await this.handleNewPair(log).catch((err) =>
          this.logger.warn({ err, txHash: log.transactionHash }, "Failed to handle new pair")
        );
      }
    } catch (err) {
      this.logger.warn({ err, fromBlock, toBlock }, "Failed to scan token creations");
    }
  }

  private async scanTransfers(fromBlock: number, toBlock: number): Promise<void> {
    try {
      // Only scan large transfers to avoid DB overload
      // In production, you'd filter by minimum value
      const logs = await withRetry(() =>
        this.provider.getLogs({
          fromBlock,
          toBlock,
          topics: [ERC20_TRANSFER_TOPIC],
        })
      );

      // Process in batches to avoid overwhelming the DB
      const PROCESS_BATCH = 50;
      for (let i = 0; i < logs.length; i += PROCESS_BATCH) {
        const batch = logs.slice(i, i + PROCESS_BATCH);
        await Promise.allSettled(
          batch.map((log) => this.eventDecoder.decodeTransferEvent(log))
        );
      }
    } catch (err) {
      this.logger.warn({ err, fromBlock, toBlock }, "Failed to scan transfers");
    }
  }

  private async handleNewPair(log: ethers.Log): Promise<void> {
    let token0: string, token1: string, pairAddress: string;

    // Determine DEX type and factory
    const dexEntry = Object.entries(this.DEX_FACTORIES).find(
      ([, addr]) => addr.toLowerCase() === log.address.toLowerCase()
    );
    const dexName = dexEntry ? dexEntry[0] : "unknown";

    if (log.topics[0] === PAIR_CREATED_TOPIC) {
      // Uniswap V2 style: PairCreated(token0, token1, pair, uint)
      const iface = new ethers.Interface(UNISWAP_V2_FACTORY_ABI);
      try {
        const decoded = iface.decodeEventLog("PairCreated", log.data, log.topics);
        token0 = decoded[0] as string;
        token1 = decoded[1] as string;
        pairAddress = decoded[2] as string;
      } catch {
        return;
      }
    } else if (log.topics[0] === POOL_CREATED_V3_TOPIC) {
      const iface = new ethers.Interface(UNISWAP_V3_FACTORY_ABI);
      try {
        const decoded = iface.decodeEventLog("PoolCreated", log.data, log.topics);
        token0 = decoded[0] as string;
        token1 = decoded[1] as string;
        pairAddress = decoded[4] as string;
      } catch {
        return;
      }
    } else {
      return;
    }

    this.logger.info({ token0, token1, pair: pairAddress, dex: dexName }, "New liquidity pair detected");

    // Get block info for timestamp
    let blockTimestamp = Date.now();
    try {
      const block = await this.provider.getBlock(log.blockNumber);
      if (block) blockTimestamp = Number(block.timestamp) * 1000;
    } catch {}

    // Store pool
    await this.prisma.liquidityPool.upsert({
      where: { poolAddress: pairAddress.toLowerCase() },
      update: { updatedAt: new Date() },
      create: {
        poolAddress: pairAddress.toLowerCase(),
        chainId: 1,
        dex: dexName,
        token0: token0.toLowerCase(),
        token1: token1.toLowerCase(),
        createdAtBlock: BigInt(log.blockNumber),
        createdAt: new Date(blockTimestamp),
      },
    }).catch(() => {});

    // Queue rug-pull analysis for the new token
    // Identify which token is "new" (non-WETH/USDC/etc)
    const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2".toLowerCase();
    const newToken = token0.toLowerCase() !== WETH ? token0 : token1;

    // Analyse asynchronously (don't block scanner)
    this.rugPullDetector
      .analyzeToken(newToken, pairAddress)
      .catch((err) => this.logger.warn({ err, token: newToken }, "Rug analysis failed"));
  }

  private async indexBlocks(fromBlock: number, toBlock: number): Promise<void> {
    // Index a sampling of blocks (every 5th to avoid DB overload in production)
    const blocksToIndex: number[] = [];
    for (let b = fromBlock; b <= toBlock; b += 5) {
      blocksToIndex.push(b);
    }

    await Promise.allSettled(
      blocksToIndex.map(async (blockNum) => {
        try {
          const block = await withRetry(() => this.provider.getBlock(blockNum));
          if (!block) return;

          await this.prisma.indexedBlock.upsert({
            where: { blockNumber: BigInt(block.number) },
            update: {},
            create: {
              blockNumber: BigInt(block.number),
              blockHash: block.hash || "",
              chainId: 1,
              timestamp: new Date(Number(block.timestamp) * 1000),
              txCount: block.transactions.length,
            },
          });
        } catch {}
      })
    );
  }
}
