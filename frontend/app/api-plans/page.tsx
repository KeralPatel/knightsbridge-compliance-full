"use client";

import { useState, useEffect } from "react";
import { getPlans, createPayment } from "@/lib/api";
import { CheckCircle, Lightning, Globe, ShieldCheck, CreditCard } from "@phosphor-icons/react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

interface Plan {
  id: string;
  name: string;
  price: { monthly: number; yearly: number };
  features: {
    rpmLimit: number;
    monthlyLimit: number;
    walletRisk: boolean;
    contractRisk: boolean;
    tokenRug: boolean;
    scamRegistry: boolean;
    batchRequests: boolean;
    prioritySupport: boolean;
  };
}

const PLAN_HIGHLIGHTS: Record<string, { tag?: string; tagColor?: string; border: string; gradient: string }> = {
  FREE:       { border: "border-border",          gradient: "" },
  STARTER:    { border: "border-blue-500/30",      gradient: "bg-blue-500/5" },
  PRO:        { tag: "Most Popular", tagColor: "bg-primary text-white", border: "border-primary/40", gradient: "bg-primary/5" },
  ENTERPRISE: { tag: "Best Value",  tagColor: "bg-violet-500 text-white", border: "border-violet-500/30", gradient: "bg-violet-500/5" },
};

export default function ApiPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState(true);
  const [paymentModal, setPaymentModal] = useState<{
    plan: string;
    amount: number;
    open: boolean;
    invoiceData?: any;
  } | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    getPlans()
      .then((d) => setPlans(d.plans || []))
      .catch(() => toast.error("Failed to load plans"))
      .finally(() => setLoading(false));
  }, []);

  const handleSelectPlan = async (plan: Plan) => {
    if (plan.id === "FREE") {
      toast("You're already on the free plan. Register for an API key.", { icon: "ℹ️" });
      return;
    }

    const amount = plan.price[billing];
    setPaymentModal({ plan: plan.id, amount, open: true });
  };

  const handleCreateInvoice = async (network: "ETHEREUM" | "POLYGON") => {
    if (!paymentModal) return;
    setCheckoutLoading(true);

    try {
      const data = await createPayment({
        plan: paymentModal.plan,
        billing,
        network,
      });

      setPaymentModal({ ...paymentModal, invoiceData: data });
      toast.success("Invoice created");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create invoice. Ensure you're logged in.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const featureList = [
    { key: "walletRisk",      label: "Wallet Risk API" },
    { key: "contractRisk",    label: "Contract Risk API" },
    { key: "tokenRug",        label: "Token Rug Risk API" },
    { key: "scamRegistry",    label: "Scam Registry API" },
    { key: "batchRequests",   label: "Batch Requests" },
    { key: "prioritySupport", label: "Priority Support" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary-light text-xs">
          <Lightning size={12} />
          API Access
        </div>
        <h1 className="text-3xl font-bold text-text-primary">Choose Your Plan</h1>
        <p className="text-text-secondary text-sm max-w-xl mx-auto">
          Get programmatic access to all compliance intelligence tools.
          Pay in USDT — no credit card required.
        </p>
      </div>

      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => setBilling("monthly")}
          className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            billing === "monthly"
              ? "bg-primary text-white"
              : "bg-background-card border border-border text-text-secondary hover:text-text-primary"
          )}
        >
          Monthly
        </button>
        <button
          onClick={() => setBilling("yearly")}
          className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors relative",
            billing === "yearly"
              ? "bg-primary text-white"
              : "bg-background-card border border-border text-text-secondary hover:text-text-primary"
          )}
        >
          Yearly
          <span className="absolute -top-2 -right-2 text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded-full">
            -17%
          </span>
        </button>
      </div>

      {/* Plans grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-96 rounded-xl bg-background-card border border-border animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {plans.map((plan) => {
            const highlight = PLAN_HIGHLIGHTS[plan.id] || PLAN_HIGHLIGHTS.FREE;
            const price = plan.price[billing];

            return (
              <div
                key={plan.id}
                className={cn(
                  "relative flex flex-col rounded-xl p-5 border bg-background-card",
                  highlight.border,
                  highlight.gradient
                )}
              >
                {/* Tag */}
                {highlight.tag && (
                  <div className={cn("absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold px-3 py-1 rounded-full", highlight.tagColor)}>
                    {highlight.tag}
                  </div>
                )}

                {/* Plan header */}
                <div className="mb-5">
                  <h3 className="font-bold text-text-primary text-lg">{plan.name}</h3>
                  <div className="mt-2 flex items-end gap-1">
                    <span className="text-3xl font-bold text-text-primary">
                      {price === 0 ? "Free" : `$${price}`}
                    </span>
                    {price > 0 && (
                      <span className="text-text-muted text-sm mb-1">/{billing}</span>
                    )}
                  </div>
                  {price > 0 && billing === "yearly" && (
                    <p className="text-xs text-green-400 mt-1">
                      Save ${(plan.price.monthly * 12 - plan.price.yearly).toFixed(0)}/year
                    </p>
                  )}
                </div>

                {/* Limits */}
                <div className="mb-5 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-muted text-xs">Requests/min</span>
                    <span className="text-text-primary font-medium text-xs">{plan.features.rpmLimit.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted text-xs">Monthly limit</span>
                    <span className="text-text-primary font-medium text-xs">{plan.features.monthlyLimit.toLocaleString()}</span>
                  </div>
                </div>

                {/* Features */}
                <div className="flex-1 space-y-2 mb-5">
                  {featureList.map(({ key, label }) => {
                    const enabled = plan.features[key as keyof typeof plan.features];
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <CheckCircle
                          size={14}
                          weight="fill"
                          className={enabled ? "text-green-400" : "text-text-muted opacity-40"}
                        />
                        <span className={cn("text-xs", enabled ? "text-text-secondary" : "text-text-muted line-through opacity-40")}>
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* CTA */}
                <button
                  onClick={() => handleSelectPlan(plan)}
                  className={cn(
                    "w-full py-2.5 rounded-lg text-sm font-semibold transition-colors",
                    plan.id === "PRO"
                      ? "bg-primary hover:bg-primary-dark text-white border border-primary/50"
                      : plan.id === "FREE"
                      ? "bg-background-tertiary hover:bg-background-hover text-text-secondary border border-border"
                      : "bg-background-tertiary hover:bg-background-hover text-text-primary border border-border"
                  )}
                >
                  {plan.id === "FREE" ? "Get Free Key" : `Subscribe — $${price} USDT`}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Payment modal */}
      {paymentModal?.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-background-card border border-border rounded-2xl p-6 w-full max-w-md space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-text-primary">
                Subscribe to {paymentModal.plan}
              </h3>
              <button
                onClick={() => setPaymentModal(null)}
                className="text-text-muted hover:text-text-primary text-xl"
              >
                ×
              </button>
            </div>

            {!paymentModal.invoiceData ? (
              <>
                <div className="bg-background-tertiary rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-text-primary">${paymentModal.amount} USDT</p>
                  <p className="text-xs text-text-muted mt-1">per {billing}</p>
                </div>

                <p className="text-sm text-text-secondary">Select payment network:</p>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleCreateInvoice("ETHEREUM")}
                    disabled={checkoutLoading}
                    className="p-4 rounded-xl border border-border bg-background-tertiary hover:bg-background-hover
                               transition-colors text-sm font-medium text-text-primary flex flex-col items-center gap-2"
                  >
                    <Globe size={20} className="text-blue-400" />
                    Ethereum
                    <span className="text-xs text-text-muted">ERC-20 USDT</span>
                  </button>
                  <button
                    onClick={() => handleCreateInvoice("POLYGON")}
                    disabled={checkoutLoading}
                    className="p-4 rounded-xl border border-border bg-background-tertiary hover:bg-background-hover
                               transition-colors text-sm font-medium text-text-primary flex flex-col items-center gap-2"
                  >
                    <Globe size={20} className="text-violet-400" />
                    Polygon
                    <span className="text-xs text-text-muted">Low fees</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="bg-background-tertiary rounded-xl p-4 space-y-3">
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wide">Send exactly</p>
                  <p className="text-2xl font-bold text-text-primary">{paymentModal.invoiceData.amount} USDT</p>
                  <div>
                    <p className="text-xs text-text-muted mb-1">To address</p>
                    <p className="font-mono text-xs text-text-primary bg-background p-2 rounded-lg break-all">
                      {paymentModal.invoiceData.sendTo}
                    </p>
                  </div>
                  <p className="text-xs text-yellow-400">
                    ⏱ Expires: {new Date(paymentModal.invoiceData.expiresAt).toLocaleTimeString()}
                  </p>
                </div>

                <ul className="space-y-1.5">
                  {paymentModal.invoiceData.instructions?.map((instr: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-text-secondary">
                      <CheckCircle size={14} weight="fill" className="text-green-400 flex-shrink-0 mt-0.5" />
                      {instr}
                    </li>
                  ))}
                </ul>

                <p className="text-xs text-text-muted text-center">
                  Your plan activates automatically after blockchain confirmation.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Features section */}
      <div className="border-t border-border pt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { icon: ShieldCheck, title: "USDT Payments Only", desc: "Pay in USDT on Ethereum, Polygon. No credit cards, no KYC for basic plans." },
          { icon: Lightning, title: "Instant Activation", desc: "API key activates automatically after transaction confirmation on-chain." },
          { icon: Globe, title: "Global API Access", desc: "Low-latency API endpoints with 99.9% uptime SLA for Enterprise customers." },
        ].map((f) => (
          <div key={f.title} className="flex gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <f.icon size={18} weight="duotone" className="text-primary-light" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-text-primary mb-1">{f.title}</h4>
              <p className="text-xs text-text-secondary leading-relaxed">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
