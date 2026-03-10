"use client";

import { useState } from "react";
import { MagnifyingGlass, Spinner } from "@phosphor-icons/react";
import { cn, isValidAddress } from "@/lib/utils";

interface AddressInputProps {
  onAnalyze: (address: string) => Promise<void>;
  placeholder?: string;
  label?: string;
  className?: string;
}

export function AddressInput({
  onAnalyze,
  placeholder = "Enter wallet or contract address (0x...)",
  label,
  className,
}: AddressInputProps) {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = address.trim();

    if (!val) {
      setError("Address is required");
      return;
    }

    if (!isValidAddress(val)) {
      setError("Invalid Ethereum address format (must start with 0x and be 42 chars)");
      return;
    }

    setError("");
    setLoading(true);

    try {
      await onAnalyze(val);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const isValid = isValidAddress(address.trim());

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <label className="block text-sm font-medium text-text-secondary mb-2">{label}</label>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <input
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              if (error) setError("");
            }}
            placeholder={placeholder}
            className={cn(
              "w-full bg-background-tertiary border rounded-lg pl-4 pr-4 py-3 text-sm font-mono",
              "text-text-primary placeholder:text-text-muted",
              "focus:outline-none focus:ring-1 transition-colors",
              address && !isValid
                ? "border-red-500/40 focus:ring-red-500/30 focus:border-red-500/60"
                : isValid
                ? "border-green-500/30 focus:ring-green-500/30 focus:border-green-500/50"
                : "border-border focus:ring-primary/30 focus:border-primary/50"
            )}
          />

          {/* Address validation indicator */}
          {address && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isValid ? (
                <span className="w-2 h-2 rounded-full bg-green-500 block" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-red-500 block" />
              )}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !address.trim()}
          className={cn(
            "px-5 py-3 rounded-lg font-medium text-sm flex items-center gap-2",
            "bg-primary hover:bg-primary-dark transition-colors",
            "text-white disabled:opacity-50 disabled:cursor-not-allowed",
            "border border-primary/50 shadow-glow-sm"
          )}
        >
          {loading ? (
            <Spinner size={16} className="animate-spin" />
          ) : (
            <MagnifyingGlass size={16} />
          )}
          {loading ? "Analyzing..." : "Analyze"}
        </button>
      </form>

      {error && (
        <p className="mt-2 text-xs text-red-400 flex items-center gap-1">
          <span>⚠</span> {error}
        </p>
      )}
    </div>
  );
}
