"use client";

import { useState, useEffect } from "react";
import { AddressInput } from "@/components/ui/AddressInput";
import { RiskGauge } from "@/components/ui/RiskGauge";
import { FlagList } from "@/components/ui/FlagBadge";
import { getTokenRugRisk, getHighRiskTokens } from "@/lib/api";
import { truncateAddress, formatUSD, getRiskBg, timeAgo } from "@/lib/utils";
import { Coins, ArrowSquareOut, Warning } from "@phosphor-icons/react";
import toast from "react-hot-toast";

interface HighRiskToken {
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  rugRiskScore: number;
  rugRiskLevel: string;
  warnings: string[];
  liquidityUSD: number;
  calculatedAt: string;
}

export default function TokenRiskPage() {
  const [result, setResult] = useState<any>(null);
  const [highRisk, setHighRisk] = useState<HighRiskToken[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);

  useEffect(() => {
    getHighRiskTokens(10)
      .then((d) => setHighRisk(d.tokens || []))
      .catch(() => {})
      .finally(() => setLoadingFeed(false));
  }, []);

  const analyze = async (address: string) => {
    const data = await getTokenRugRisk(address);
    setResult(data);
  };

  const riskColors: Record<string, string> = {
    CRITICAL: "text-red-400",
    HIGH: "text-orange-400",
    MEDIUM: "text-yellow-400",
    LOW: "text-green-400",
    UNKNOWN: "text-gray-400",
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <Coins size={22} weight="duotone" className="text-orange-400" />
          Token Rug-Pull Detector
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Analyse any ERC-20 token for rug-pull signals — dev wallet concentration,
          liquidity locks, dangerous functions and more.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Analyser */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-background-card border border-border rounded-xl p-5">
            <AddressInput
              onAnalyze={analyze}
              placeholder="Token contract address (0x...)"
              label="Token Address"
            />
          </div>

          {result && (
            <div className="space-y-4 animate-slide-up">
              {/* Risk overview */}
              <div className="bg-background-card border border-border rounded-xl p-5">
                <div className="flex items-start gap-6">
                  <RiskGauge score={result.rug_risk_score ?? 0} size="md" />
                  <div className="flex-1 space-y-3">
                    <div>
                      <p className="text-lg font-bold text-text-primary">
                        {result.tokenName}
                        <span className="text-text-muted font-normal ml-2 text-sm">({result.tokenSymbol})</span>
                      </p>
                      <p className="font-mono text-xs text-text-muted mt-0.5">{result.token}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-bold ${riskColors[result.rug_risk_level] || "text-gray-400"}`}>
                        {result.rug_risk_level} RUG RISK
                      </span>
                      {result.rug_risk_score !== null && (
                        <span className="text-text-muted text-sm">Score: {result.rug_risk_score}/100</span>
                      )}
                    </div>

                    {result.warnings?.length > 0 && (
                      <FlagList flags={result.warnings} />
                    )}
                  </div>
                </div>
              </div>

              {/* Detail breakdown */}
              {result.details && (
                <div className="bg-background-card border border-border rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-text-secondary mb-4 uppercase tracking-wide">
                    Analysis Details
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Dev Wallet %", value: `${result.details.devWalletPercent?.toFixed(1)}%`, danger: result.details.devWalletPercent > 20 },
                      { label: "Liquidity USD", value: formatUSD(result.details.liquidityUSD), danger: result.details.liquidityUSD < 5000 },
                      { label: "Liquidity Locked", value: result.details.liquidityLocked ? "Yes" : "No", danger: !result.details.liquidityLocked },
                      { label: "Owner Can Mint", value: result.details.hasOwnerMint ? "Yes" : "No", danger: result.details.hasOwnerMint },
                      { label: "Blacklist", value: result.details.hasBlacklist ? "Yes" : "No", danger: result.details.hasBlacklist },
                      { label: "Transfer Tax", value: result.details.hasTransferTax ? "Yes" : "No", danger: result.details.hasTransferTax },
                      { label: "Verified", value: result.details.isVerified ? "Yes" : "No", danger: !result.details.isVerified },
                      { label: "Total Supply", value: result.details.totalSupply ? parseInt(result.details.totalSupply).toLocaleString() : "N/A", danger: false },
                    ].map(({ label, value, danger }) => (
                      <div key={label} className="flex justify-between items-center py-2 border-b border-border/50">
                        <span className="text-xs text-text-muted">{label}</span>
                        <span className={`text-xs font-medium ${danger ? "text-red-400" : "text-text-primary"}`}>
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {result.details.deployerAddress && result.details.deployerAddress !== "0x0000000000000000000000000000000000000000" && (
                    <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                      <span className="text-xs text-text-muted">Deployer</span>
                      <a
                        href={`https://etherscan.io/address/${result.details.deployerAddress}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs font-mono text-primary-light hover:underline"
                      >
                        {truncateAddress(result.details.deployerAddress)}
                        <ArrowSquareOut size={12} />
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: High-risk feed */}
        <div className="bg-background-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Warning size={16} weight="duotone" className="text-red-400" />
            <h3 className="text-sm font-semibold text-text-primary">High-Risk Feed</h3>
            <span className="ml-auto text-xs text-text-muted">Live</span>
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          </div>

          {loadingFeed ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 rounded-lg bg-background-tertiary animate-pulse" />
              ))}
            </div>
          ) : highRisk.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-8">No high-risk tokens indexed yet</p>
          ) : (
            <div className="space-y-2">
              {highRisk.map((token) => (
                <button
                  key={token.tokenAddress}
                  onClick={() => {
                    setResult({
                      token: token.tokenAddress,
                      tokenName: token.tokenName,
                      tokenSymbol: token.tokenSymbol,
                      rug_risk_score: token.rugRiskScore,
                      rug_risk_level: token.rugRiskLevel,
                      warnings: token.warnings,
                      details: { liquidityUSD: token.liquidityUSD },
                    });
                  }}
                  className="w-full text-left p-3 rounded-lg bg-background-tertiary hover:bg-background-hover
                             border border-border hover:border-red-500/30 transition-all"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-text-primary">
                      {token.tokenName}
                      <span className="text-text-muted ml-1">({token.tokenSymbol})</span>
                    </span>
                    <span className={`text-xs font-bold ${riskColors[token.rugRiskLevel] || ""}`}>
                      {token.rugRiskScore}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-text-muted truncate">{truncateAddress(token.tokenAddress)}</p>
                  <p className="text-xs text-text-muted mt-0.5">{timeAgo(token.calculatedAt)}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
