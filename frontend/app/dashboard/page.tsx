"use client";

import { useEffect, useState } from "react";
import { StatCard } from "@/components/ui/StatCard";
import { getHighRiskTokens, getScamRegistry } from "@/lib/api";
import {
  ShieldCheck, Warning, Coins, Wallet, ArrowSquareOut, TrendUp,
} from "@phosphor-icons/react";
import { truncateAddress, formatUSD, getRiskBg, timeAgo, formatScamType } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid,
} from "recharts";
import Link from "next/link";

// Mock analytics data for demo purposes
const MOCK_DAILY_DATA = Array.from({ length: 14 }, (_, i) => ({
  date: new Date(Date.now() - (13 - i) * 86400000).toLocaleDateString("en", { month: "short", day: "numeric" }),
  walletChecks: Math.floor(Math.random() * 200 + 100),
  scamsDetected: Math.floor(Math.random() * 20 + 5),
  rugPulls: Math.floor(Math.random() * 10 + 2),
}));

export default function DashboardPage() {
  const [highRiskTokens, setHighRiskTokens] = useState<any[]>([]);
  const [recentScams, setRecentScams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getHighRiskTokens(5),
      getScamRegistry({ limit: 5 }),
    ])
      .then(([tokens, scams]) => {
        setHighRiskTokens(tokens.tokens || []);
        setRecentScams(scams.entries || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const riskBorderColors: Record<string, string> = {
    CRITICAL: "border-l-4 border-l-red-500",
    HIGH:     "border-l-4 border-l-orange-500",
    MEDIUM:   "border-l-4 border-l-yellow-500",
    LOW:      "border-l-4 border-l-green-500",
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Intelligence Dashboard</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Real-time blockchain compliance monitoring
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-text-muted">Live</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Scams Verified"
          value="18,427"
          subtitle="+142 this week"
          icon={<Warning size={18} />}
          variant="danger"
          trend={{ value: 8.4, label: "vs last week" }}
        />
        <StatCard
          title="Rug-Pulls Detected"
          value="3,211"
          subtitle="Across all chains"
          icon={<Coins size={18} />}
          variant="warning"
          trend={{ value: 12.1, label: "this month" }}
        />
        <StatCard
          title="Wallets Analysed"
          value="2.4M+"
          subtitle="Total unique wallets"
          icon={<Wallet size={18} />}
          variant="default"
        />
        <StatCard
          title="API Requests"
          value="450K+"
          subtitle="Last 24 hours"
          icon={<TrendUp size={18} />}
          variant="success"
          trend={{ value: 5.2, label: "vs yesterday" }}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Wallet checks chart */}
        <div className="bg-background-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-primary">Wallet Risk Checks (14d)</h3>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={MOCK_DAILY_DATA} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e30" />
              <XAxis dataKey="date" tick={{ fill: "#475569", fontSize: 10 }} />
              <YAxis tick={{ fill: "#475569", fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  background: "#12121e",
                  border: "1px solid #1e1e30",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "#e2e8f0",
                }}
              />
              <Line
                type="monotone"
                dataKey="walletChecks"
                stroke="#6366f1"
                strokeWidth={2}
                dot={false}
                name="Wallet Checks"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Scams detected chart */}
        <div className="bg-background-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-primary">Scams Detected (14d)</h3>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={MOCK_DAILY_DATA} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e30" />
              <XAxis dataKey="date" tick={{ fill: "#475569", fontSize: 10 }} />
              <YAxis tick={{ fill: "#475569", fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  background: "#12121e",
                  border: "1px solid #1e1e30",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "#e2e8f0",
                }}
              />
              <Bar dataKey="scamsDetected" fill="#ef4444" radius={[3, 3, 0, 0]} name="Scams" />
              <Bar dataKey="rugPulls" fill="#f97316" radius={[3, 3, 0, 0]} name="Rug-Pulls" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tables row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* High-risk tokens */}
        <div className="bg-background-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <h3 className="text-sm font-semibold text-text-primary">High-Risk Tokens</h3>
            </div>
            <Link href="/token-risk" className="text-xs text-primary-light hover:underline">
              View all
            </Link>
          </div>

          <div className="divide-y divide-border/50">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <div key={i} className="px-4 py-3 flex gap-3">
                  <div className="flex-1 h-4 bg-background-tertiary rounded animate-pulse" />
                  <div className="w-12 h-4 bg-background-tertiary rounded animate-pulse" />
                </div>
              ))
            ) : highRiskTokens.length === 0 ? (
              <div className="px-4 py-8 text-center text-text-muted text-sm">
                No high-risk tokens indexed yet
              </div>
            ) : (
              highRiskTokens.map((token) => (
                <Link
                  key={token.tokenAddress}
                  href={`/token-risk?address=${token.tokenAddress}`}
                  className={`flex items-center justify-between px-4 py-3 hover:bg-background-hover transition-colors ${riskBorderColors[token.rugRiskLevel] || ""}`}
                >
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {token.tokenName}
                      <span className="text-text-muted ml-1.5 text-xs">({token.tokenSymbol})</span>
                    </p>
                    <p className="text-xs font-mono text-text-muted">{truncateAddress(token.tokenAddress)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-400">{token.rugRiskScore}</p>
                    <p className="text-xs text-text-muted">{timeAgo(token.calculatedAt)}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent scams */}
        <div className="bg-background-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} weight="duotone" className="text-primary-light" />
              <h3 className="text-sm font-semibold text-text-primary">Verified Scam Entries</h3>
            </div>
            <Link href="/scam-registry" className="text-xs text-primary-light hover:underline">
              View all
            </Link>
          </div>

          <div className="divide-y divide-border/50">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <div key={i} className="px-4 py-3 flex gap-3">
                  <div className="flex-1 h-4 bg-background-tertiary rounded animate-pulse" />
                </div>
              ))
            ) : recentScams.length === 0 ? (
              <div className="px-4 py-8 text-center text-text-muted text-sm">
                No verified scam entries yet
              </div>
            ) : (
              recentScams.map((entry) => {
                const address = entry.walletAddress || entry.contractAddress || "";
                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between px-4 py-3 hover:bg-background-hover transition-colors"
                  >
                    <div>
                      <p className="text-xs font-mono text-text-primary">{truncateAddress(address)}</p>
                      <p className="text-xs text-text-muted">{formatScamType(entry.scamType)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${getRiskBg(entry.riskLevel)}`}>
                        {entry.riskLevel}
                      </span>
                      <a
                        href={`https://etherscan.io/address/${address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-text-muted hover:text-text-primary"
                      >
                        <ArrowSquareOut size={13} />
                      </a>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
