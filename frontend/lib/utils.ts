import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function truncateAddress(address: string, chars = 6): string {
  if (!address) return "";
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function formatNumber(n: number, decimals = 2): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(decimals);
}

export function formatUSD(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

export function getRiskColor(level: string): string {
  switch (level?.toUpperCase()) {
    case "CRITICAL": return "text-red-500";
    case "HIGH":     return "text-orange-500";
    case "MEDIUM":   return "text-yellow-500";
    case "LOW":      return "text-green-500";
    default:         return "text-gray-500";
  }
}

export function getRiskBg(level: string): string {
  switch (level?.toUpperCase()) {
    case "CRITICAL": return "bg-red-500/10 border-red-500/20 text-red-400";
    case "HIGH":     return "bg-orange-500/10 border-orange-500/20 text-orange-400";
    case "MEDIUM":   return "bg-yellow-500/10 border-yellow-500/20 text-yellow-400";
    case "LOW":      return "bg-green-500/10 border-green-500/20 text-green-400";
    default:         return "bg-gray-500/10 border-gray-500/20 text-gray-400";
  }
}

export function getRiskBarColor(score: number): string {
  if (score >= 75) return "bg-red-500";
  if (score >= 50) return "bg-orange-500";
  if (score >= 25) return "bg-yellow-500";
  return "bg-green-500";
}

export function scoreToLevel(score: number): string {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MEDIUM";
  return "LOW";
}

export function formatScamType(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function timeAgo(date: string | Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = now - then;

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "Just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  return `${Math.floor(diff / day)}d ago`;
}

export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}
