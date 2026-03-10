import Link from "next/link";
import {
  ShieldCheck, Wallet, Coins, Code, Warning, ArrowRight, ChartLine,
  Globe, Lock, Lightning,
} from "@phosphor-icons/react/dist/ssr";

const features = [
  {
    icon: Wallet,
    title: "Wallet Risk Engine",
    desc: "Score any wallet 0–100. Detects mixer interactions, scam contacts, rug-pull exposure and transaction anomalies.",
    href: "/wallet-risk",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
  {
    icon: Coins,
    title: "Token Rug-Pull Detector",
    desc: "Real-time rug risk analysis on newly launched tokens. Detects dev wallets, unlocked liquidity, honeypots.",
    href: "/token-risk",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
  },
  {
    icon: Code,
    title: "Smart Contract Scanner",
    desc: "Bytecode-level analysis detecting mint functions, blacklists, transfer taxes, proxies and hidden fees.",
    href: "/contract-scanner",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
  },
  {
    icon: Warning,
    title: "Scam Registry",
    desc: "Community-verified database of scam wallets, phishing contracts and malicious actors with IPFS evidence.",
    href: "/scam-registry",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
  },
  {
    icon: ChartLine,
    title: "Live Analytics",
    desc: "Real-time blockchain indexing. Monitor new token launches, DEX activity and suspicious transactions.",
    href: "/dashboard",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
  },
  {
    icon: Globe,
    title: "Compliance API",
    desc: "REST API with plans from Starter to Enterprise. Integrate wallet and contract risk directly into your product.",
    href: "/api-plans",
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/20",
  },
];

const stats = [
  { label: "Wallets Analysed", value: "2.4M+" },
  { label: "Scams Detected", value: "18,400+" },
  { label: "API Requests/Day", value: "450K+" },
  { label: "Chains Supported", value: "3" },
];

export default function HomePage() {
  return (
    <div className="min-h-full">
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border px-6 py-20 text-center">
        {/* Background glow */}
        <div className="absolute inset-0 bg-glow-indigo opacity-40 pointer-events-none" />

        <div className="relative max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary-light text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-light animate-pulse" />
            Live Blockchain Intelligence
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-text-primary leading-tight">
            Knightsbridge
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary-light to-accent-cyan mt-1">
              Compliance Centre
            </span>
          </h1>

          <p className="mt-6 text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
            Enterprise-grade blockchain risk intelligence. Detect rug-pulls in real-time,
            analyse wallet risk, scan smart contracts and access verified scam data via API.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/wallet-risk"
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-primary hover:bg-primary-dark
                         text-white font-medium text-sm transition-colors shadow-glow-sm border border-primary/50"
            >
              Check a Wallet <ArrowRight size={16} />
            </Link>
            <Link
              href="/api-plans"
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-background-card
                         hover:bg-background-hover text-text-primary font-medium text-sm
                         transition-colors border border-border"
            >
              Get API Access
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────────────── */}
      <section className="border-b border-border">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-border">
          {stats.map((s) => (
            <div key={s.label} className="px-8 py-7 text-center">
              <p className="text-2xl font-bold text-text-primary tabular-nums">{s.value}</p>
              <p className="text-xs text-text-muted mt-1 uppercase tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────────── */}
      <section className="px-6 py-16 max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-text-primary">Full Compliance Stack</h2>
          <p className="text-text-secondary mt-2 text-sm">
            Every tool you need to secure your blockchain operations
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <Link
              key={f.href}
              href={f.href}
              className={`group block p-5 rounded-xl bg-background-card border ${f.border}
                          hover:bg-background-hover transition-all duration-200
                          hover:shadow-card-hover`}
            >
              <div className={`w-10 h-10 rounded-lg ${f.bg} flex items-center justify-center mb-4`}>
                <f.icon size={20} weight="duotone" className={f.color} />
              </div>
              <h3 className="font-semibold text-text-primary mb-2 flex items-center gap-2">
                {f.title}
                <ArrowRight
                  size={14}
                  className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1 group-hover:translate-x-0"
                />
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">{f.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Security guarantee ────────────────────────────────────────────────── */}
      <section className="border-t border-border px-6 py-12">
        <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
          <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <Lock size={24} weight="duotone" className="text-primary-light" />
          </div>
          <div>
            <h3 className="font-semibold text-text-primary mb-1">
              Enterprise Security Standards
            </h3>
            <p className="text-sm text-text-secondary">
              All data is cryptographically verified. Evidence is stored on IPFS.
              Smart contracts are audited and deployed on-chain. Your API keys are encrypted.
            </p>
          </div>
          <Link
            href="/api-plans"
            className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary/10
                       hover:bg-primary/20 text-primary-light text-sm font-medium border border-primary/20
                       transition-colors whitespace-nowrap"
          >
            <Lightning size={15} />
            Get Started
          </Link>
        </div>
      </section>
    </div>
  );
}
