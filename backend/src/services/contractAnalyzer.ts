import { ethers } from "ethers";

export interface ContractRiskResult {
  contract: string;
  chainId: number;
  risk_score: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  warnings: string[];
  details: {
    isProxy: boolean;
    hasOwnerMint: boolean;
    hasBlacklist: boolean;
    hasTransferTax: boolean;
    hasPauseFunction: boolean;
    hasOwnerWithdraw: boolean;
    hasSelfdestruct: boolean;
    hasHiddenFees: boolean;
    codeSize: number;
    isVerified: boolean;
    ownerAddress: string | null;
    implementationAddress: string | null;
  };
}

const FUNCTION_SIGNATURES: Record<string, { name: string; warning: string; risk: number }> = {
  "40c10f19": { name: "mint(address,uint256)", warning: "owner_mint_enabled", risk: 20 },
  "a0712d68": { name: "mint(uint256)", warning: "public_mint", risk: 15 },
  "4906b849": { name: "blacklist(address)", warning: "blacklist_function", risk: 15 },
  "537df3b6": { name: "unblacklist(address)", warning: "blacklist_function", risk: 15 },
  "8456cb59": { name: "pause()", warning: "pause_function", risk: 5 },
  "3f4ba83a": { name: "unpause()", warning: "pause_function", risk: 5 },
  "ff872245": { name: "setMaxTxAmount()", warning: "transfer_restriction", risk: 10 },
  "a9059cbb": { name: "transfer(address,uint256)", warning: null as any, risk: 0 },
};

// EIP-1967 implementation slot
const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

const BASIC_ERC20_ABI = [
  "function owner() view returns (address)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

export class ContractAnalyzer {
  private providers: Map<number, ethers.JsonRpcProvider> = new Map();

  constructor() {
    if (process.env.ETH_RPC_URL) {
      this.providers.set(1, new ethers.JsonRpcProvider(process.env.ETH_RPC_URL, 1));
    }
    if (process.env.POLYGON_RPC_URL) {
      this.providers.set(137, new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL, 137));
    }
  }

  async analyzeContract(address: string, chainId = 1): Promise<ContractRiskResult> {
    const warnings: string[] = [];
    let riskScore = 0;

    const provider = this.providers.get(chainId);
    if (!provider) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }

    // ── Fetch bytecode ────────────────────────────────────────────────────
    let bytecode = "";
    try {
      bytecode = await provider.getCode(address);
    } catch {
      warnings.push("failed_to_fetch_bytecode");
    }

    if (bytecode === "0x" || bytecode === "") {
      return {
        contract: address,
        chainId,
        risk_score: 0,
        risk_level: "LOW",
        warnings: ["not_a_contract"],
        details: {
          isProxy: false,
          hasOwnerMint: false,
          hasBlacklist: false,
          hasTransferTax: false,
          hasPauseFunction: false,
          hasOwnerWithdraw: false,
          hasSelfdestruct: false,
          hasHiddenFees: false,
          codeSize: 0,
          isVerified: false,
          ownerAddress: null,
          implementationAddress: null,
        },
      };
    }

    const bc = bytecode.toLowerCase();
    const codeSize = (bytecode.length - 2) / 2;

    // ── Bytecode analysis ─────────────────────────────────────────────────
    const hasOwnerMint =
      bc.includes("40c10f19") || bc.includes("a0712d68");
    if (hasOwnerMint) {
      warnings.push("owner_mint_enabled");
      riskScore += 20;
    }

    const hasBlacklist =
      bc.includes("4906b849") || bc.includes("537df3b6");
    if (hasBlacklist) {
      warnings.push("blacklist_function_detected");
      riskScore += 15;
    }

    const hasPauseFunction = bc.includes("8456cb59") || bc.includes("3f4ba83a");
    if (hasPauseFunction) {
      warnings.push("pause_function_detected");
      riskScore += 5;
    }

    // Transfer tax heuristic: large bytecode with fee-like operations
    const hasTransferTax = codeSize > 15000 && (
      bc.includes("_taxFee") ||
      bc.includes("_liquidityFee") ||
      bc.includes("_teamAddress")
    );
    if (hasTransferTax) {
      warnings.push("transfer_tax_detected");
      riskScore += 10;
    }

    // Selfdestruct detection
    const hasSelfdestruct = bc.includes("ff");
    // Note: "ff" is the selfdestruct opcode but is common in bytecode, so we
    // check for it specifically in the context of the contract
    const selfdestructConfirmed = bc.includes("selfdestruct") || (
      // Check for SELFDESTRUCT opcode pattern 0xff with preceding operations
      /ff[0-9a-f]{0,20}$/.test(bc)
    );
    if (selfdestructConfirmed) {
      warnings.push("selfdestruct_detected");
      riskScore += 25;
    }

    // Proxy detection
    const isProxy =
      bc.includes("360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc") ||
      bc.includes("7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3") ||
      bc.includes("delegatecall");

    if (isProxy) {
      warnings.push("upgradeable_proxy_detected");
      riskScore += 10;
    }

    // Hidden fee logic heuristic: complex fee calculations
    const hasHiddenFees = codeSize > 20000 && bc.includes("_rTotal") && bc.includes("_tTotal");
    if (hasHiddenFees) {
      warnings.push("hidden_fee_logic_detected");
      riskScore += 20;
    }

    // Owner withdraw functions
    const hasOwnerWithdraw =
      bc.includes("a2fb1e0f") || // withdraw()
      bc.includes("51cff8d9") || // withdrawBNB()
      bc.includes("b1a1a882");   // withdrawToken()
    if (hasOwnerWithdraw) {
      warnings.push("owner_withdraw_function");
      riskScore += 15;
    }

    // ── Read contract state ────────────────────────────────────────────────
    let ownerAddress: string | null = null;
    try {
      const contract = new ethers.Contract(address, BASIC_ERC20_ABI, provider);
      ownerAddress = await contract.owner();
      if (ownerAddress === ethers.ZeroAddress) {
        ownerAddress = null; // Ownership renounced
      }
    } catch {}

    // ── Get implementation address for proxy ──────────────────────────────
    let implementationAddress: string | null = null;
    if (isProxy) {
      try {
        const implSlot = await provider.getStorage(address, IMPL_SLOT);
        if (implSlot && implSlot !== ethers.ZeroHash) {
          implementationAddress = ethers.getAddress("0x" + implSlot.slice(26));
        }
      } catch {}
    }

    // ── Verification status (rough heuristic) ─────────────────────────────
    const isVerified = bytecode.length > 100; // Has non-trivial bytecode

    riskScore = Math.min(riskScore, 100);
    const riskLevel = this.scoreToLevel(riskScore);

    return {
      contract: address,
      chainId,
      risk_score: riskScore,
      risk_level: riskLevel,
      warnings,
      details: {
        isProxy,
        hasOwnerMint,
        hasBlacklist,
        hasTransferTax,
        hasPauseFunction,
        hasOwnerWithdraw,
        hasSelfdestruct: selfdestructConfirmed,
        hasHiddenFees,
        codeSize,
        isVerified,
        ownerAddress,
        implementationAddress,
      },
    };
  }

  private scoreToLevel(score: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
    if (score >= 75) return "CRITICAL";
    if (score >= 50) return "HIGH";
    if (score >= 25) return "MEDIUM";
    return "LOW";
  }
}
