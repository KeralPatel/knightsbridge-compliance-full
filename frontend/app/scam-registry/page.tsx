"use client";

import { useEffect, useState } from "react";
import { getScamRegistry } from "@/lib/api";
import { truncateAddress, getRiskBg, formatScamType, timeAgo } from "@/lib/utils";
import { Warning, ArrowSquareOut, MagnifyingGlass, FunnelSimple } from "@phosphor-icons/react";
import { FlagBadge } from "@/components/ui/FlagBadge";

interface ScamEntry {
  id: string;
  walletAddress: string | null;
  contractAddress: string | null;
  scamType: string;
  riskScore: number;
  riskLevel: string;
  description: string;
  evidenceIpfsHash: string | null;
  verificationStatus: string;
  createdAt: string;
}

const SCAM_TYPES = [
  "ALL", "RUG_PULL", "PHISHING", "HONEYPOT", "FAKE_TOKEN",
  "PUMP_AND_DUMP", "MIXER", "MALICIOUS_CONTRACT", "EXPLOIT",
];

const RISK_LEVELS = ["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"];

export default function ScamRegistryPage() {
  const [entries, setEntries] = useState<ScamEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [scamType, setScamType] = useState("ALL");
  const [riskLevel, setRiskLevel] = useState("ALL");
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const load = async () => {
    setLoading(true);
    try {
      const data = await getScamRegistry({
        limit,
        offset,
        scamType: scamType !== "ALL" ? scamType : undefined,
        riskLevel: riskLevel !== "ALL" ? riskLevel : undefined,
        search: search || undefined,
      });
      setEntries(data.entries || []);
      setTotal(data.total || 0);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [offset, scamType, riskLevel]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    load();
  };

  const riskColors: Record<string, string> = {
    CRITICAL: "bg-red-500/10 text-red-400 border-red-500/20",
    HIGH:     "bg-orange-500/10 text-orange-400 border-orange-500/20",
    MEDIUM:   "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    LOW:      "bg-green-500/10 text-green-400 border-green-500/20",
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <Warning size={22} weight="duotone" className="text-red-400" />
            Scam Registry
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {total.toLocaleString()} verified scam entries in the database.
          </p>
        </div>
        <span className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
          {total.toLocaleString()} Entries
        </span>
      </div>

      {/* Filters */}
      <div className="bg-background-card border border-border rounded-xl p-4 flex flex-wrap gap-3">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
          <div className="relative">
            <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search address or description..."
              className="w-full bg-background-tertiary border border-border rounded-lg pl-8 pr-4 py-2 text-sm
                         text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary/50"
            />
          </div>
        </form>

        {/* Scam type filter */}
        <select
          value={scamType}
          onChange={(e) => { setScamType(e.target.value); setOffset(0); }}
          className="bg-background-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary
                     focus:outline-none focus:border-primary/50"
        >
          {SCAM_TYPES.map((t) => (
            <option key={t} value={t}>{t === "ALL" ? "All Types" : formatScamType(t)}</option>
          ))}
        </select>

        {/* Risk level filter */}
        <select
          value={riskLevel}
          onChange={(e) => { setRiskLevel(e.target.value); setOffset(0); }}
          className="bg-background-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary
                     focus:outline-none focus:border-primary/50"
        >
          {RISK_LEVELS.map((l) => (
            <option key={l} value={l}>{l === "ALL" ? "All Levels" : l}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-background-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-muted text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-medium">Address</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Risk</th>
                <th className="text-left px-4 py-3 font-medium">Score</th>
                <th className="text-left px-4 py-3 font-medium">Evidence</th>
                <th className="text-left px-4 py-3 font-medium">Reported</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {[...Array(7)].map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-background-tertiary rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-text-muted">
                    No entries found
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const address = entry.walletAddress || entry.contractAddress || "";
                  const isContract = Boolean(entry.contractAddress);

                  return (
                    <tr
                      key={entry.id}
                      className="border-b border-border/50 hover:bg-background-hover/50 transition-colors"
                    >
                      {/* Address */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded text-text-muted border border-border font-mono`}>
                            {isContract ? "CONTRACT" : "WALLET"}
                          </span>
                          <span className="font-mono text-xs text-text-primary">{truncateAddress(address)}</span>
                        </div>
                      </td>

                      {/* Scam type */}
                      <td className="px-4 py-3">
                        <span className="text-xs text-text-secondary">{formatScamType(entry.scamType)}</span>
                      </td>

                      {/* Risk level */}
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${riskColors[entry.riskLevel] || ""}`}>
                          {entry.riskLevel}
                        </span>
                      </td>

                      {/* Score */}
                      <td className="px-4 py-3">
                        <span className="text-sm font-bold tabular-nums text-text-primary">{entry.riskScore}</span>
                      </td>

                      {/* Evidence */}
                      <td className="px-4 py-3">
                        {entry.evidenceIpfsHash ? (
                          <a
                            href={`${process.env.NEXT_PUBLIC_PINATA_GATEWAY || "https://gateway.pinata.cloud/ipfs/"}${entry.evidenceIpfsHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-xs text-primary-light hover:underline"
                          >
                            IPFS <ArrowSquareOut size={11} />
                          </a>
                        ) : (
                          <span className="text-xs text-text-muted">—</span>
                        )}
                      </td>

                      {/* Time */}
                      <td className="px-4 py-3">
                        <span className="text-xs text-text-muted">{timeAgo(entry.createdAt)}</span>
                      </td>

                      {/* Etherscan link */}
                      <td className="px-4 py-3">
                        <a
                          href={`https://etherscan.io/address/${address}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-text-muted hover:text-text-primary"
                        >
                          <ArrowSquareOut size={14} />
                        </a>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > limit && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between">
            <span className="text-xs text-text-muted">
              Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="px-3 py-1.5 text-xs rounded-md bg-background-tertiary border border-border
                           text-text-secondary hover:text-text-primary disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
                className="px-3 py-1.5 text-xs rounded-md bg-background-tertiary border border-border
                           text-text-secondary hover:text-text-primary disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
