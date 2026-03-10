// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ComplianceRegistry
/// @notice Central registry for compliance data in Knightsbridge Compliance Centre
/// @dev Manages addresses, risk scores, and compliance status with role-based access
contract ComplianceRegistry is AccessControl, Pausable, ReentrancyGuard {
    // ─── Roles ────────────────────────────────────────────────────────────────
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant ORACLE_ROLE   = keccak256("ORACLE_ROLE");

    // ─── Enums ────────────────────────────────────────────────────────────────
    enum RiskLevel { UNKNOWN, LOW, MEDIUM, HIGH, CRITICAL }
    enum AddressType { WALLET, CONTRACT, TOKEN }
    enum ComplianceStatus { UNREVIEWED, COMPLIANT, NON_COMPLIANT, FLAGGED, BLACKLISTED }

    // ─── Structs ──────────────────────────────────────────────────────────────
    struct AddressRecord {
        address addr;
        AddressType addrType;
        RiskLevel riskLevel;
        ComplianceStatus status;
        uint256 riskScore;       // 0-100
        uint256 lastUpdated;
        uint256 reportCount;
        bytes32 evidenceIpfsHash;
        string label;
        bool active;
    }

    // ─── State ────────────────────────────────────────────────────────────────
    mapping(address => AddressRecord) public records;
    mapping(address => bool) public blacklisted;
    mapping(address => uint256[]) public riskHistory;

    address[] public flaggedAddresses;
    address[] public blacklistedAddresses;

    uint256 public totalRecords;
    uint256 public blacklistThreshold = 90; // auto-blacklist if score >= 90

    // ─── Events ───────────────────────────────────────────────────────────────
    event AddressRegistered(address indexed addr, AddressType addrType, uint256 timestamp);
    event RiskScoreUpdated(address indexed addr, uint256 oldScore, uint256 newScore, RiskLevel level);
    event AddressBlacklisted(address indexed addr, address indexed by, uint256 timestamp);
    event AddressWhitelisted(address indexed addr, address indexed by, uint256 timestamp);
    event ComplianceStatusChanged(address indexed addr, ComplianceStatus oldStatus, ComplianceStatus newStatus);
    event EvidenceUpdated(address indexed addr, bytes32 ipfsHash);

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        _grantRole(VERIFIER_ROLE, admin);
    }

    // ─── Core Functions ───────────────────────────────────────────────────────

    /// @notice Register or update an address in the compliance registry
    function registerAddress(
        address addr,
        AddressType addrType,
        uint256 riskScore,
        bytes32 evidenceIpfsHash,
        string calldata label
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        require(addr != address(0), "ComplianceRegistry: zero address");
        require(riskScore <= 100, "ComplianceRegistry: invalid risk score");

        bool isNew = !records[addr].active;

        RiskLevel level = _calculateRiskLevel(riskScore);

        records[addr] = AddressRecord({
            addr: addr,
            addrType: addrType,
            riskLevel: level,
            status: riskScore >= blacklistThreshold ? ComplianceStatus.NON_COMPLIANT : ComplianceStatus.FLAGGED,
            riskScore: riskScore,
            lastUpdated: block.timestamp,
            reportCount: records[addr].reportCount,
            evidenceIpfsHash: evidenceIpfsHash,
            label: label,
            active: true
        });

        riskHistory[addr].push(riskScore);

        if (isNew) {
            totalRecords++;
            emit AddressRegistered(addr, addrType, block.timestamp);
        }

        emit RiskScoreUpdated(addr, 0, riskScore, level);

        if (riskScore >= blacklistThreshold && !blacklisted[addr]) {
            _blacklistAddress(addr);
        }
    }

    /// @notice Update risk score for an existing address
    function updateRiskScore(
        address addr,
        uint256 newScore
    ) external onlyRole(ORACLE_ROLE) whenNotPaused {
        require(records[addr].active, "ComplianceRegistry: address not registered");
        require(newScore <= 100, "ComplianceRegistry: invalid risk score");

        uint256 oldScore = records[addr].riskScore;
        RiskLevel newLevel = _calculateRiskLevel(newScore);

        records[addr].riskScore = newScore;
        records[addr].riskLevel = newLevel;
        records[addr].lastUpdated = block.timestamp;
        riskHistory[addr].push(newScore);

        emit RiskScoreUpdated(addr, oldScore, newScore, newLevel);

        if (newScore >= blacklistThreshold && !blacklisted[addr]) {
            _blacklistAddress(addr);
        }
    }

    /// @notice Manually blacklist an address
    function blacklistAddress(address addr) external onlyRole(VERIFIER_ROLE) {
        require(addr != address(0), "ComplianceRegistry: zero address");
        _blacklistAddress(addr);
    }

    /// @notice Remove an address from blacklist
    function removeFromBlacklist(address addr) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(blacklisted[addr], "ComplianceRegistry: not blacklisted");
        blacklisted[addr] = false;

        if (records[addr].active) {
            records[addr].status = ComplianceStatus.UNREVIEWED;
        }

        emit AddressWhitelisted(addr, msg.sender, block.timestamp);
    }

    /// @notice Update evidence IPFS hash
    function updateEvidence(address addr, bytes32 ipfsHash) external onlyRole(VERIFIER_ROLE) {
        require(records[addr].active, "ComplianceRegistry: address not registered");
        records[addr].evidenceIpfsHash = ipfsHash;
        emit EvidenceUpdated(addr, ipfsHash);
    }

    /// @notice Update compliance status
    function updateComplianceStatus(
        address addr,
        ComplianceStatus newStatus
    ) external onlyRole(VERIFIER_ROLE) {
        require(records[addr].active, "ComplianceRegistry: not registered");
        ComplianceStatus oldStatus = records[addr].status;
        records[addr].status = newStatus;
        emit ComplianceStatusChanged(addr, oldStatus, newStatus);
    }

    /// @notice Increment report count
    function incrementReportCount(address addr) external onlyRole(OPERATOR_ROLE) {
        records[addr].reportCount++;
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getRecord(address addr) external view returns (AddressRecord memory) {
        return records[addr];
    }

    function isBlacklisted(address addr) external view returns (bool) {
        return blacklisted[addr];
    }

    function getRiskScore(address addr) external view returns (uint256) {
        return records[addr].riskScore;
    }

    function getRiskHistory(address addr) external view returns (uint256[] memory) {
        return riskHistory[addr];
    }

    function getBlacklistedAddresses() external view returns (address[] memory) {
        return blacklistedAddresses;
    }

    function getFlaggedAddresses() external view returns (address[] memory) {
        return flaggedAddresses;
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setBlacklistThreshold(uint256 threshold) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(threshold > 0 && threshold <= 100, "ComplianceRegistry: invalid threshold");
        blacklistThreshold = threshold;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    // ─── Internal ─────────────────────────────────────────────────────────────

    function _blacklistAddress(address addr) internal {
        if (blacklisted[addr]) return;
        blacklisted[addr] = true;
        blacklistedAddresses.push(addr);

        if (records[addr].active) {
            ComplianceStatus old = records[addr].status;
            records[addr].status = ComplianceStatus.BLACKLISTED;
            emit ComplianceStatusChanged(addr, old, ComplianceStatus.BLACKLISTED);
        }

        emit AddressBlacklisted(addr, msg.sender, block.timestamp);
    }

    function _calculateRiskLevel(uint256 score) internal pure returns (RiskLevel) {
        if (score >= 80) return RiskLevel.CRITICAL;
        if (score >= 60) return RiskLevel.HIGH;
        if (score >= 40) return RiskLevel.MEDIUM;
        if (score > 0)   return RiskLevel.LOW;
        return RiskLevel.UNKNOWN;
    }
}
