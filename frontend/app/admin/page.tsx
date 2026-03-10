"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { StatCard } from "@/components/ui/StatCard";
import {
  Users, CreditCard, Warning, ShieldCheck, ChartBar,
  CheckCircle, XCircle,
} from "@phosphor-icons/react";
import toast from "react-hot-toast";
import { formatUSD, timeAgo } from "@/lib/utils";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

function adminApi(path: string) {
  const key = typeof window !== "undefined" ? localStorage.getItem("kcc_admin_key") || "" : "";
  return axios.get(`${BACKEND}${path}`, { headers: { "x-api-key": key } });
}

function adminPost(path: string, body: any) {
  const key = typeof window !== "undefined" ? localStorage.getItem("kcc_admin_key") || "" : "";
  return axios.post(`${BACKEND}${path}`, body, { headers: { "x-api-key": key } });
}

export default function AdminPage() {
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [adminKey, setAdminKey] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<"stats" | "users" | "payments" | "reports">("stats");

  const authenticate = async (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("kcc_admin_key", adminKey);
    try {
      const { data } = await axios.get(`${BACKEND}/admin/stats`, {
        headers: { "x-api-key": adminKey },
      });
      setStats(data);
      setAuthenticated(true);
      toast.success("Admin access granted");
    } catch {
      toast.error("Invalid admin credentials");
      localStorage.removeItem("kcc_admin_key");
    }
  };

  const loadTab = async (tab: typeof activeTab) => {
    setActiveTab(tab);
    try {
      if (tab === "stats") {
        const { data } = await adminApi("/admin/stats");
        setStats(data);
      } else if (tab === "users") {
        const { data } = await adminApi("/admin/api-users");
        setUsers(data.users || []);
      } else if (tab === "payments") {
        const { data } = await adminApi("/admin/payments");
        setPayments(data.payments || []);
      } else if (tab === "reports") {
        const { data } = await adminApi("/admin/reports/pending");
        setReports(data.reports || []);
      }
    } catch (err: any) {
      toast.error("Failed to load data");
    }
  };

  const verifyReport = async (id: string, riskScore: number) => {
    try {
      await adminPost(`/admin/reports/${id}/verify`, { riskScore, notes: "Verified by admin" });
      setReports((prev) => prev.filter((r) => r.id !== id));
      toast.success("Report verified and added to registry");
    } catch {
      toast.error("Failed to verify report");
    }
  };

  const rejectReport = async (id: string) => {
    try {
      await adminPost(`/admin/reports/${id}/reject`, { reason: "Insufficient evidence" });
      setReports((prev) => prev.filter((r) => r.id !== id));
      toast.success("Report rejected");
    } catch {
      toast.error("Failed to reject report");
    }
  };

  if (!authenticated) {
    return (
      <div className="p-6 max-w-md mx-auto mt-20">
        <div className="bg-background-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <ShieldCheck size={20} weight="duotone" className="text-primary-light" />
            Admin Access
          </h2>
          <form onSubmit={authenticate} className="space-y-4">
            <div>
              <label className="block text-xs text-text-muted mb-1.5">Admin API Key</label>
              <input
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="Enter admin key..."
                className="w-full bg-background-tertiary border border-border rounded-lg px-3 py-2.5 text-sm
                           text-text-primary focus:outline-none focus:border-primary/50"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors"
            >
              Authenticate
            </button>
          </form>
        </div>
      </div>
    );
  }

  const tabs = [
    { key: "stats" as const, label: "Overview", icon: ChartBar },
    { key: "users" as const, label: "API Users", icon: Users },
    { key: "payments" as const, label: "Payments", icon: CreditCard },
    { key: "reports" as const, label: "Pending Reports", icon: Warning },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">Admin Dashboard</h1>
        <span className="text-xs text-green-400 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          Authenticated
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => loadTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
              ${activeTab === key
                ? "border-primary text-primary-light"
                : "border-transparent text-text-muted hover:text-text-secondary"
              }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Stats tab */}
      {activeTab === "stats" && stats && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Total Users" value={stats.users.total} icon={<Users size={18} />} />
            <StatCard title="Active API Keys" value={stats.users.activeApiKeys} icon={<ShieldCheck size={18} />} variant="success" />
            <StatCard title="Pending Reports" value={stats.scamReports.pending} icon={<Warning size={18} />} variant="warning" />
            <StatCard title="Total Revenue" value={formatUSD(stats.payments.revenue)} icon={<CreditCard size={18} />} variant="success" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard title="Verified Scams" value={stats.scamReports.verified} icon={<Warning size={18} />} variant="danger" />
            <StatCard title="Confirmed Payments" value={stats.payments.confirmed} icon={<CreditCard size={18} />} />
            <StatCard title="High-Risk Tokens" value={stats.tokens.highRisk} icon={<ShieldCheck size={18} />} variant="warning" />
          </div>
        </div>
      )}

      {/* Users tab */}
      {activeTab === "users" && (
        <div className="bg-background-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-muted text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Plan</th>
                <th className="text-left px-4 py-3">Total Requests</th>
                <th className="text-left px-4 py-3">Last Used</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border/50 hover:bg-background-hover/50">
                  <td className="px-4 py-3 text-text-primary">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary-light">{user.plan}</span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {user.apiKeys?.[0]?.totalRequests?.toLocaleString() || 0}
                  </td>
                  <td className="px-4 py-3 text-text-muted text-xs">
                    {user.apiKeys?.[0]?.lastUsed ? timeAgo(user.apiKeys[0].lastUsed) : "Never"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${user.isActive ? "text-green-400" : "text-red-400"}`}>
                      {user.isActive ? "Active" : "Suspended"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-muted text-xs">{timeAgo(user.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Payments tab */}
      {activeTab === "payments" && (
        <div className="bg-background-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-muted text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Plan</th>
                <th className="text-left px-4 py-3">Amount</th>
                <th className="text-left px-4 py-3">Network</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-background-hover/50">
                  <td className="px-4 py-3 text-text-primary">{p.user?.email || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary-light">{p.plan}</span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-text-primary">${p.amount} USDT</td>
                  <td className="px-4 py-3 text-text-secondary text-xs">{p.network}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                      ${p.status === "CONFIRMED" ? "bg-green-500/10 text-green-400" :
                        p.status === "PENDING" ? "bg-yellow-500/10 text-yellow-400" :
                        "bg-red-500/10 text-red-400"}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-muted text-xs">{timeAgo(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reports tab */}
      {activeTab === "reports" && (
        <div className="space-y-3">
          {reports.length === 0 && (
            <div className="text-center py-12 text-text-muted text-sm">
              No pending reports
            </div>
          )}
          {reports.map((report) => (
            <div key={report.id} className="bg-background-card border border-border rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded bg-background-tertiary border border-border text-text-muted">
                      {report.scamType}
                    </span>
                    <span className="text-xs text-text-muted">{timeAgo(report.createdAt)}</span>
                  </div>
                  {report.targetWallet && (
                    <p className="text-xs font-mono text-text-primary">Wallet: {report.targetWallet}</p>
                  )}
                  {report.targetContract && (
                    <p className="text-xs font-mono text-text-primary">Contract: {report.targetContract}</p>
                  )}
                  <p className="text-sm text-text-secondary mt-2">{report.description}</p>
                </div>

                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    onClick={() => verifyReport(report.id, 75)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20
                               text-green-400 text-xs font-medium transition-colors border border-green-500/20"
                  >
                    <CheckCircle size={13} />
                    Verify
                  </button>
                  <button
                    onClick={() => rejectReport(report.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20
                               text-red-400 text-xs font-medium transition-colors border border-red-500/20"
                  >
                    <XCircle size={13} />
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
