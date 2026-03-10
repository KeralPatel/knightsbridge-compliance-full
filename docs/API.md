# Knightsbridge Compliance Centre — API Reference

Base URL: `https://api.knightsbridge.com`

All endpoints require an `x-api-key` header.

---

## Authentication

```
x-api-key: kcc_pro_your_api_key_here
```

---

## Rate Limits

| Plan       | Requests/min | Monthly Limit |
|------------|-------------|---------------|
| Free       | 10          | 100           |
| Starter    | 60          | 10,000        |
| Pro        | 600         | 100,000       |
| Enterprise | 6,000       | 10,000,000    |

---

## Endpoints

### `GET /api/wallet-risk/:address`

Analyse wallet risk score.

**Parameters:**
- `address` — Ethereum wallet address (0x...)
- `chainId` — (query) Chain ID (default: 1)

**Response:**
```json
{
  "wallet": "0x742d35Cc...",
  "chainId": 1,
  "risk_score": 78,
  "risk_level": "HIGH",
  "flags": [
    "mixer_interaction",
    "rug_pull_token_interaction",
    "scam_interaction"
  ],
  "details": {
    "txCount": 1242,
    "scamInteractions": 3,
    "rugInteractions": 7,
    "mixerInteractions": 1,
    "firstSeen": "2023-01-15T12:00:00Z",
    "lastSeen": "2024-06-01T08:30:00Z",
    "totalVolume": "145000"
  },
  "cached": false
}
```

---

### `GET /api/contract-risk/:address`

Bytecode risk analysis for smart contracts.

**Response:**
```json
{
  "contract": "0xdAC17F95...",
  "chainId": 1,
  "risk_score": 35,
  "risk_level": "MEDIUM",
  "warnings": [
    "owner_mint_enabled",
    "pause_function_detected"
  ],
  "details": {
    "isProxy": false,
    "hasOwnerMint": true,
    "hasBlacklist": false,
    "hasTransferTax": false,
    "hasPauseFunction": true,
    "hasOwnerWithdraw": false,
    "hasSelfdestruct": false,
    "hasHiddenFees": false,
    "codeSize": 8472,
    "isVerified": true,
    "ownerAddress": "0xC6CDE7C39eB2f0F0095F41570af89eFC2C1Ea828",
    "implementationAddress": null
  }
}
```

---

### `GET /api/token-rug-risk/:address`

Rug-pull risk score for ERC-20 tokens.

**Response:**
```json
{
  "token": "0xNewToken...",
  "tokenName": "MoonCoin",
  "tokenSymbol": "MOON",
  "rug_risk_score": 91,
  "rug_risk_level": "CRITICAL",
  "warnings": [
    "dev_wallet_high_supply",
    "liquidity_not_locked",
    "owner_mint_enabled",
    "blacklist_function_detected"
  ],
  "details": {
    "devWalletPercent": 62.4,
    "liquidityUSD": 3200,
    "liquidityLocked": false,
    "hasOwnerMint": true,
    "hasBlacklist": true,
    "hasTransferTax": false,
    "isVerified": false,
    "deployerAddress": "0xDeploy...",
    "totalSupply": "1000000000000000000000000000",
    "deployedAt": "2024-11-30T14:22:00Z",
    "calculatedAt": "2024-11-30T14:25:00Z"
  }
}
```

---

### `GET /api/scam-registry`

Browse verified scam entries.

**Query Parameters:**
- `limit` — Results per page (max 100, default 20)
- `offset` — Pagination offset
- `scamType` — Filter by type (RUG_PULL, PHISHING, etc.)
- `riskLevel` — Filter by level (CRITICAL, HIGH, MEDIUM, LOW)
- `search` — Text search on address/description

---

### `GET /api/scam-check/:address`

Quick check if an address is in the scam registry.

**Response:**
```json
{
  "address": "0xScamWallet...",
  "isScam": true,
  "entry": {
    "id": "clx...",
    "scamType": "RUG_PULL",
    "riskScore": 95,
    "riskLevel": "CRITICAL",
    "createdAt": "2024-09-15T08:00:00Z"
  }
}
```

---

### `POST /api/report-scam`

Submit a community scam report.

**Body:**
```json
{
  "targetWallet": "0xScamWallet...",
  "targetContract": "0xMaliciousContract...",
  "scamType": "RUG_PULL",
  "description": "This contract rug-pulled $2M from users on Nov 30th...",
  "evidenceUrls": [
    "https://twitter.com/user/status/123",
    "https://etherscan.io/tx/0x..."
  ],
  "reporterWallet": "0xYourWallet..."
}
```

---

### `POST /api/wallet-risk/batch`

Batch analyse multiple wallets. (Pro+ only)

**Body:**
```json
{
  "addresses": ["0xWallet1...", "0xWallet2...", "0xWallet3..."],
  "chainId": 1
}
```

---

## Error Codes

| Status | Code                    | Description                    |
|--------|------------------------|-------------------------------|
| 401    | Unauthorized           | Invalid or missing API key     |
| 429    | Rate Limit Exceeded    | Too many requests              |
| 400    | Bad Request            | Invalid address format         |
| 403    | Plan Restriction       | Feature not in your plan       |
| 500    | Internal Server Error  | Analysis failed                |
