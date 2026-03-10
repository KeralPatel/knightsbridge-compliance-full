// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title ScamRegistry
/// @notice On-chain registry of scam wallets and contracts with evidence storage
contract ScamRegistry is AccessControl, Pausable {
    // ─── Roles ────────────────────────────────────────────────────────────────
    bytes32 public constant OPERATOR_ROLE  = keccak256("OPERATOR_ROLE");
    bytes32 public constant REPORTER_ROLE  = keccak256("REPORTER_ROLE");
    bytes32 public constant VERIFIER_ROLE  = keccak256("VERIFIER_ROLE");

    // ─── Enums ────────────────────────────────────────────────────────────────
    enum ScamType {
        RUG_PULL,
        PHISHING,
        HONEYPOT,
        FAKE_TOKEN,
        PUMP_AND_DUMP,
        MIXER,
        MALICIOUS_CONTRACT,
        EXPLOIT,
        SOCIAL_ENGINEERING,
        OTHER
    }

    enum VerificationStatus { PENDING, VERIFIED, REJECTED, UNDER_REVIEW }

    // ─── Structs ──────────────────────────────────────────────────────────────
    struct ScamEntry {
        uint256 id;
        address walletAddress;
        address contractAddress;
        ScamType scamType;
        uint256 riskScore;
        bytes32 evidenceIpfsHash;
        address reporter;
        VerificationStatus status;
        uint256 reportedAt;
        uint256 verifiedAt;
        string description;
        bool active;
    }

    // ─── State ────────────────────────────────────────────────────────────────
    uint256 public nextId = 1;
    mapping(uint256 => ScamEntry) public entries;
    mapping(address => uint256[]) public walletEntries;
    mapping(address => uint256[]) public contractEntries;
    mapping(address => bool) public confirmedScam;
    mapping(address => uint256) public reportCountByAddress;

    uint256[] public pendingIds;
    uint256[] public verifiedIds;

    uint256 public totalReports;
    uint256 public verifiedCount;

    // ─── Events ───────────────────────────────────────────────────────────────
    event ScamReported(
        uint256 indexed id,
        address indexed reporter,
        address walletAddress,
        address contractAddress,
        ScamType scamType,
        uint256 timestamp
    );
    event ScamVerified(uint256 indexed id, address indexed verifier, uint256 timestamp);
    event ScamRejected(uint256 indexed id, address indexed verifier, string reason);
    event EvidenceAdded(uint256 indexed id, bytes32 ipfsHash);
    event RiskScoreSet(uint256 indexed id, uint256 score);

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        _grantRole(VERIFIER_ROLE, admin);
        _grantRole(REPORTER_ROLE, admin);
    }

    // ─── Core Functions ───────────────────────────────────────────────────────

    /// @notice Report a scam wallet or contract
    function reportScam(
        address walletAddress,
        address contractAddress,
        ScamType scamType,
        bytes32 evidenceIpfsHash,
        string calldata description
    ) external onlyRole(REPORTER_ROLE) whenNotPaused returns (uint256) {
        require(
            walletAddress != address(0) || contractAddress != address(0),
            "ScamRegistry: must provide wallet or contract"
        );

        uint256 id = nextId++;

        entries[id] = ScamEntry({
            id: id,
            walletAddress: walletAddress,
            contractAddress: contractAddress,
            scamType: scamType,
            riskScore: 0,
            evidenceIpfsHash: evidenceIpfsHash,
            reporter: msg.sender,
            status: VerificationStatus.PENDING,
            reportedAt: block.timestamp,
            verifiedAt: 0,
            description: description,
            active: true
        });

        if (walletAddress != address(0)) {
            walletEntries[walletAddress].push(id);
            reportCountByAddress[walletAddress]++;
        }
        if (contractAddress != address(0)) {
            contractEntries[contractAddress].push(id);
            reportCountByAddress[contractAddress]++;
        }

        pendingIds.push(id);
        totalReports++;

        emit ScamReported(id, msg.sender, walletAddress, contractAddress, scamType, block.timestamp);

        return id;
    }

    /// @notice Verify a scam report (marks as confirmed scam)
    function verifyReport(uint256 id, uint256 riskScore) external onlyRole(VERIFIER_ROLE) {
        require(entries[id].active, "ScamRegistry: entry not found");
        require(entries[id].status == VerificationStatus.PENDING ||
                entries[id].status == VerificationStatus.UNDER_REVIEW,
                "ScamRegistry: already processed");
        require(riskScore <= 100, "ScamRegistry: invalid risk score");

        entries[id].status = VerificationStatus.VERIFIED;
        entries[id].riskScore = riskScore;
        entries[id].verifiedAt = block.timestamp;

        address wallet = entries[id].walletAddress;
        address contract_ = entries[id].contractAddress;

        if (wallet != address(0)) confirmedScam[wallet] = true;
        if (contract_ != address(0)) confirmedScam[contract_] = true;

        verifiedIds.push(id);
        verifiedCount++;

        emit ScamVerified(id, msg.sender, block.timestamp);
        emit RiskScoreSet(id, riskScore);
    }

    /// @notice Reject a scam report
    function rejectReport(uint256 id, string calldata reason) external onlyRole(VERIFIER_ROLE) {
        require(entries[id].active, "ScamRegistry: entry not found");
        entries[id].status = VerificationStatus.REJECTED;
        emit ScamRejected(id, msg.sender, reason);
    }

    /// @notice Set a report under review
    function setUnderReview(uint256 id) external onlyRole(VERIFIER_ROLE) {
        require(entries[id].active, "ScamRegistry: entry not found");
        entries[id].status = VerificationStatus.UNDER_REVIEW;
    }

    /// @notice Add evidence IPFS hash to an existing report
    function addEvidence(uint256 id, bytes32 ipfsHash) external onlyRole(OPERATOR_ROLE) {
        require(entries[id].active, "ScamRegistry: entry not found");
        entries[id].evidenceIpfsHash = ipfsHash;
        emit EvidenceAdded(id, ipfsHash);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getEntry(uint256 id) external view returns (ScamEntry memory) {
        return entries[id];
    }

    function isConfirmedScam(address addr) external view returns (bool) {
        return confirmedScam[addr];
    }

    function getWalletEntries(address wallet) external view returns (uint256[] memory) {
        return walletEntries[wallet];
    }

    function getContractEntries(address contract_) external view returns (uint256[] memory) {
        return contractEntries[contract_];
    }

    function getPendingIds() external view returns (uint256[] memory) {
        return pendingIds;
    }

    function getVerifiedIds() external view returns (uint256[] memory) {
        return verifiedIds;
    }

    function getEntriesBatch(
        uint256 startId,
        uint256 count
    ) external view returns (ScamEntry[] memory) {
        ScamEntry[] memory batch = new ScamEntry[](count);
        for (uint256 i = 0; i < count; i++) {
            if (startId + i < nextId) {
                batch[i] = entries[startId + i];
            }
        }
        return batch;
    }

    // ─── Admin ────────────────────────────────────────────────────────────────
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    function grantReporterRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(REPORTER_ROLE, account);
    }

    function revokeReporterRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(REPORTER_ROLE, account);
    }
}
