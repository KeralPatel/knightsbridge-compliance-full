import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying KCC contracts with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  const deployments: Record<string, string> = {};

  // ── 1. ComplianceRegistry ───────────────────────────────────────────────
  console.log("\n[1/5] Deploying ComplianceRegistry...");
  const ComplianceRegistry = await ethers.getContractFactory("ComplianceRegistry");
  const registry = await ComplianceRegistry.deploy(deployer.address);
  await registry.waitForDeployment();
  deployments.ComplianceRegistry = await registry.getAddress();
  console.log("  ✓ ComplianceRegistry:", deployments.ComplianceRegistry);

  // ── 2. ScamRegistry ─────────────────────────────────────────────────────
  console.log("\n[2/5] Deploying ScamRegistry...");
  const ScamRegistry = await ethers.getContractFactory("ScamRegistry");
  const scamRegistry = await ScamRegistry.deploy(deployer.address);
  await scamRegistry.waitForDeployment();
  deployments.ScamRegistry = await scamRegistry.getAddress();
  console.log("  ✓ ScamRegistry:", deployments.ScamRegistry);

  // ── 3. ReputationScore ──────────────────────────────────────────────────
  console.log("\n[3/5] Deploying ReputationScore...");
  const ReputationScore = await ethers.getContractFactory("ReputationScore");
  const reputation = await ReputationScore.deploy(deployer.address);
  await reputation.waitForDeployment();
  deployments.ReputationScore = await reputation.getAddress();
  console.log("  ✓ ReputationScore:", deployments.ReputationScore);

  // ── 4. ReportStaking ────────────────────────────────────────────────────
  // Using a mock ERC20 for local; on mainnet use actual KCC token address
  console.log("\n[4/5] Deploying ReportStaking...");

  // For non-local networks, you'd pass the actual stake token address
  const network = await ethers.provider.getNetwork();
  let stakeTokenAddress: string;

  if (network.chainId === 31337n) {
    // Deploy mock ERC20 for local testing
    const MockERC20 = await ethers.getContractFactory("MockERC20").catch(() => null);
    if (MockERC20) {
      const mockToken = await MockERC20.deploy("KCC Token", "KCC", ethers.parseEther("1000000"));
      await mockToken.waitForDeployment();
      stakeTokenAddress = await mockToken.getAddress();
      console.log("  ✓ Mock ERC20 deployed:", stakeTokenAddress);
    } else {
      stakeTokenAddress = "0x0000000000000000000000000000000000000001"; // placeholder
    }
  } else {
    stakeTokenAddress = process.env.KCC_TOKEN_ADDRESS || deployer.address; // replace with actual
  }

  const ReportStaking = await ethers.getContractFactory("ReportStaking");
  const staking = await ReportStaking.deploy(
    deployer.address,
    stakeTokenAddress,
    ethers.parseEther("100"), // 100 token minimum stake
    deployer.address          // treasury = deployer for now
  );
  await staking.waitForDeployment();
  deployments.ReportStaking = await staking.getAddress();
  console.log("  ✓ ReportStaking:", deployments.ReportStaking);

  // ── 5. KYCVerificationSBT ───────────────────────────────────────────────
  console.log("\n[5/5] Deploying KYCVerificationSBT...");
  const KYCVerificationSBT = await ethers.getContractFactory("KYCVerificationSBT");
  const kyc = await KYCVerificationSBT.deploy(deployer.address);
  await kyc.waitForDeployment();
  deployments.KYCVerificationSBT = await kyc.getAddress();
  console.log("  ✓ KYCVerificationSBT:", deployments.KYCVerificationSBT);

  // ── Save deployments ─────────────────────────────────────────────────────
  const chainId = Number(network.chainId);
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });

  const outputPath = path.join(deploymentsDir, `${chainId}.json`);
  const output = {
    chainId,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: deployments,
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n✓ Deployment saved to ${outputPath}`);

  // ── Generate .env entries ─────────────────────────────────────────────────
  console.log("\n── Add to .env ──────────────────────────────────────────");
  Object.entries(deployments).forEach(([name, address]) => {
    const key = name.replace(/([A-Z])/g, "_$1").toUpperCase().slice(1);
    console.log(`${key}_ADDRESS="${address}"`);
  });
  console.log("────────────────────────────────────────────────────────\n");

  return deployments;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
