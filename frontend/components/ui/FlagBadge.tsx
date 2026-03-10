import { cn } from "@/lib/utils";

const FLAG_STYLES: Record<string, string> = {
  confirmed_scam_wallet:          "bg-red-500/15 text-red-400 border-red-500/20",
  known_mixer:                    "bg-purple-500/15 text-purple-400 border-purple-500/20",
  mixer_interaction:              "bg-purple-500/15 text-purple-400 border-purple-500/20",
  rug_pull_token_interaction:     "bg-orange-500/15 text-orange-400 border-orange-500/20",
  scam_interaction:               "bg-red-500/15 text-red-400 border-red-500/20",
  abnormal_tx_burst:              "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  multiple_scam_reports:          "bg-red-500/15 text-red-400 border-red-500/20",
  scam_report_filed:              "bg-orange-500/15 text-orange-400 border-orange-500/20",
  dev_wallet_high_supply:         "bg-red-500/15 text-red-400 border-red-500/20",
  dev_wallet_moderate_supply:     "bg-orange-500/15 text-orange-400 border-orange-500/20",
  liquidity_not_locked:           "bg-red-500/15 text-red-400 border-red-500/20",
  low_liquidity:                  "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  owner_mint_enabled:             "bg-orange-500/15 text-orange-400 border-orange-500/20",
  blacklist_function_detected:    "bg-red-500/15 text-red-400 border-red-500/20",
  transfer_tax_detected:          "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  upgradeable_proxy_detected:     "bg-blue-500/15 text-blue-400 border-blue-500/20",
  pause_function_detected:        "bg-blue-500/15 text-blue-400 border-blue-500/20",
  contract_not_verified:          "bg-gray-500/15 text-gray-400 border-gray-500/20",
  selfdestruct_detected:          "bg-red-500/15 text-red-400 border-red-500/20",
  hidden_fee_logic_detected:      "bg-red-500/15 text-red-400 border-red-500/20",
  owner_withdraw_function:        "bg-orange-500/15 text-orange-400 border-orange-500/20",
};

const FLAG_LABELS: Record<string, string> = {
  confirmed_scam_wallet:          "Confirmed Scam",
  known_mixer:                    "Known Mixer",
  mixer_interaction:              "Mixer Interaction",
  rug_pull_token_interaction:     "Rug Token Interaction",
  scam_interaction:               "Scam Interaction",
  abnormal_tx_burst:              "TX Burst Detected",
  multiple_scam_reports:          "Multiple Reports",
  scam_report_filed:              "Scam Report Filed",
  dev_wallet_high_supply:         "Dev >40% Supply",
  dev_wallet_moderate_supply:     "Dev >20% Supply",
  liquidity_not_locked:           "Liquidity Unlocked",
  low_liquidity:                  "Low Liquidity",
  owner_mint_enabled:             "Owner Can Mint",
  blacklist_function_detected:    "Blacklist Function",
  transfer_tax_detected:          "Transfer Tax",
  upgradeable_proxy_detected:     "Upgradeable Proxy",
  pause_function_detected:        "Pauseable",
  contract_not_verified:          "Unverified Contract",
  selfdestruct_detected:          "Self-Destruct",
  hidden_fee_logic_detected:      "Hidden Fees",
  owner_withdraw_function:        "Owner Withdraw",
};

interface FlagBadgeProps {
  flag: string;
  className?: string;
}

export function FlagBadge({ flag, className }: FlagBadgeProps) {
  const style = FLAG_STYLES[flag] || "bg-gray-500/15 text-gray-400 border-gray-500/20";
  const label = FLAG_LABELS[flag] || flag.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border",
        style,
        className
      )}
    >
      {label}
    </span>
  );
}

export function FlagList({ flags, max = 10 }: { flags: string[]; max?: number }) {
  const visible = flags.slice(0, max);
  const hidden = flags.length - max;

  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((flag) => (
        <FlagBadge key={flag} flag={flag} />
      ))}
      {hidden > 0 && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-background-tertiary text-text-muted border border-border">
          +{hidden} more
        </span>
      )}
    </div>
  );
}
