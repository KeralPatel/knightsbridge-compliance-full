# Knightsbridge Compliance Centre — Deployment Guide

## Prerequisites

- Node.js 22+
- PostgreSQL database (Vercel Postgres recommended)
- Alchemy, Infura, or QuickNode API key
- Pinata IPFS account (for evidence storage)
- MetaMask or hardware wallet for contract deployment

---

## 1. Environment Setup

```bash
cp .env.example .env
```

Fill in all required values in `.env`. The minimum required are:

```env
POSTGRES_URL="postgresql://..."
ALCHEMY_API_KEY="..."
ETH_RPC_URL="https://eth-mainnet.g.alchemy.com/v2/..."
JWT_SECRET="<min 32 char random string>"
ADMIN_API_KEY="<generate with: npx tsx scripts/generate-admin-key.ts>"
```

---

## 2. Database Setup

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Seed known bad addresses
npx tsx scripts/seed-bad-addresses.ts
```

---

## 3. Smart Contract Deployment

```bash
cd contracts
npm install

# Compile contracts
npm run compile

# Deploy to local hardhat network (for testing)
npm run node  # in one terminal
npm run deploy:local  # in another terminal

# Deploy to Sepolia testnet
npm run deploy:sepolia

# Deploy to Ethereum mainnet
npm run deploy:mainnet
```

After deployment, copy the contract addresses from `contracts/deployments/<chainId>.json`
and update your `.env` file:

```env
COMPLIANCE_REGISTRY_ADDRESS="0x..."
SCAM_REGISTRY_ADDRESS="0x..."
REPUTATION_SCORE_ADDRESS="0x..."
REPORT_STAKING_ADDRESS="0x..."
KYC_SBT_ADDRESS="0x..."
```

---

## 4. Running the Indexer

```bash
cd indexer
npm install
npm run dev  # development
npm run build && npm start  # production
```

The indexer will:
- Connect to your Ethereum RPC
- Start scanning from the latest block
- Detect new DEX liquidity pairs
- Run rug-pull analysis on new tokens
- Monitor USDT transfers to your payment wallets

---

## 5. Running the Backend API

```bash
cd backend
npm install
npm run dev  # development (hot-reload)
npm run build && npm start  # production

# API will be available at http://localhost:4000
# Swagger docs at http://localhost:4000/docs
```

---

## 6. Deploying the Frontend to Vercel

```bash
cd frontend
npm install

# Test locally
npm run dev  # http://localhost:3000

# Deploy to Vercel
vercel login
vercel
```

**Vercel Environment Variables** (set in Vercel dashboard):

```
NEXT_PUBLIC_BACKEND_URL=https://your-backend.railway.app
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_id
```

---

## 7. Production Infrastructure

### Recommended Stack

| Service     | Provider              | Notes                              |
|-------------|----------------------|------------------------------------|
| Frontend    | Vercel               | Automatic CI/CD from GitHub        |
| Backend API | Railway / Render     | Node.js 22 service                 |
| Indexer     | Railway / VPS        | Persistent Node.js service         |
| Database    | Vercel Postgres      | Serverless PostgreSQL              |
| IPFS        | Pinata               | Evidence storage                   |

### Backend (Railway)

1. Connect GitHub repo to Railway
2. Select `backend` subdirectory
3. Set build command: `npm run build`
4. Set start command: `npm start`
5. Add all environment variables

### Indexer (Railway)

1. Create new Railway service
2. Select `indexer` subdirectory
3. Set start command: `npm start`
4. The indexer needs to run 24/7

---

## 8. Admin Setup

Generate an admin key:
```bash
npx tsx scripts/generate-admin-key.ts
```

Access the admin dashboard at `/admin` with your admin key.

---

## 9. Security Checklist

- [ ] Set strong `JWT_SECRET` (32+ random chars)
- [ ] Set strong `ADMIN_API_KEY`
- [ ] Enable Vercel OIDC / WAF in production
- [ ] Configure `CORS_ORIGIN` to your actual frontend domain
- [ ] Set `NODE_ENV=production`
- [ ] Enable PostgreSQL SSL (`?sslmode=require` in connection string)
- [ ] Rotate deployer private key after contract deployment
- [ ] Verify all contracts on Etherscan
- [ ] Set up monitoring/alerting (Grafana/Datadog)

---

## 10. API Usage Example

```bash
# Get API key from /api-plans page, then:

# Check wallet risk
curl -H "x-api-key: kcc_starter_xxx" \
  https://api.knightsbridge.com/api/wallet-risk/0x742d35Cc6634C0532925a3b8D4C3C5E6d2e9F6bC

# Check token rug risk
curl -H "x-api-key: kcc_starter_xxx" \
  https://api.knightsbridge.com/api/token-rug-risk/0xdAC17F958D2ee523a2206206994597C13D831ec7

# Scan smart contract
curl -H "x-api-key: kcc_starter_xxx" \
  https://api.knightsbridge.com/api/contract-risk/0xdAC17F958D2ee523a2206206994597C13D831ec7
```
