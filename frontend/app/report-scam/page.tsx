"use client";

import { useState } from "react";
import { reportScam } from "@/lib/api";
import { isValidAddress } from "@/lib/utils";
import { Flag, CheckCircle, Warning } from "@phosphor-icons/react";
import toast from "react-hot-toast";

const SCAM_TYPES = [
  { value: "RUG_PULL",           label: "Rug Pull" },
  { value: "PHISHING",           label: "Phishing" },
  { value: "HONEYPOT",           label: "Honeypot" },
  { value: "FAKE_TOKEN",         label: "Fake Token" },
  { value: "PUMP_AND_DUMP",      label: "Pump & Dump" },
  { value: "MIXER",              label: "Mixer" },
  { value: "MALICIOUS_CONTRACT", label: "Malicious Contract" },
  { value: "EXPLOIT",            label: "Exploit" },
  { value: "SOCIAL_ENGINEERING", label: "Social Engineering" },
  { value: "OTHER",              label: "Other" },
];

export default function ReportScamPage() {
  const [form, setForm] = useState({
    targetWallet: "",
    targetContract: "",
    scamType: "",
    description: "",
    evidenceUrls: "",
    reporterWallet: "",
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};

    if (!form.targetWallet && !form.targetContract) {
      errs.target = "Provide either a wallet or contract address";
    }
    if (form.targetWallet && !isValidAddress(form.targetWallet)) {
      errs.targetWallet = "Invalid wallet address";
    }
    if (form.targetContract && !isValidAddress(form.targetContract)) {
      errs.targetContract = "Invalid contract address";
    }
    if (!form.scamType) {
      errs.scamType = "Select a scam type";
    }
    if (!form.description || form.description.length < 20) {
      errs.description = "Description must be at least 20 characters";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const urls = form.evidenceUrls
        .split("\n")
        .map((u) => u.trim())
        .filter(Boolean);

      const result = await reportScam({
        targetWallet: form.targetWallet || undefined,
        targetContract: form.targetContract || undefined,
        scamType: form.scamType,
        description: form.description,
        evidenceUrls: urls,
        reporterWallet: form.reporterWallet || undefined,
      });

      setSubmitted(result.reportId);
      toast.success("Report submitted successfully");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Submission failed");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-background-card border border-green-500/20 rounded-xl p-8 text-center space-y-4">
          <CheckCircle size={48} weight="duotone" className="text-green-400 mx-auto" />
          <h2 className="text-xl font-bold text-text-primary">Report Submitted</h2>
          <p className="text-text-secondary text-sm">
            Your report has been received and will be reviewed by our compliance team.
          </p>
          <div className="bg-background-tertiary rounded-lg px-4 py-2 font-mono text-xs text-text-muted">
            Report ID: {submitted}
          </div>
          <button
            onClick={() => { setSubmitted(null); setForm({ targetWallet: "", targetContract: "", scamType: "", description: "", evidenceUrls: "", reporterWallet: "" }); }}
            className="text-sm text-primary-light hover:underline"
          >
            Submit another report
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <Flag size={22} weight="duotone" className="text-red-400" />
          Report a Scam
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Help protect the community by reporting scam wallets and contracts.
          All reports are reviewed by our verification team.
        </p>
      </div>

      {/* Warning */}
      <div className="flex gap-3 p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
        <Warning size={18} className="text-yellow-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-yellow-300/80">
          <strong>Anti-Sybil Notice:</strong> False reports may result in account suspension.
          Enterprise users who stake tokens face slashing for malicious reports.
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-background-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
            Target Information
          </h3>

          {errors.target && (
            <p className="text-xs text-red-400">{errors.target}</p>
          )}

          {/* Target wallet */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">
              Target Wallet Address <span className="text-text-muted">(optional if contract provided)</span>
            </label>
            <input
              value={form.targetWallet}
              onChange={(e) => setForm({ ...form, targetWallet: e.target.value })}
              placeholder="0x..."
              className="w-full bg-background-tertiary border border-border rounded-lg px-3 py-2.5 text-sm font-mono
                         text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary/50"
            />
            {errors.targetWallet && <p className="text-xs text-red-400 mt-1">{errors.targetWallet}</p>}
          </div>

          {/* Target contract */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">
              Target Contract Address <span className="text-text-muted">(optional if wallet provided)</span>
            </label>
            <input
              value={form.targetContract}
              onChange={(e) => setForm({ ...form, targetContract: e.target.value })}
              placeholder="0x..."
              className="w-full bg-background-tertiary border border-border rounded-lg px-3 py-2.5 text-sm font-mono
                         text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary/50"
            />
            {errors.targetContract && <p className="text-xs text-red-400 mt-1">{errors.targetContract}</p>}
          </div>

          {/* Scam type */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">Scam Type *</label>
            <select
              value={form.scamType}
              onChange={(e) => setForm({ ...form, scamType: e.target.value })}
              className="w-full bg-background-tertiary border border-border rounded-lg px-3 py-2.5 text-sm
                         text-text-primary focus:outline-none focus:border-primary/50"
            >
              <option value="">Select type...</option>
              {SCAM_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            {errors.scamType && <p className="text-xs text-red-400 mt-1">{errors.scamType}</p>}
          </div>
        </div>

        <div className="bg-background-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
            Evidence & Description
          </h3>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">
              Description * <span className="text-text-muted">(min 20 chars)</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4}
              placeholder="Describe the scam activity in detail. Include dates, amounts, and how you identified this as fraudulent..."
              className="w-full bg-background-tertiary border border-border rounded-lg px-3 py-2.5 text-sm
                         text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary/50 resize-none"
            />
            <div className="flex justify-between mt-1">
              {errors.description && <p className="text-xs text-red-400">{errors.description}</p>}
              <span className="text-xs text-text-muted ml-auto">{form.description.length} chars</span>
            </div>
          </div>

          {/* Evidence URLs */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">
              Evidence URLs <span className="text-text-muted">(one per line, optional)</span>
            </label>
            <textarea
              value={form.evidenceUrls}
              onChange={(e) => setForm({ ...form, evidenceUrls: e.target.value })}
              rows={3}
              placeholder="https://twitter.com/...&#10;https://etherscan.io/tx/...&#10;https://..."
              className="w-full bg-background-tertiary border border-border rounded-lg px-3 py-2.5 text-sm
                         text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary/50 resize-none"
            />
          </div>

          {/* Reporter wallet */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">
              Your Wallet Address <span className="text-text-muted">(optional, for reputation rewards)</span>
            </label>
            <input
              value={form.reporterWallet}
              onChange={(e) => setForm({ ...form, reporterWallet: e.target.value })}
              placeholder="0x..."
              className="w-full bg-background-tertiary border border-border rounded-lg px-3 py-2.5 text-sm font-mono
                         text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary/50"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-red-500/90 hover:bg-red-500 text-white font-semibold text-sm
                     transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2
                     border border-red-400/30"
        >
          <Flag size={16} />
          {loading ? "Submitting..." : "Submit Report"}
        </button>
      </form>
    </div>
  );
}
