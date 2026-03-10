"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShieldCheck,
  Wallet,
  Code,
  Coins,
  Warning,
  Flag,
  CreditCard,
  ChartLine,
  GearSix,
  House,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/",                  icon: House,       label: "Overview" },
  { href: "/dashboard",         icon: ChartLine,   label: "Dashboard" },
  { href: "/wallet-risk",       icon: Wallet,      label: "Wallet Risk" },
  { href: "/token-risk",        icon: Coins,       label: "Token Risk" },
  { href: "/contract-scanner",  icon: Code,        label: "Contract Scanner" },
  { href: "/scam-registry",     icon: Warning,     label: "Scam Registry" },
  { href: "/report-scam",       icon: Flag,        label: "Report Scam" },
  { href: "/api-plans",         icon: CreditCard,  label: "API Plans" },
  { href: "/admin",             icon: GearSix,     label: "Admin" },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-60 bg-background-secondary border-r border-border flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
          <ShieldCheck size={18} weight="duotone" className="text-primary-light" />
        </div>
        <div>
          <p className="text-sm font-bold text-text-primary tracking-wide">KCC</p>
          <p className="text-[10px] text-text-muted uppercase tracking-widest">Compliance Centre</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150",
                active
                  ? "bg-primary/10 text-primary-light border border-primary/20"
                  : "text-text-secondary hover:text-text-primary hover:bg-background-hover"
              )}
            >
              <Icon
                size={17}
                weight={active ? "duotone" : "regular"}
                className={active ? "text-primary-light" : "text-text-muted"}
              />
              {label}
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-light" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-border">
        <div className="flex items-center gap-2 px-2 py-2 rounded-md bg-primary/5 border border-primary/10">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse-slow" />
          <span className="text-xs text-text-secondary">Indexer Online</span>
        </div>
      </div>
    </aside>
  );
}
