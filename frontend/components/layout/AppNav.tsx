"use client";

import { useState } from "react";
import { MagnifyingGlass, Bell, User, Key } from "@phosphor-icons/react";
import { isValidAddress } from "@/lib/utils";
import { useRouter } from "next/navigation";

export function AppNav() {
  const [search, setSearch] = useState("");
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const val = search.trim();
    if (!val) return;

    if (isValidAddress(val)) {
      // Ambiguous — go to wallet risk by default
      router.push(`/wallet-risk?address=${val}`);
    } else {
      router.push(`/scam-registry?search=${encodeURIComponent(val)}`);
    }
    setSearch("");
  };

  return (
    <header className="flex items-center justify-between h-14 px-5 bg-background-secondary border-b border-border flex-shrink-0">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex-1 max-w-lg">
        <div className="relative">
          <MagnifyingGlass
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search wallet, contract, or token address..."
            className="w-full bg-background-tertiary border border-border rounded-md pl-9 pr-4 py-2 text-sm
                       text-text-primary placeholder:text-text-muted
                       focus:outline-none focus:border-primary/50 focus:bg-background-hover
                       transition-colors font-mono"
          />
        </div>
      </form>

      {/* Right actions */}
      <div className="flex items-center gap-2 ml-4">
        <button className="p-2 rounded-md text-text-muted hover:text-text-primary hover:bg-background-hover transition-colors relative">
          <Bell size={17} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
        </button>

        <button
          onClick={() => router.push("/api-plans")}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10 border border-primary/20
                     text-primary-light text-xs font-medium hover:bg-primary/20 transition-colors"
        >
          <Key size={13} />
          Get API Key
        </button>

        <button className="p-1.5 rounded-md bg-background-tertiary border border-border hover:bg-background-hover transition-colors">
          <User size={17} className="text-text-secondary" />
        </button>
      </div>
    </header>
  );
}
