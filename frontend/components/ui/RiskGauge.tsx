"use client";

import { cn, getRiskBarColor, getRiskBg, scoreToLevel } from "@/lib/utils";
import { useEffect, useState } from "react";

interface RiskGaugeProps {
  score: number | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function RiskGauge({ score, size = "md", showLabel = true, className }: RiskGaugeProps) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    if (score === null) return;
    const timer = setTimeout(() => setAnimatedScore(score), 100);
    return () => clearTimeout(timer);
  }, [score]);

  if (score === null) {
    return (
      <div className={cn("flex flex-col items-center gap-2", className)}>
        <div className="w-24 h-24 rounded-full border-4 border-border flex items-center justify-center">
          <span className="text-text-muted text-sm">N/A</span>
        </div>
      </div>
    );
  }

  const level = scoreToLevel(score);
  const levelBg = getRiskBg(level);
  const barColor = getRiskBarColor(score);

  // SVG gauge parameters
  const radius = size === "lg" ? 52 : size === "md" ? 40 : 28;
  const strokeWidth = size === "lg" ? 8 : size === "md" ? 6 : 4;
  const svgSize = (radius + strokeWidth) * 2 + 4;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (animatedScore / 100) * circumference;

  const strokeColor =
    score >= 75 ? "#ef4444" :
    score >= 50 ? "#f97316" :
    score >= 25 ? "#eab308" : "#22c55e";

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      {/* SVG Gauge */}
      <div className="relative">
        <svg
          width={svgSize}
          height={svgSize}
          viewBox={`0 0 ${svgSize} ${svgSize}`}
          className="-rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            fill="none"
            stroke="#1e1e30"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s ease-in-out" }}
          />
          {/* Glow filter */}
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        </svg>

        {/* Score text in center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              "font-bold tabular-nums",
              size === "lg" ? "text-3xl" : size === "md" ? "text-2xl" : "text-lg"
            )}
            style={{ color: strokeColor }}
          >
            {animatedScore}
          </span>
          {size !== "sm" && (
            <span className="text-xs text-text-muted mt-0.5">/100</span>
          )}
        </div>
      </div>

      {/* Risk level badge */}
      {showLabel && (
        <span
          className={cn(
            "px-3 py-1 rounded-full text-xs font-semibold border uppercase tracking-wider",
            levelBg
          )}
        >
          {level} RISK
        </span>
      )}
    </div>
  );
}

// ── Inline horizontal risk bar ────────────────────────────────────────────────
interface RiskBarProps {
  score: number;
  className?: string;
}

export function RiskBar({ score, className }: RiskBarProps) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setWidth(score), 100);
    return () => clearTimeout(t);
  }, [score]);

  return (
    <div className={cn("w-full h-2 bg-background-tertiary rounded-full overflow-hidden", className)}>
      <div
        className={cn("h-full rounded-full risk-bar-fill", getRiskBarColor(score))}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
