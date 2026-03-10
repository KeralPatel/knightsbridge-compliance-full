"use client";

import { useState } from "react";
import { AddressInput } from "@/components/ui/AddressInput";
import { RiskGauge } from "@/components/ui/RiskGauge";
import { FlagList } from "@/components/ui/FlagBadge";
import { getContractRisk } from "@/lib/api";
import { truncateAddress, getRiskBg } from "@/lib/utils";
import { Code, ArrowSquareOut, CheckCircle, XCircle } from "@phosphor-icons/react";
import toast from "react-hot-toast";

interface ContractFeature {
  label: string;
  key: keyof ContractDetails;
  dangerIfTrue: boolean;
  description: string;
}

interface ContractDetails {
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
}

const CONTRACT_FEATURES: ContractFeature[] = [
  { label: "Upgradeable Proxy",    key: "isProxy",          dangerIfTrue: true,  description: "Contract can be upgraded, logic may change" },
  { label: "Owner Mint",           key: "hasOwnerMint",     dangerIfTrue: true,  description: "Owner can mint unlimited new tokens" },
  { label: "Blacklist Function",   key: "hasBlacklist",     dangerIfTrue: true,  description: "Owner can block wallets from transacting" },
  { label: "Transfer Tax",         key: "hasTransferTax",   dangerIfTrue: true,  description: "Fees taken on every token transfer" },
  { label: "Pause Function",       key: "hasPauseFunction", dangerIfTrue: true,  description: "Owner can halt all transfers" },
  { label: "Owner Withdraw",       key: "hasOwnerWithdraw", dangerIfTrue: true,  description: "Owner can drain contract funds" },
  { label: "Self-Destruct",        key: "hasSelfdestruct",  dangerIfTrue: true,  description: "Contract can destroy itself, erasing all data" },
  { label: "Hidden Fees",          key: "hasHiddenFees",    dangerIfTrue: true,  description: "Complex fee logic detected in bytecode" },
  { label: "Source Verified",      key: "isVerified",       dangerIfTrue: false, description: "Source code has been verified" },
];

export default function ContractScannerPage() {
  const [result, setResult] = useState<any>(null);

  const analyze = async (address: string) => {
    const data = await getContractRisk(address);
    setResult(data);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <Code size={22} weight="duotone" className="text-violet-400" />
          Smart Contract Scanner
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Bytecode-level analysis of smart contracts. Detects dangerous functions, rug mechanisms and hidden logic.
        </p>
      </div>

      <div className="bg-background-card border border-border rounded-xl p-5">
        <AddressInput
          onAnalyze={analyze}
          placeholder="Contract address (0x...)"
          label="Contract Address"
        />
      </div>

      {result && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-slide-up">
          {/* Gauge */}
          <div className="bg-background-card border border-border rounded-xl p-6 flex flex-col items-center justify-center gap-4">
            <RiskGauge score={result.risk_score} size="lg" />
            <div>
              <p className="text-xs text-text-muted text-center">Code Size</p>
              <p className="text-sm text-text-primary text-center font-mono">
                {result.details.codeSize.toLocaleString()} bytes
              </p>
            </div>
          </div>

          {/* Details */}
          <div className="md:col-span-2 bg-background-card border border-border rounded-xl p-5 space-y-4">
            {/* Address */}
            <div className="flex items-center justify-between">
              <p className="font-mono text-sm text-text-primary">{truncateAddress(result.contract, 8)}</p>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getRiskBg(result.risk_level)}`}>
                  {result.risk_level} RISK
                </span>
                <a
                  href={`https://etherscan.io/address/${result.contract}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-text-muted hover:text-text-primary"
                >
                  <ArrowSquareOut size={14} />
                </a>
              </div>
            </div>

            {/* Feature checklist */}
            <div className="grid grid-cols-1 gap-1.5">
              {CONTRACT_FEATURES.map((feature) => {
                const value = result.details[feature.key];
                const isDangerous = feature.dangerIfTrue ? value : !value;
                const isPresent = Boolean(value);

                return (
                  <div
                    key={feature.key}
                    className={`flex items-center gap-3 p-2.5 rounded-lg text-sm
                      ${isDangerous ? "bg-red-500/5 border border-red-500/10" : "bg-green-500/5 border border-green-500/10"}`}
                  >
                    {isDangerous ? (
                      <XCircle size={16} weight="fill" className="text-red-400 flex-shrink-0" />
                    ) : (
                      <CheckCircle size={16} weight="fill" className="text-green-400 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-xs ${isDangerous ? "text-red-300" : "text-green-300"}`}>
                        {feature.label}
                        <span className="ml-2 text-text-muted font-normal">{feature.description}</span>
                      </p>
                    </div>
                    <span className={`text-xs font-semibold flex-shrink-0 ${isDangerous ? "text-red-400" : "text-green-400"}`}>
                      {isPresent ? "YES" : "NO"}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Owner info */}
            {result.details.ownerAddress && (
              <div className="pt-3 border-t border-border flex items-center justify-between">
                <span className="text-xs text-text-muted">Owner Address</span>
                <a
                  href={`https://etherscan.io/address/${result.details.ownerAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs font-mono text-primary-light hover:underline"
                >
                  {truncateAddress(result.details.ownerAddress)}
                  <ArrowSquareOut size={11} />
                </a>
              </div>
            )}

            {result.details.implementationAddress && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Implementation (Proxy)</span>
                <a
                  href={`https://etherscan.io/address/${result.details.implementationAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs font-mono text-primary-light hover:underline"
                >
                  {truncateAddress(result.details.implementationAddress)}
                  <ArrowSquareOut size={11} />
                </a>
              </div>
            )}

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div className="pt-3 border-t border-border">
                <p className="text-xs text-text-muted uppercase tracking-wide mb-2">Active Warnings</p>
                <FlagList flags={result.warnings} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
