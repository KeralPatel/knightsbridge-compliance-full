// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title ReputationScore
/// @notice Tracks on-chain reputation scores for wallets and contracts
/// @dev Scores are in the range 0-1000 (higher = better reputation)
contract ReputationScore is AccessControl, Pausable {
    bytes32 public constant ORACLE_ROLE    = keccak256("ORACLE_ROLE");
    bytes32 public constant OPERATOR_ROLE  = keccak256("OPERATOR_ROLE");

    // ─── Structs ──────────────────────────────────────────────────────────────
    struct Reputation {
        uint256 score;           // 0-1000 (1000 = perfect)
        uint256 positiveActions; // verified safe interactions
        uint256 negativeActions; // scam/risk interactions
        uint256 reportsMade;     // legitimate reports submitted
        uint256 reportsReceived; // reports made against this address
        uint256 lastUpdated;
        bool exists;
    }

    struct ScoreChange {
        uint256 timestamp;
        int256 delta;
        string reason;
    }

    // ─── State ────────────────────────────────────────────────────────────────
    mapping(address => Reputation) public reputations;
    mapping(address => ScoreChange[]) public scoreHistory;

    uint256 public constant MAX_SCORE = 1000;
    uint256 public constant INITIAL_SCORE = 500;
    uint256 public constant POSITIVE_DELTA = 10;
    uint256 public constant NEGATIVE_DELTA = 50;
    uint256 public constant SCAM_REPORT_PENALTY = 100;

    // ─── Events ───────────────────────────────────────────────────────────────
    event ReputationInitialized(address indexed addr, uint256 initialScore);
    event ScoreIncreased(address indexed addr, uint256 delta, uint256 newScore, string reason);
    event ScoreDecreased(address indexed addr, uint256 delta, uint256 newScore, string reason);
    event ScoreReset(address indexed addr, uint256 newScore);

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
    }

    // ─── Core Functions ───────────────────────────────────────────────────────

    /// @notice Initialize reputation for an address
    function initializeReputation(address addr) external onlyRole(OPERATOR_ROLE) {
        require(!reputations[addr].exists, "ReputationScore: already initialized");
        require(addr != address(0), "ReputationScore: zero address");

        reputations[addr] = Reputation({
            score: INITIAL_SCORE,
            positiveActions: 0,
            negativeActions: 0,
            reportsMade: 0,
            reportsReceived: 0,
            lastUpdated: block.timestamp,
            exists: true
        });

        emit ReputationInitialized(addr, INITIAL_SCORE);
    }

    /// @notice Increase reputation score
    function increaseScore(
        address addr,
        uint256 delta,
        string calldata reason
    ) external onlyRole(ORACLE_ROLE) whenNotPaused {
        _ensureExists(addr);
        Reputation storage rep = reputations[addr];

        uint256 newScore = rep.score + delta;
        if (newScore > MAX_SCORE) newScore = MAX_SCORE;

        uint256 actualDelta = newScore - rep.score;
        rep.score = newScore;
        rep.positiveActions++;
        rep.lastUpdated = block.timestamp;

        scoreHistory[addr].push(ScoreChange({
            timestamp: block.timestamp,
            delta: int256(actualDelta),
            reason: reason
        }));

        emit ScoreIncreased(addr, actualDelta, newScore, reason);
    }

    /// @notice Decrease reputation score
    function decreaseScore(
        address addr,
        uint256 delta,
        string calldata reason
    ) external onlyRole(ORACLE_ROLE) whenNotPaused {
        _ensureExists(addr);
        Reputation storage rep = reputations[addr];

        uint256 newScore = rep.score > delta ? rep.score - delta : 0;
        uint256 actualDelta = rep.score - newScore;

        rep.score = newScore;
        rep.negativeActions++;
        rep.lastUpdated = block.timestamp;

        scoreHistory[addr].push(ScoreChange({
            timestamp: block.timestamp,
            delta: -int256(actualDelta),
            reason: reason
        }));

        emit ScoreDecreased(addr, actualDelta, newScore, reason);
    }

    /// @notice Apply scam report penalty
    function applyScamPenalty(address addr) external onlyRole(ORACLE_ROLE) whenNotPaused {
        _ensureExists(addr);
        Reputation storage rep = reputations[addr];
        rep.reportsReceived++;

        uint256 newScore = rep.score > SCAM_REPORT_PENALTY ? rep.score - SCAM_REPORT_PENALTY : 0;
        rep.score = newScore;
        rep.negativeActions++;
        rep.lastUpdated = block.timestamp;

        scoreHistory[addr].push(ScoreChange({
            timestamp: block.timestamp,
            delta: -int256(SCAM_REPORT_PENALTY),
            reason: "scam_report_penalty"
        }));

        emit ScoreDecreased(addr, SCAM_REPORT_PENALTY, newScore, "scam_report_penalty");
    }

    /// @notice Credit reporter for a successful verified report
    function creditReporter(address reporter) external onlyRole(ORACLE_ROLE) whenNotPaused {
        _ensureExists(reporter);
        reputations[reporter].reportsMade++;
        uint256 delta = POSITIVE_DELTA * 2; // reporters get double credit
        uint256 newScore = reputations[reporter].score + delta;
        if (newScore > MAX_SCORE) newScore = MAX_SCORE;
        reputations[reporter].score = newScore;
        reputations[reporter].lastUpdated = block.timestamp;
        emit ScoreIncreased(reporter, delta, newScore, "verified_report_credit");
    }

    // ─── Admin ────────────────────────────────────────────────────────────────
    function setScore(address addr, uint256 score) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(score <= MAX_SCORE, "ReputationScore: exceeds max");
        _ensureExists(addr);
        reputations[addr].score = score;
        reputations[addr].lastUpdated = block.timestamp;
        emit ScoreReset(addr, score);
    }

    // ─── Views ────────────────────────────────────────────────────────────────
    function getReputation(address addr) external view returns (Reputation memory) {
        return reputations[addr];
    }

    function getScore(address addr) external view returns (uint256) {
        return reputations[addr].exists ? reputations[addr].score : 0;
    }

    function getScoreHistory(address addr) external view returns (ScoreChange[] memory) {
        return scoreHistory[addr];
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    // ─── Internal ─────────────────────────────────────────────────────────────
    function _ensureExists(address addr) internal {
        if (!reputations[addr].exists) {
            reputations[addr] = Reputation({
                score: INITIAL_SCORE,
                positiveActions: 0,
                negativeActions: 0,
                reportsMade: 0,
                reportsReceived: 0,
                lastUpdated: block.timestamp,
                exists: true
            });
            emit ReputationInitialized(addr, INITIAL_SCORE);
        }
    }
}
