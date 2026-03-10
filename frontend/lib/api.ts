import axios from "axios";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

// Attach API key from localStorage on every request
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const apiKey = localStorage.getItem("kcc_api_key");
    const token = localStorage.getItem("kcc_token");

    if (apiKey) config.headers["x-api-key"] = apiKey;
    if (token) config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      if (typeof window !== "undefined") {
        // Clear stale credentials
        // Don't auto-redirect to avoid loops
      }
    }
    return Promise.reject(err);
  }
);

// ── API Functions ─────────────────────────────────────────────────────────────

export async function getWalletRisk(address: string, chainId = 1) {
  const { data } = await api.get(`/api/wallet-risk/${address}`, { params: { chainId } });
  return data;
}

export async function getContractRisk(address: string, chainId = 1) {
  const { data } = await api.get(`/api/contract-risk/${address}`, { params: { chainId } });
  return data;
}

export async function getTokenRugRisk(address: string, chainId = 1) {
  const { data } = await api.get(`/api/token-rug-risk/${address}`, { params: { chainId } });
  return data;
}

export async function getScamRegistry(params?: {
  limit?: number;
  offset?: number;
  scamType?: string;
  riskLevel?: string;
  search?: string;
}) {
  const { data } = await api.get("/api/scam-registry", { params });
  return data;
}

export async function checkScamAddress(address: string) {
  const { data } = await api.get(`/api/scam-check/${address}`);
  return data;
}

export async function reportScam(payload: {
  targetWallet?: string;
  targetContract?: string;
  scamType: string;
  description: string;
  evidenceUrls?: string[];
  reporterWallet?: string;
}) {
  const { data } = await api.post("/api/report-scam", payload);
  return data;
}

export async function getHighRiskTokens(limit = 20, offset = 0) {
  const { data } = await api.get("/api/token-rug-risk/feed/high-risk", { params: { limit, offset } });
  return data;
}

export async function getPlans() {
  const { data } = await api.get("/api/payments/plans");
  return data;
}

export async function createPayment(payload: {
  plan: string;
  billing: string;
  network: string;
}) {
  const { data } = await api.post("/api/payments/create", payload);
  return data;
}

export async function getPaymentStatus(paymentId: string) {
  const { data } = await api.get(`/api/payments/status/${paymentId}`);
  return data;
}

export async function register(email: string, password: string, name?: string) {
  const { data } = await api.post("/api/auth/register", { email, password, name });
  return data;
}

export async function login(email: string, password: string) {
  const { data } = await api.post("/api/auth/login", { email, password });
  return data;
}

export async function getApiKeys() {
  const { data } = await api.get("/api/auth/api-keys");
  return data;
}

export async function createApiKey(name?: string) {
  const { data } = await api.post("/api/auth/api-keys", { name });
  return data;
}
