import { ethers } from "ethers";

export type ChainId = 1 | 137 | 8453;

interface RPCConfig {
  url: string;
  chainId: ChainId;
  name: string;
}

const RPC_CONFIGS: RPCConfig[] = [
  { url: process.env.ETH_RPC_URL || "", chainId: 1, name: "Ethereum" },
  { url: process.env.POLYGON_RPC_URL || "", chainId: 137, name: "Polygon" },
  { url: process.env.BASE_RPC_URL || "", chainId: 8453, name: "Base" },
];

const providers = new Map<ChainId, ethers.JsonRpcProvider>();

export function getProvider(chainId: ChainId = 1): ethers.JsonRpcProvider {
  if (providers.has(chainId)) {
    return providers.get(chainId)!;
  }

  const config = RPC_CONFIGS.find((c) => c.chainId === chainId);
  if (!config || !config.url) {
    throw new Error(`No RPC URL configured for chain ${chainId}`);
  }

  const provider = new ethers.JsonRpcProvider(config.url, chainId, {
    staticNetwork: ethers.Network.from(chainId),
  });

  providers.set(chainId, provider);
  return provider;
}

export function getEthProvider(): ethers.JsonRpcProvider {
  return getProvider(1);
}

export async function getLatestBlock(chainId: ChainId = 1): Promise<number> {
  const provider = getProvider(chainId);
  return provider.getBlockNumber();
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
  }
  throw new Error("Max retries exceeded");
}
