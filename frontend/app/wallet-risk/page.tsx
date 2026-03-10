"use client";

import { useState } from "react";
import { AddressInput } from "@/components/ui/AddressInput";
import { RiskGauge, RiskBar } from "@/components/ui/RiskGauge";
import { FlagList } from "@/components/ui/FlagBadge";
import { StatCard } from "@/components/ui/StatCard";
import { getWalletRisk } from "@/lib/api";
import { truncateAddress, getRiskBg, formatNumber } from "@/lib/utils";
import { Wallet, Copy, ArrowSquareOut, ShieldWarning, CheckCircle } from "@phosphor-icons/react";
import toast from "react-hot-toast";
import type { Metadata } from "next";

interface WalletRiskResult {
  wallet: string;
  chainId: number;
  risk_score: number;
  risk_level: string;
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

const DETAIL_ROWS = [
  { key: "scamInteractions",  label: "Scam Interactions",    danger: (v: number) => v > 0 },
  { key: "rugInteractions",   label: "Rug Token Interactions", danger: (v: number) => v > 0 },
  { key: "mixerInteractions", label: "Mixer Interactions",   danger: (v: number) => v > 0 },
  { key: "txCount",           label: "Transactions Indexed", danger: () => false },
];

export default function WalletRiskPage() {
  const [result, setResult] = useState<WalletRiskResult | null>(null);
  const [loading, setLoading] = useState(false);

  const analyze = async (address: string) => {
    setLoading(true);
    try {
      const data = await getWalletRisk(address);
      setResult(data);
    } catch (err: any) {
      const msg = err.response?.data?.message || "Analysis failed. Check your API key.";
      toast.error(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <Wallet size={22} weight="duotone" className="text-blue-400" />
          Wallet Risk Analyser
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Enter any Ethereum wallet address to check its risk score and interaction history.
        </p>
      </div>

      {/* Input */}
      <div className="bg-background-card border border-border rounded-xl p-5">
        <AddressInput
          onAnalyze={analyze}
          placeholder="0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
          label="Wallet Address"
        />
      </div>

      {/* Result */}
      {result && (
        <div className="space-y-4 animate-slide-up">
          {/* Top row: gauge + summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Risk gauge */}
            <div className="bg-background-card border border-border rounded-xl p-6 flex flex-col items-center justify-center gap-4">
              <RiskGauge score={result.risk_score} size="lg" />
              {result.cached && (
                <p className="text-xs text-text-muted">Cached result</p>
              )}
            </div>

            {/* Address info + flags */}
            <div className="md:col-span-2 bg-background-card border border-border rounded-xl p-5 space-y-4">
              {/* Address */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-text-muted uppercase tracking-wide mb-1">Wallet Address</p>
                  <p className="font-mono text-sm text-text-primary break-all">{result.wallet}</p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => copy(result.wallet)}
                    className="p-1.5 rounded-md bg-background-tertiary hover:bg-background-hover text-text-muted hover:text-text-primary transition-colors"
                  >
                    <Copy size={14} />
                  </button>
                  <a
                    href={`https://etherscan.io/address/${result.wallet}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-md bg-background-tertiary hover:bg-background-hover text-text-muted hover:text-text-primary transition-colors"
                  >
                    <ArrowSquareOut size={14} />
                  </a>
                </div>
              </div>

              {/* Risk level */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-text-muted">Risk Score</span>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${getRiskBg(result.risk_level)}`}
                  >
                    {result.risk_level}
                  </span>
                </div>
                <RiskBar score={result.risk_score} />
                <div className="flex justify-between text-xs text-text-muted mt-1">
                  <span>0</span>
                  <span className="font-medium text-text-secondary">{result.risk_score}/100</span>
                  <span>100</span>
                </div>
              </div>

              {/* Flags */}
              {result.flags.length > 0 && (
                <div>
                  <p className="text-xs text-text-muted uppercase tracking-wide mb-2">Risk Signals</p>
                  <FlagList flags={result.flags} />
                </div>
              )}

              {result.flags.length === 0 && (
                <div className="flex items-center gap-2 text-green-400 text-sm">
                  <CheckCircle size={16} weight="fill" />
                  No risk signals detected
                </div>
              )}
            </div>
          </div>

          {/* Detail stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              title="Scam Interactions"
              value={result.details.scamInteractions}
              icon={<ShieldWarning size={18} />}
              variant={result.details.scamInteractions > 0 ? "danger" : "success"}
            />
            <StatCard
              title="Rug Token Contacts"
              value={result.details.rugInteractions}
              icon={<ShieldWarning size={18} />}
              variant={result.details.rugInteractions > 0 ? "danger" : "default"}
            />
            <StatCard
              title="Mixer Contacts"
              value={result.details.mixerInteractions}
              icon={<ShieldWarning size={18} />}
              variant={result.details.mixerInteractions > 0 ? "warning" : "default"}
            />
            <StatCard
              title="TXs Indexed"
              value={formatNumber(result.details.txCount)}
              icon={<Wallet size={18} />}
              variant="default"
            />
          </div>

          {/* Raw JSON for advanced users */}
          <details className="bg-background-card border border-border rounded-xl overflow-hidden">
            <summary className="px-5 py-3 text-sm text-text-secondary cursor-pointer hover:text-text-primary flex items-center gap-2">
              <span>View Raw Response</span>
            </summary>
            <pre className="px-5 pb-5 text-xs font-mono text-text-secondary overflow-x-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {/* Usage hint */}
      {!result && (
        <div className="bg-background-card/50 border border-border rounded-xl p-6 text-center">
          <Wallet size={32} weight="duotone" className="text-text-muted mx-auto mb-3" />
          <p className="text-sm text-text-secondary">
            Enter a wallet address above to analyse its risk profile.
          </p>
          <p className="text-xs text-text-muted mt-1">
            Requires an active API key. <a href="/api-plans" className="text-primary-light hover:underline">Get one here.</a>
          </p>
        </div>
      )}
    </div>
  );
}
