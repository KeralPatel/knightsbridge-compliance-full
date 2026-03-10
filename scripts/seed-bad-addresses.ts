/**
 * Seed script: Populates known bad addresses (mixers, exploiters) into the DB
 * Run: npx tsx scripts/seed-bad-addresses.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const KNOWN_BAD_ADDRESSES = [
  // ── Tornado Cash (Ethereum) ────────────────────────────────────────────────
  { address: "0x722122dF12D4e14e13Ac3b6895a86e84145b6967", category: "mixer", label: "Tornado Cash 0.1 ETH",   source: "OFAC" },
  { address: "0xdd4c48C0B24039969fC16D1cdF626eaB821d3384", category: "mixer", label: "Tornado Cash 1 ETH",     source: "OFAC" },
  { address: "0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b", category: "mixer", label: "Tornado Cash 10 ETH",    source: "OFAC" },
  { address: "0x910Cbd523D972eb0a6f4cAe4618aD62622b39DbF", category: "mixer", label: "Tornado Cash 100 ETH",   source: "OFAC" },
  { address: "0xA160cdAB225685dA1d56aa342Ad8841c3b53f291", category: "mixer", label: "Tornado Cash 1000 ETH",  source: "OFAC" },
  { address: "0x94Be88213a387E992Dd87DE56950a9aef34b9448", category: "mixer", label: "Tornado Cash DAI 100k",  source: "OFAC" },
  { address: "0xb1C8094b234DcE6e03f10a5b673c1d8C69739A00", category: "mixer", label: "Tornado Cash DAI 1M",    source: "OFAC" },
  { address: "0xD4B88Df4D29F5CedD6857912842cff3b20C8Cfa3", category: "mixer", label: "Tornado Cash DAI 10k",   source: "OFAC" },

  // ── Major Exploits ─────────────────────────────────────────────────────────
  { address: "0x3c11F6265Ddec22f4d049Dde480615735f451646", category: "exploit", label: "Ronin Bridge Hacker",    source: "manual" },
  { address: "0x098B716B8Aaf21512996dC57EB0615e2383E2f96", category: "exploit", label: "Ronin Bridge Hacker 2",  source: "manual" },
  { address: "0x629e7Da20197a5429d30da36E77d06CdF796b71A", category: "exploit", label: "BNB Bridge Exploiter",   source: "manual" },
];

async function main() {
  console.log("Seeding known bad addresses...");

  for (const addr of KNOWN_BAD_ADDRESSES) {
    await prisma.knownBadAddress.upsert({
      where: {
        address_chainId: { address: addr.address.toLowerCase(), chainId: 1 },
      },
      update: { label: addr.label, source: addr.source },
      create: {
        address: addr.address.toLowerCase(),
        chainId: 1,
        category: addr.category,
        label: addr.label,
        source: addr.source,
      },
    });
    console.log(`  ✓ ${addr.label}`);
  }

  console.log(`\nSeeded ${KNOWN_BAD_ADDRESSES.length} bad addresses`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
