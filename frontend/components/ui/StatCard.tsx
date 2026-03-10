import { cn } from "@/lib/utils";
import type { Icon } from "@phosphor-icons/react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  variant?: "default" | "danger" | "success" | "warning";
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  variant = "default",
  className,
}: StatCardProps) {
  const variantStyles = {
    default: "border-border",
    danger: "border-red-500/20 bg-red-500/5",
    success: "border-green-500/20 bg-green-500/5",
    warning: "border-yellow-500/20 bg-yellow-500/5",
  };

  const iconStyles = {
    default: "text-primary-light bg-primary/10",
    danger: "text-red-400 bg-red-500/10",
    success: "text-green-400 bg-green-500/10",
    warning: "text-yellow-400 bg-yellow-500/10",
  };

  return (
    <div
      className={cn(
        "bg-background-card border rounded-lg p-5 flex flex-col gap-4",
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-text-primary mt-1.5 tabular-nums">{value}</p>
          {subtitle && <p className="text-xs text-text-secondary mt-1">{subtitle}</p>}
        </div>
        <div className={cn("p-2.5 rounded-lg", iconStyles[variant])}>{icon}</div>
      </div>

      {trend && (
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "text-xs font-medium",
              trend.value > 0 ? "text-green-400" : trend.value < 0 ? "text-red-400" : "text-text-muted"
            )}
          >
            {trend.value > 0 ? "↑" : trend.value < 0 ? "↓" : "→"} {Math.abs(trend.value)}%
          </span>
          <span className="text-xs text-text-muted">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
